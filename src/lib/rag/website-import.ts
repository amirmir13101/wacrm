import { createHash } from 'node:crypto'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { createRagWebsiteKnowledge, type RagKnowledgeDetail } from './knowledge-store'
import { cleanRagKnowledgeContent, RAG_KNOWLEDGE_CHARACTER_LIMIT } from './knowledge'
import { sanitizeProviderError } from './security'

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v1/scrape'
const FIRECRAWL_MAP_URL = 'https://api.firecrawl.dev/v1/map'
const DEFAULT_WEBSITE_IMPORT_PAGE_LIMIT = 50
const MAX_WEBSITE_IMPORT_PAGE_LIMIT = 100
const MIN_USEFUL_PAGE_CHARACTERS = 80

const PRIVATE_PATH_SEGMENTS = new Set([
  'login',
  'log-in',
  'signin',
  'sign-in',
  'admin',
  'dashboard',
  'account',
  'my-account',
  'cart',
  'checkout',
  'payment',
  'payments',
  'billing',
  'wp-admin',
  'user',
  'auth',
])

const SKIP_FILE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.css',
  '.js',
  '.zip',
  '.rar',
  '.7z',
  '.mp4',
  '.mp3',
  '.avi',
  '.mov',
  '.pdf',
]

interface RagFirecrawlSettingsRow {
  readonly encrypted_api_key: string | null
  readonly enabled: boolean | null
}

interface FirecrawlScrapeResponse {
  readonly success?: boolean
  readonly data?: {
    readonly markdown?: string | null
    readonly text?: string | null
    readonly html?: string | null
    readonly metadata?: {
      readonly title?: string | null
      readonly sourceURL?: string | null
      readonly url?: string | null
      readonly ogTitle?: string | null
    } | null
  } | null
  readonly error?: string | null
}

type FirecrawlMapEntry = string | {
  readonly url?: string | null
  readonly loc?: string | null
  readonly href?: string | null
}

interface FirecrawlMapResponse {
  readonly success?: boolean
  readonly links?: ReadonlyArray<FirecrawlMapEntry> | null
  readonly urls?: ReadonlyArray<FirecrawlMapEntry> | null
  readonly data?: ReadonlyArray<FirecrawlMapEntry> | {
    readonly links?: ReadonlyArray<FirecrawlMapEntry> | null
    readonly urls?: ReadonlyArray<FirecrawlMapEntry> | null
  } | null
  readonly error?: string | null
}

interface FirecrawlClient {
  readonly map: (url: string, limit: number) => Promise<FirecrawlMapResponse>
  readonly scrape: (url: string) => Promise<FirecrawlScrapeResponse>
}

interface DiscoveredUrl {
  readonly url: string
  readonly skipReason: string | null
}

interface ImportedWebsitePage {
  readonly url: string
  readonly title: string | null
  readonly content: string
  readonly hash: string
}

export interface RagWebsiteImportStats {
  readonly startUrl: string
  readonly pagesFound: number
  readonly pagesImported: number
  readonly pagesSkipped: number
  readonly pagesFailed: number
  readonly duplicatePages: number
  readonly savedCharacters: number
  readonly capped: boolean
  readonly pageLimit: number
  readonly skippedReasons: Readonly<Record<string, number>>
}

export interface RagWebsiteImportResult {
  readonly source: RagKnowledgeDetail
  readonly message: string
  readonly stats: RagWebsiteImportStats
}

export function validateRagWebsiteUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Website URL is required.')

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Enter a valid website URL.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https website URLs are supported.')
  }

  return parsed.toString()
}

function safeWebsiteTitle(url: string, title?: string | null): string {
  const cleanTitle = title?.replace(/[\u0000-\u001F\u007F]/g, '').trim()
  if (cleanTitle) return cleanTitle.slice(0, 160)
  return `Website: ${new URL(url).hostname}`
}

function rootComparableHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function normalizeWebsiteCandidateUrl(value: string, startUrl: string): string | null {
  try {
    const parsed = new URL(value, startUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    parsed.hash = ''
    parsed.searchParams.sort()
    return parsed.toString()
  } catch {
    return null
  }
}

function isSameRootOrWww(candidateUrl: string, startUrl: string): boolean {
  const candidate = new URL(candidateUrl)
  const start = new URL(startUrl)
  return rootComparableHost(candidate.hostname) === rootComparableHost(start.hostname)
}

function unsafeWebsiteSkipReason(url: string, startUrl: string): string | null {
  if (!isSameRootOrWww(url, startUrl)) return 'external_domain'

  const parsed = new URL(url)
  const segments = parsed.pathname
    .split('/')
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)

  if (segments.some((segment) => PRIVATE_PATH_SEGMENTS.has(segment))) {
    return 'private_path'
  }

  const lowerPath = parsed.pathname.toLowerCase()
  if (SKIP_FILE_EXTENSIONS.some((extension) => lowerPath.endsWith(extension))) {
    return 'unsupported_file_type'
  }

  return null
}

function addReason(
  reasons: Map<string, number>,
  reason: string,
): void {
  reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
}

function readMapEntryUrl(entry: FirecrawlMapEntry): string | null {
  if (typeof entry === 'string') return entry
  return entry.url ?? entry.loc ?? entry.href ?? null
}

function isFirecrawlMapEntryArray(value: unknown): value is ReadonlyArray<FirecrawlMapEntry> {
  return Array.isArray(value)
}

function readFirecrawlMapUrls(response: FirecrawlMapResponse): ReadonlyArray<string> {
  let dataLinks: ReadonlyArray<FirecrawlMapEntry> | undefined
  const data = response.data
  if (isFirecrawlMapEntryArray(data)) {
    dataLinks = data
  } else if (data) {
    dataLinks = data.links ?? data.urls ?? undefined
  }
  const entries = response.links ?? response.urls ?? dataLinks ?? []
  return entries.map(readMapEntryUrl).filter((url: string | null): url is string => Boolean(url))
}

function extractFirecrawlContent(response: FirecrawlScrapeResponse): {
  readonly title: string | null
  readonly finalUrl: string | null
  readonly content: string
} {
  const data = response.data
  const content = cleanRagKnowledgeContent(
    [data?.markdown, data?.text, data?.html].filter(Boolean).join('\n\n'),
  )

  return {
    title: data?.metadata?.title ?? data?.metadata?.ogTitle ?? null,
    finalUrl: data?.metadata?.sourceURL ?? data?.metadata?.url ?? null,
    content,
  }
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function discoverWebsiteUrls(args: {
  readonly startUrl: string
  readonly mappedUrls: ReadonlyArray<string>
  readonly pageLimit: number
}): {
  readonly urls: ReadonlyArray<string>
  readonly discovered: ReadonlyArray<DiscoveredUrl>
  readonly skippedReasons: Map<string, number>
} {
  const skippedReasons = new Map<string, number>()
  const seen = new Set<string>()
  const urls: string[] = []
  const discovered: DiscoveredUrl[] = []

  for (const rawUrl of [args.startUrl, ...args.mappedUrls]) {
    const normalized = normalizeWebsiteCandidateUrl(rawUrl, args.startUrl)
    if (!normalized) {
      discovered.push({ url: rawUrl, skipReason: 'invalid_url' })
      addReason(skippedReasons, 'invalid_url')
      continue
    }

    const skipReason = unsafeWebsiteSkipReason(normalized, args.startUrl)
    if (skipReason) {
      discovered.push({ url: normalized, skipReason })
      addReason(skippedReasons, skipReason)
      continue
    }

    const key = normalized.replace(/^https?:\/\/www\./i, (match) => match.replace('www.', ''))
    if (seen.has(key)) {
      discovered.push({ url: normalized, skipReason: 'duplicate_url' })
      addReason(skippedReasons, 'duplicate_url')
      continue
    }

    seen.add(key)
    discovered.push({ url: normalized, skipReason: null })
    if (urls.length < args.pageLimit) {
      urls.push(normalized)
    } else {
      addReason(skippedReasons, 'page_limit_reached')
    }
  }

  return { urls, discovered, skippedReasons }
}

function buildWebsiteKnowledgeContent(args: {
  readonly pages: ReadonlyArray<ImportedWebsitePage>
  readonly startUrl: string
}): {
  readonly content: string
  readonly savedCharacters: number
  readonly capped: boolean
} {
  const sections: string[] = [
    `# Website Knowledge Import`,
    `Source website: ${args.startUrl}`,
  ]
  let length = sections.join('\n\n').length
  let capped = false

  for (const page of args.pages) {
    const section = [
      `## Page: ${page.title ?? page.url}`,
      `URL: ${page.url}`,
      page.content,
    ].join('\n\n')
    const nextLength = length + section.length + 2

    if (nextLength > RAG_KNOWLEDGE_CHARACTER_LIMIT) {
      const remaining = RAG_KNOWLEDGE_CHARACTER_LIMIT - length - 2
      if (remaining > 200) {
        sections.push(section.slice(0, remaining).trim())
      }
      capped = true
      break
    }

    sections.push(section)
    length = nextLength
  }

  const content = cleanRagKnowledgeContent(sections.join('\n\n'))
  return {
    content,
    savedCharacters: content.length,
    capped,
  }
}

async function getFirecrawlApiKey(workspaceId: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from('rag_firecrawl_settings')
    .select('encrypted_api_key, enabled')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const row = data as RagFirecrawlSettingsRow | null
  if (!row?.encrypted_api_key || row.enabled !== true) {
    throw new Error('Add your Firecrawl API key first.')
  }

  return decrypt(row.encrypted_api_key)
}

function createFirecrawlClient(apiKey: string): FirecrawlClient {
  return {
    map: async (url, limit) => {
      const response = await fetch(FIRECRAWL_MAP_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          limit,
          includeSubdomains: false,
          ignoreSitemap: false,
        }),
      })

      const payload = await response.json().catch(() => ({})) as FirecrawlMapResponse
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || 'Firecrawl could not discover website pages.')
      }
      return payload
    },
    scrape: async (url) => {
      const response = await fetch(FIRECRAWL_SCRAPE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['markdown', 'html'],
          onlyMainContent: false,
        }),
      })

      const payload = await response.json().catch(() => ({})) as FirecrawlScrapeResponse
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || 'Firecrawl could not scrape this page.')
      }
      return payload
    },
  }
}

function clampPageLimit(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? NaN)) return DEFAULT_WEBSITE_IMPORT_PAGE_LIMIT
  return Math.min(
    MAX_WEBSITE_IMPORT_PAGE_LIMIT,
    Math.max(1, Math.floor(value ?? DEFAULT_WEBSITE_IMPORT_PAGE_LIMIT)),
  )
}

async function importWebsiteWithClient(args: {
  readonly client: FirecrawlClient
  readonly startUrl: string
  readonly pageLimit?: number
}): Promise<{
  readonly title: string
  readonly content: string
  readonly finalUrl: string
  readonly stats: RagWebsiteImportStats
}> {
  const pageLimit = clampPageLimit(args.pageLimit)
  let mappedUrls: ReadonlyArray<string> = []
  const skippedReasons = new Map<string, number>()

  try {
    mappedUrls = readFirecrawlMapUrls(await args.client.map(args.startUrl, pageLimit))
  } catch {
    addReason(skippedReasons, 'map_unavailable_single_url_fallback')
  }

  const discovered = discoverWebsiteUrls({
    startUrl: args.startUrl,
    mappedUrls,
    pageLimit,
  })
  for (const [reason, count] of discovered.skippedReasons) {
    skippedReasons.set(reason, (skippedReasons.get(reason) ?? 0) + count)
  }

  const importedPages: ImportedWebsitePage[] = []
  const seenHashes = new Set<string>()
  let pagesFailed = 0
  let duplicatePages = 0

  for (const pageUrl of discovered.urls) {
    try {
      const scraped = await args.client.scrape(pageUrl)
      const extracted = extractFirecrawlContent(scraped)
      const finalUrl = normalizeWebsiteCandidateUrl(extracted.finalUrl ?? pageUrl, args.startUrl) ?? pageUrl
      const skipReason = unsafeWebsiteSkipReason(finalUrl, args.startUrl)
      if (skipReason) {
        addReason(skippedReasons, skipReason)
        continue
      }

      if (extracted.content.length < MIN_USEFUL_PAGE_CHARACTERS) {
        addReason(skippedReasons, 'not_enough_text')
        continue
      }

      const hash = hashContent(extracted.content)
      if (seenHashes.has(hash)) {
        duplicatePages += 1
        addReason(skippedReasons, 'duplicate_content')
        continue
      }

      seenHashes.add(hash)
      importedPages.push({
        url: finalUrl,
        title: extracted.title,
        content: extracted.content,
        hash,
      })
    } catch {
      pagesFailed += 1
      addReason(skippedReasons, 'scrape_failed')
    }
  }

  if (importedPages.length === 0) {
    throw new Error(
      mappedUrls.length === 0
        ? 'Firecrawl only returned the starting page and no readable website content was found.'
        : 'No readable website content was found from the discovered public pages.',
    )
  }

  const built = buildWebsiteKnowledgeContent({
    pages: importedPages,
    startUrl: args.startUrl,
  })

  return {
    title: safeWebsiteTitle(args.startUrl, importedPages[0]?.title),
    content: built.content,
    finalUrl: importedPages[0]?.url ?? args.startUrl,
    stats: {
      startUrl: args.startUrl,
      pagesFound: discovered.discovered.length,
      pagesImported: importedPages.length,
      pagesSkipped: Array.from(skippedReasons.values()).reduce((sum, count) => sum + count, 0),
      pagesFailed,
      duplicatePages,
      savedCharacters: built.savedCharacters,
      capped: built.capped,
      pageLimit,
      skippedReasons: Object.fromEntries(skippedReasons),
    },
  }
}

export async function importRagWebsiteKnowledge(args: {
  readonly workspaceId: string
  readonly userId: string
  readonly url: string
  readonly pageLimit?: number
}): Promise<RagWebsiteImportResult> {
  const url = validateRagWebsiteUrl(args.url)
  const apiKey = await getFirecrawlApiKey(args.workspaceId)

  let imported: Awaited<ReturnType<typeof importWebsiteWithClient>>
  try {
    imported = await importWebsiteWithClient({
      client: createFirecrawlClient(apiKey),
      startUrl: url,
      pageLimit: args.pageLimit,
    })
  } catch (error) {
    throw new Error(sanitizeProviderError(error) || 'Import failed.')
  }

  const source = await createRagWebsiteKnowledge({
    workspaceId: args.workspaceId,
    userId: args.userId,
    title: imported.title,
    content: imported.content,
    sourceUrl: url,
    finalUrl: imported.finalUrl,
  })

  return {
    source,
    stats: imported.stats,
    message: imported.stats.capped
      ? 'Website imported and capped at the knowledge character limit.'
      : 'Website imported successfully.',
  }
}

export const __ragWebsiteImportTestUtils = {
  buildWebsiteKnowledgeContent,
  discoverWebsiteUrls,
  extractFirecrawlContent,
  importWebsiteWithClient,
  isSameRootOrWww,
  safeWebsiteTitle,
  unsafeWebsiteSkipReason,
}
