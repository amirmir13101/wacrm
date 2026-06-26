import { createHash } from 'node:crypto'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { createRagWebsiteKnowledge, type RagKnowledgeDetail } from './knowledge-store'
import { cleanRagKnowledgeContent, RAG_KNOWLEDGE_CHARACTER_LIMIT } from './knowledge'
import { sanitizeProviderError } from './security'

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v1/scrape'
const FIRECRAWL_MAP_URL = 'https://api.firecrawl.dev/v1/map'
const FIRECRAWL_V2_BASE_URL = 'https://api.firecrawl.dev/v2'
const DEFAULT_WEBSITE_IMPORT_PAGE_LIMIT = 50
const MAX_WEBSITE_IMPORT_PAGE_LIMIT = 100
const MIN_USEFUL_PAGE_CHARACTERS = 80
const FIRECRAWL_REQUEST_TIMEOUT_MS = 30_000
const FIRECRAWL_CRAWL_POLL_INTERVAL_MS = 2_000
const FIRECRAWL_CRAWL_MAX_WAIT_MS = 90_000

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
  'clientarea',
  'client-area',
  'client',
  'submit-ticket',
  'support-ticket',
  'ticket',
  'tickets',
  'wp-admin',
  'user',
  'auth',
])

const LOW_VALUE_PATH_SEGMENTS = new Set([
  'author',
  'category',
  'tag',
  'feed',
  'wp-json',
  'xmlrpc.php',
  'search',
  'page',
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
  '.xml',
]

const JUNK_LINE_PATTERNS = [
  /\b(skip to content|toggle navigation|open menu|close menu|menu|hamburger)\b/i,
  /\b(accessibility|accessibility widget|increase text|decrease text|grayscale|high contrast|negative contrast|light background|readable font|reset all)\b/i,
  /\b(close|loading|hide|reset|spinner|please wait)\b/i,
  /\b(cookie|cookies|accept all|reject all|privacy preferences)\b/i,
  /\b(newsletter|subscribe to our newsletter|enter your email)\b/i,
  /\b(lorem ipsum|hello world|welcome to wordpress|uncategorized)\b/i,
  /\b(add to cart|view cart|checkout|coupon code|billing details)\b/i,
  /\b(username|password|remember me|forgot password|log in|register)\b/i,
  /\b(function\s*\(|var\s+|let\s+|const\s+|=>|document\.|window\.|canvas|getcontext|elementor|wp-json)\b/i,
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

interface FirecrawlCrawlPage {
  readonly markdown?: string | null
  readonly html?: string | null
  readonly rawHtml?: string | null
  readonly text?: string | null
  readonly metadata?: {
    readonly title?: string | null
    readonly sourceURL?: string | null
    readonly url?: string | null
    readonly ogTitle?: string | null
    readonly statusCode?: number | null
  } | null
}

interface FirecrawlCrawlResponse {
  readonly id?: string | null
  readonly success?: boolean
  readonly status?: 'scraping' | 'completed' | 'failed' | 'cancelled' | string | null
  readonly total?: number | null
  readonly completed?: number | null
  readonly creditsUsed?: number | null
  readonly data?: ReadonlyArray<FirecrawlCrawlPage> | null
  readonly next?: string | null
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
  readonly crawl?: (url: string, limit: number) => Promise<ReadonlyArray<FirecrawlCrawlPage>>
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
  readonly rawCharacters: number
}

interface ExtractedWebsiteContent {
  readonly title: string | null
  readonly finalUrl: string | null
  readonly content: string
}

export interface RagWebsiteImportStats {
  readonly startUrl: string
  readonly pagesFound: number
  readonly pagesImported: number
  readonly pagesSkipped: number
  readonly pagesFailed: number
  readonly duplicatePages: number
  readonly rawCharacters: number
  readonly duplicateJunkCharactersRemoved: number
  readonly savedCharacters: number
  readonly capped: boolean
  readonly pageLimit: number
  readonly lowValuePagesSkipped: number
  readonly aiStructuringUsed: boolean
  readonly deterministicFallbackUsed: boolean
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
  const lowerPath = parsed.pathname.toLowerCase()
  const segments = parsed.pathname
    .split('/')
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)

  if (segments.includes('hello-world')) return 'low_value_wordpress_default'
  if (segments.some((segment) => LOW_VALUE_PATH_SEGMENTS.has(segment))) {
    return 'low_value_archive_or_feed'
  }

  if (segments.some((segment) => PRIVATE_PATH_SEGMENTS.has(segment))) {
    return 'private_path'
  }
  if (/sitemap.*\.xml$/i.test(lowerPath) || lowerPath.endsWith('/sitemap.xml')) {
    return 'sitemap_xml_not_knowledge'
  }
  if (parsed.searchParams.has('s') || parsed.searchParams.has('replytocom')) {
    return 'low_value_search_or_comment'
  }

  if (SKIP_FILE_EXTENSIONS.some((extension) => lowerPath.endsWith(extension))) {
    return lowerPath.endsWith('.xml') ? 'sitemap_xml_not_knowledge' : 'unsupported_file_type'
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

function extractFirecrawlContent(response: FirecrawlScrapeResponse): ExtractedWebsiteContent {
  const data = response.data
  return extractPageContent({
    markdown: data?.markdown,
    text: data?.text,
    html: data?.html,
    metadata: data?.metadata,
  })
}

function extractFirecrawlCrawlPageContent(page: FirecrawlCrawlPage): ExtractedWebsiteContent {
  return extractPageContent({
    markdown: page.markdown,
    text: page.text,
    html: page.rawHtml ?? page.html,
    metadata: page.metadata,
  })
}

function extractPageContent(args: {
  readonly markdown?: string | null
  readonly text?: string | null
  readonly html?: string | null
  readonly metadata?: {
    readonly title?: string | null
    readonly sourceURL?: string | null
    readonly url?: string | null
    readonly ogTitle?: string | null
  } | null
}): ExtractedWebsiteContent {
  const structuredHtml = args.html ? extractWebsiteKnowledgeText(args.html) : ''
  const content = cleanRagKnowledgeContent(
    [
      structuredHtml,
      args.markdown,
      args.text,
    ].filter(Boolean).join('\n\n'),
  )

  return {
    title: args.metadata?.title ?? args.metadata?.ogTitle ?? readHtmlTitle(args.html ?? '') ?? null,
    finalUrl: args.metadata?.sourceURL ?? args.metadata?.url ?? null,
    content,
  }
}

function extractWebsiteKnowledgeText(html: string): string {
  return cleanRagKnowledgeContent([
    extractHtmlMetadataText(html),
    extractJsonLdText(html),
    extractTablesText(html),
    extractContactLinksText(html),
    extractFooterText(html),
    extractHeadingHierarchyText(html),
    cleanHtmlToText(html),
  ].filter(Boolean).join('\n\n'))
}

function readHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match?.[1] ? decodeHtmlEntities(stripTags(match[1])).trim().slice(0, 160) : null
}

function extractHtmlMetadataText(html: string): string {
  const title = readHtmlTitle(html)
  const description = readMetaContent(html, 'description')
  const canonical = html.match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i)?.[0]
  const canonicalHref = canonical?.match(/href=["']([^"']+)["']/i)?.[1]
  const lines = [
    title ? `Title: ${title}` : '',
    description ? `Description: ${description}` : '',
    canonicalHref ? `Canonical URL: ${decodeHtmlEntities(canonicalHref)}` : '',
  ].filter(Boolean)
  return lines.length ? ['## Page Metadata', ...lines].join('\n') : ''
}

function readMetaContent(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i')
  const tag = html.match(regex)?.[0]
  const content = tag?.match(/content=["']([^"']+)["']/i)?.[1]
  return content ? decodeHtmlEntities(content).trim().slice(0, 500) : null
}

function extractJsonLdText(html: string): string {
  const blocks = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 8)

  const lines: string[] = []
  for (const block of blocks) {
    try {
      const parsed: unknown = JSON.parse(block)
      lines.push(...flattenStructuredJsonLd(parsed).slice(0, 40))
    } catch {
      // Invalid site JSON-LD should not fail the import.
    }
  }
  return lines.length ? ['## Structured Website Data', ...lines].join('\n') : ''
}

function flattenStructuredJsonLd(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => flattenStructuredJsonLd(item, prefix))
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  const graph = record['@graph']
  if (Array.isArray(graph)) return graph.flatMap((item) => flattenStructuredJsonLd(item, prefix))
  const label = scalarJsonLd(record.name) ?? scalarJsonLd(record.headline) ?? scalarJsonLd(record['@type']) ?? 'Structured item'
  const lines = [`### ${label}`]
  for (const [key, item] of Object.entries(record)) {
    if (key.startsWith('@') || key === 'name' || key === 'headline') continue
    const scalar = scalarJsonLd(item)
    if (scalar) lines.push(`- ${humanizeLabel(key)}: ${scalar}`)
  }
  return prefix ? lines.map((line) => `${prefix}${line}`) : lines
}

function scalarJsonLd(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 500)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const scalars = value.map(scalarJsonLd).filter((item): item is string => Boolean(item)).slice(0, 8)
    return scalars.length ? scalars.join(', ') : null
  }
  return null
}

function extractTablesText(html: string): string {
  const tables = Array.from(html.matchAll(/<table[\s\S]*?<\/table>/gi))
    .map((match, index) => {
      const table = match[0]
      const rows = Array.from(table.matchAll(/<tr[\s\S]*?<\/tr>/gi))
        .map((rowMatch) => Array.from(rowMatch[0].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi))
          .map((cell) => cleanHtmlToText(cell[1] ?? '').replace(/\n+/g, ' / '))
          .filter(Boolean))
        .filter((row) => row.length > 0)
      if (rows.length === 0) return ''
      const width = Math.max(...rows.map((row) => row.length))
      const normalized = rows.map((row) => Array.from({ length: width }, (_item, rowIndex) => row[rowIndex] ?? ''))
      const header = normalized[0]
      const separator = header.map(() => '---')
      return [`### Table ${index + 1}`, ...[header, separator, ...normalized.slice(1)].map((row) => `| ${row.join(' | ')} |`)].join('\n')
    })
    .filter(Boolean)
    .slice(0, 12)
  return tables.length ? ['## Structured Tables', ...tables].join('\n\n') : ''
}

function extractContactLinksText(html: string): string {
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
  const lines = new Set<string>()
  for (const [, href = '', labelHtml = ''] of links) {
    const label = cleanHtmlToText(labelHtml)
    if (/^mailto:/i.test(href)) lines.add(`- Email: ${label ? `${label}: ` : ''}${href.replace(/^mailto:/i, '').split('?')[0]}`)
    if (/^tel:/i.test(href)) lines.add(`- Phone: ${label ? `${label}: ` : ''}${href.replace(/^tel:/i, '')}`)
    if (/wa\.me|whatsapp/i.test(href)) lines.add(`- WhatsApp: ${label ? `${label}: ` : ''}${href}`)
  }
  return lines.size ? ['## Contact Links', ...Array.from(lines)].join('\n') : ''
}

function extractFooterText(html: string): string {
  const footers = Array.from(html.matchAll(/<footer[\s\S]*?<\/footer>/gi))
    .map((match) => cleanHtmlToText(match[0]).slice(0, 6000))
    .filter((value) => value.length >= 20)
    .slice(0, 4)
  return footers.length ? ['## Footer Information', ...footers].join('\n\n') : ''
}

function extractHeadingHierarchyText(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html
  const nodes = Array.from(body.matchAll(/<(h[1-6]|p|li|address|time|summary)[^>]*>([\s\S]*?)<\/\1>/gi))
    .map((match) => {
      const tag = match[1]?.toLowerCase() ?? ''
      const text = cleanHtmlToText(match[2] ?? '')
      if (!text || text.length < 2) return ''
      if (/^h[1-6]$/.test(tag)) {
        const level = Math.min(6, Math.max(2, Number(tag.slice(1)) + 1))
        return `${'#'.repeat(level)} ${text}`
      }
      return text
    })
    .filter(Boolean)
    .filter(uniqueByLowercase)
    .slice(0, 500)
  return nodes.length ? ['## Page Content by Section', ...nodes].join('\n\n') : ''
}

function cleanHtmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/tr|h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 1)
    .filter(uniqueByLowercase)
    .join('\n')
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ')
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
}

function humanizeLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function uniqueByLowercase(value: string, index: number, values: string[]): boolean {
  return values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index
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

function normalizeKnowledgeLine(value: string): string {
  return value
    .replace(/^[#*\-\d.)\s|]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function lineLooksImportant(value: string): boolean {
  return /(?:[$€£₨₹]\s?\d|\d+(?:\.\d+)?\s?(?:%|off|gb|mb|tb|core|cpu|ram|nvme|ssd|month|year|day)|@|mailto:|tel:|wa\.me|whatsapp|phone|email|address|location|hours|open|company|registration|refund|return|shipping|delivery|policy|price|plan|package|service|product|menu|course|appointment|support|sales|faq|question|answer|test ip|\b\d{1,3}(?:\.\d{1,3}){3}\b)/i.test(value)
}

function lineLooksGlobalFact(value: string): boolean {
  return /(?:@|mailto:|tel:|wa\.me|whatsapp|phone|email|address|hours|company|registration|sales|support)/i.test(value)
}

function removeJunkFromContent(content: string): string {
  return cleanRagKnowledgeContent(content
    .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => {
      if (!line) return false
      if (line.length > 2_000 && !lineLooksImportant(line)) return false
      if (/^[{}[\],:;"'`=<>/\\()._-]{8,}$/.test(line)) return false
      if (JUNK_LINE_PATTERNS.some((pattern) => pattern.test(line)) && !lineLooksImportant(line)) return false
      const codeSignals = (line.match(/[{}();=<>]/g) ?? []).length
      return !(codeSignals > 12 && !lineLooksImportant(line))
    })
    .join('\n'))
}

function pageContentLooksLowValue(page: ImportedWebsitePage): boolean {
  const normalized = normalizeKnowledgeLine(`${page.title ?? ''} ${page.url} ${page.content.slice(0, 1200)}`)
  if (/hello world|welcome to wordpress|uncategorized/.test(normalized)) return true
  if (/submit ticket|open ticket|client area|login|register|password/.test(normalized) && !/support email|phone|whatsapp|hours|address/.test(normalized)) {
    return true
  }
  if (/^<\?xml|<urlset|<sitemapindex/.test(page.content.trim())) return true
  return false
}

function lineFrequencies(pages: ReadonlyArray<ImportedWebsitePage>): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const page of pages) {
    const seenOnPage = new Set<string>()
    for (const line of removeJunkFromContent(page.content).split('\n')) {
      const key = normalizeKnowledgeLine(line)
      if (key.length < 8 || seenOnPage.has(key)) continue
      seenOnPage.add(key)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

function cleanPageForKnowledge(
  page: ImportedWebsitePage,
  frequencies: ReadonlyMap<string, number>,
): ImportedWebsitePage {
  const pageSeen = new Set<string>()
  const lines = removeJunkFromContent(page.content)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const key = normalizeKnowledgeLine(line)
      if (!key) return false
      if (pageSeen.has(key)) return false
      pageSeen.add(key)
      const repeatedAcrossPages = (frequencies.get(key) ?? 0) > 2
      if (repeatedAcrossPages && lineLooksGlobalFact(line)) return false
      return !repeatedAcrossPages || lineLooksImportant(line)
    })

  return {
    ...page,
    content: cleanRagKnowledgeContent(lines.join('\n')),
  }
}

function collectMatches(content: string, pattern: RegExp): ReadonlyArray<string> {
  return Array.from(content.matchAll(pattern))
    .map((match) => match[0]?.trim())
    .filter((value): value is string => Boolean(value))
    .filter(uniqueByLowercase)
    .slice(0, 40)
}

function extractGlobalBusinessFacts(
  pages: ReadonlyArray<ImportedWebsitePage>,
  startUrl: string,
): string {
  const combined = pages.map((page) => page.content).join('\n')
  const emails = collectMatches(combined, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
  const whatsapp = collectMatches(combined, /(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com)\/[^\s)'"<>]+/gi)
  const phones = collectMatches(combined, /(?:\+?\d[\d\s().-]{7,}\d)/g)
    .filter((phone) => !/\b(?:20\d{2}|19\d{2})\b/.test(phone) || /[+\s().-]/.test(phone))
    .slice(0, 12)
  const urls = collectMatches(combined, /https?:\/\/[^\s)'"<>]+/gi).slice(0, 12)
  const companyDetails = combined
    .split('\n')
    .filter((line) => /\b(company|legal|registration|registered|company number|tax|vat|llc|ltd|limited|inc)\b/i.test(line))
    .filter(uniqueByLowercase)
    .slice(0, 12)
  const locations = combined
    .split('\n')
    .filter((line) => /\b(address|location|located|office|branch|country|city|test ip|ip address|opening hours|hours)\b/i.test(line))
    .filter(uniqueByLowercase)
    .slice(0, 20)

  const lines = [
    '# Global Business Facts',
    `Website: ${startUrl}`,
    emails.length ? `Support/contact emails: ${emails.join(', ')}` : '',
    whatsapp.length ? `WhatsApp links: ${whatsapp.join(', ')}` : '',
    phones.length ? `Phone numbers: ${phones.join(', ')}` : '',
    urls.length ? `Important links: ${urls.join(', ')}` : '',
    companyDetails.length ? ['Company/legal details:', ...companyDetails.map((line) => `- ${line}`)].join('\n') : '',
    locations.length ? ['Locations/hours/address facts:', ...locations.map((line) => `- ${line}`)].join('\n') : '',
  ].filter(Boolean)

  return lines.join('\n')
}

type StructuredSectionKey =
  | 'products'
  | 'pricing'
  | 'locations'
  | 'faqs'
  | 'policies'
  | 'pageSummaries'

function pageSectionKey(page: ImportedWebsitePage): StructuredSectionKey {
  const value = normalizeKnowledgeLine(`${page.title ?? ''} ${page.url} ${page.content.slice(0, 2000)}`)
  if (/faq|frequently asked|question|answer/.test(value)) return 'faqs'
  if (/refund-policy|return-policy|privacy|terms|policy|cancellation/.test(value)) return 'policies'
  if (/location|address|test ip|opening hours|karachi|singapore|branch|office/.test(value)) return 'locations'
  if (/pricing|plan|package|billing|discount|monthly|yearly|per month|per year/.test(value)) return 'pricing'
  if (/service|product|menu|course|appointment|feature|spec|treatment|program|catalog/.test(value)) return 'products'
  if (/[$€£₨₹]\s?\d|price|pricing|plan|package|billing|discount|monthly|yearly|per month|per year/.test(value)) return 'pricing'
  if (/refund|return|privacy|terms|policy|shipping|delivery|cancellation/.test(value)) return 'policies'
  return 'pageSummaries'
}

function sectionTitleForKey(key: StructuredSectionKey): string {
  if (key === 'products') return '# Products and Services'
  if (key === 'pricing') return '# Plans / Packages / Pricing'
  if (key === 'locations') return '# Locations'
  if (key === 'faqs') return '# FAQs'
  if (key === 'policies') return '# Policies'
  return '# Page Summaries'
}

function pagePurposeForKey(key: StructuredSectionKey): string {
  if (key === 'products') return 'Products, services, features, specs, menus, courses, appointments, or business offerings.'
  if (key === 'pricing') return 'Pricing, plans, packages, billing, discounts, or comparison details.'
  if (key === 'locations') return 'Locations, addresses, opening hours, regional availability, or test IP/location facts.'
  if (key === 'faqs') return 'Customer questions and answers.'
  if (key === 'policies') return 'Policies, terms, refunds, returns, shipping, delivery, privacy, or cancellation details.'
  return 'General page summary and useful business facts.'
}

function buildStructuredPageBlock(page: ImportedWebsitePage, key: StructuredSectionKey): string {
  return [
    `## Page: ${page.title ?? page.url}`,
    `URL: ${page.url}`,
    `Purpose: ${pagePurposeForKey(key)}`,
    'Important facts:',
    page.content,
  ].join('\n\n')
}

function buildWebsiteKnowledgeContent(args: {
  readonly pages: ReadonlyArray<ImportedWebsitePage>
  readonly startUrl: string
}): {
  readonly content: string
  readonly savedCharacters: number
  readonly capped: boolean
  readonly rawCharacters: number
  readonly duplicateJunkCharactersRemoved: number
  readonly lowValuePagesSkipped: number
  readonly aiStructuringUsed: boolean
  readonly deterministicFallbackUsed: boolean
} {
  const rawCharacters = args.pages.reduce((sum, page) => sum + page.rawCharacters, 0)
  const usefulPages = args.pages.filter((page) => !pageContentLooksLowValue(page))
  const lowValuePagesSkipped = args.pages.length - usefulPages.length
  const frequencies = lineFrequencies(usefulPages)
  const cleanedPages = usefulPages
    .map((page) => cleanPageForKnowledge(page, frequencies))
    .filter((page) => page.content.length >= MIN_USEFUL_PAGE_CHARACTERS)

  const grouped: Record<StructuredSectionKey, string[]> = {
    products: [],
    pricing: [],
    locations: [],
    faqs: [],
    policies: [],
    pageSummaries: [],
  }
  const cleanedPageCharacters = cleanedPages.reduce((sum, page) => sum + page.content.length, 0)

  for (const page of cleanedPages) {
    const key = pageSectionKey(page)
    grouped[key].push(buildStructuredPageBlock(page, key))
  }

  const sections: string[] = [
    `# Website Knowledge Import`,
    `Source website: ${args.startUrl}`,
    `Imported pages: ${cleanedPages.length}`,
    `Skipped low-value pages: ${lowValuePagesSkipped}`,
    `Raw characters collected: ${rawCharacters}`,
    extractGlobalBusinessFacts(usefulPages, args.startUrl),
  ]
  let length = sections.join('\n\n').length
  let capped = false

  for (const key of ['pricing', 'products', 'locations', 'faqs', 'policies', 'pageSummaries'] as const) {
    if (grouped[key].length === 0) continue
    const section = [sectionTitleForKey(key), ...grouped[key]].join('\n\n')
    const nextLength = length + section.length + 2

    if (nextLength > RAG_KNOWLEDGE_CHARACTER_LIMIT) {
      const remaining = RAG_KNOWLEDGE_CHARACTER_LIMIT - length - 2
      if (remaining > 200) sections.push(section.slice(0, remaining).trim())
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
    rawCharacters,
    duplicateJunkCharactersRemoved: Math.max(0, rawCharacters - cleanedPageCharacters),
    lowValuePagesSkipped,
    aiStructuringUsed: false,
    deterministicFallbackUsed: false,
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
    crawl: async (url, limit) => crawlWithFirecrawl(apiKey, url, limit),
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

async function crawlWithFirecrawl(
  apiKey: string,
  url: string,
  limit: number,
): Promise<ReadonlyArray<FirecrawlCrawlPage>> {
  const started = await firecrawlRequest('/crawl', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      url,
      limit,
      sitemap: 'include',
      crawlEntireDomain: true,
      allowExternalLinks: false,
      allowSubdomains: false,
      ignoreQueryParameters: true,
      deduplicateSimilarURLs: true,
      excludePaths: Array.from(PRIVATE_PATH_SEGMENTS).map((segment) => `(^|/)${segment}(/|$)`),
      maxConcurrency: Math.min(5, limit),
      scrapeOptions: {
        formats: ['markdown', 'rawHtml', 'links'],
        onlyMainContent: false,
        removeBase64Images: true,
        blockAds: true,
        proxy: 'auto',
        storeInCache: true,
      },
    }),
  })
  const crawlId = typeof started.id === 'string' ? started.id : null
  if (!crawlId) throw new Error('Firecrawl did not return a crawl job ID.')

  const deadline = Date.now() + FIRECRAWL_CRAWL_MAX_WAIT_MS
  let latest: FirecrawlCrawlResponse | null = null
  while (Date.now() < deadline) {
    latest = await firecrawlRequest(`/crawl/${encodeURIComponent(crawlId)}`, apiKey)
    if (latest.status === 'completed') break
    if (latest.status === 'failed' || latest.status === 'cancelled') {
      throw new Error(`Firecrawl crawl ${latest.status}.`)
    }
    await new Promise((resolve) => setTimeout(resolve, FIRECRAWL_CRAWL_POLL_INTERVAL_MS))
  }

  if (!latest || latest.status !== 'completed') {
    throw new Error('Firecrawl crawl did not complete before the local import timeout.')
  }

  const pages: FirecrawlCrawlPage[] = []
  if (Array.isArray(latest.data)) pages.push(...latest.data)

  let nextUrl = latest.next
  const visited = new Set<string>()
  while (nextUrl && !visited.has(nextUrl) && visited.size < 100) {
    visited.add(nextUrl)
    const next = await firecrawlRequest(nextUrl, apiKey)
    if (Array.isArray(next.data)) pages.push(...next.data)
    nextUrl = next.next
  }

  return pages
}

async function firecrawlRequest(
  pathOrUrl: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<FirecrawlCrawlResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FIRECRAWL_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(pathOrUrl.startsWith('http') ? pathOrUrl : `${FIRECRAWL_V2_BASE_URL}${pathOrUrl}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({})) as FirecrawlCrawlResponse
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error || `Firecrawl returned HTTP ${response.status}.`)
    }
    return payload
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Firecrawl request timed out.')
    }
    throw error
  } finally {
    clearTimeout(timer)
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
  const importedPages: ImportedWebsitePage[] = []
  const seenHashes = new Set<string>()
  let pagesFailed = 0
  let duplicatePages = 0
  let crawlPagesFound = 0

  function addImportedPage(pageUrl: string, extracted: ExtractedWebsiteContent): void {
    const finalUrl = normalizeWebsiteCandidateUrl(extracted.finalUrl ?? pageUrl, args.startUrl) ?? pageUrl
    const skipReason = unsafeWebsiteSkipReason(finalUrl, args.startUrl)
    if (skipReason) {
      addReason(skippedReasons, skipReason)
      return
    }

    if (extracted.content.length < MIN_USEFUL_PAGE_CHARACTERS) {
      addReason(skippedReasons, 'not_enough_text')
      return
    }

    const hash = hashContent(extracted.content)
    if (seenHashes.has(hash)) {
      duplicatePages += 1
      addReason(skippedReasons, 'duplicate_content')
      return
    }

    seenHashes.add(hash)
    importedPages.push({
      url: finalUrl,
      title: extracted.title,
      content: extracted.content,
      hash,
      rawCharacters: extracted.content.length,
    })
  }

  if (args.client.crawl) {
    try {
      const crawlPages = await args.client.crawl(args.startUrl, pageLimit)
      crawlPagesFound = crawlPages.length
      for (const page of crawlPages.slice(0, pageLimit)) {
        const pageUrl = page.metadata?.sourceURL ?? page.metadata?.url ?? args.startUrl
        addImportedPage(pageUrl, extractFirecrawlCrawlPageContent(page))
      }
      if (crawlPages.length > pageLimit) addReason(skippedReasons, 'page_limit_reached')
    } catch {
      addReason(skippedReasons, 'firecrawl_crawl_unavailable_map_fallback')
    }
  }

  if (importedPages.length === 0) {
    try {
      mappedUrls = readFirecrawlMapUrls(await args.client.map(args.startUrl, pageLimit))
    } catch {
      addReason(skippedReasons, 'map_unavailable_single_url_fallback')
    }
  }

  const discovered = discoverWebsiteUrls({
    startUrl: args.startUrl,
    mappedUrls,
    pageLimit,
  })
  for (const [reason, count] of discovered.skippedReasons) {
    skippedReasons.set(reason, (skippedReasons.get(reason) ?? 0) + count)
  }

  if (importedPages.length === 0) {
    for (const pageUrl of discovered.urls) {
      try {
        const scraped = await args.client.scrape(pageUrl)
        addImportedPage(pageUrl, extractFirecrawlContent(scraped))
      } catch {
        pagesFailed += 1
        addReason(skippedReasons, 'scrape_failed')
      }
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
  if (built.lowValuePagesSkipped > 0) {
    skippedReasons.set(
      'low_value_page_content',
      (skippedReasons.get('low_value_page_content') ?? 0) + built.lowValuePagesSkipped,
    )
  }

  return {
    title: safeWebsiteTitle(args.startUrl, importedPages[0]?.title),
    content: built.content,
    finalUrl: importedPages[0]?.url ?? args.startUrl,
    stats: {
      startUrl: args.startUrl,
      pagesFound: Math.max(crawlPagesFound, discovered.discovered.length),
      pagesImported: importedPages.length - built.lowValuePagesSkipped,
      pagesSkipped: Array.from(skippedReasons.values()).reduce((sum, count) => sum + count, 0),
      pagesFailed,
      duplicatePages,
      rawCharacters: built.rawCharacters,
      duplicateJunkCharactersRemoved: built.duplicateJunkCharactersRemoved,
      savedCharacters: built.savedCharacters,
      capped: built.capped,
      pageLimit,
      lowValuePagesSkipped: built.lowValuePagesSkipped,
      aiStructuringUsed: built.aiStructuringUsed,
      deterministicFallbackUsed: built.deterministicFallbackUsed,
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
