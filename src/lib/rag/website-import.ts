import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { createRagWebsiteKnowledge, type RagKnowledgeDetail } from './knowledge-store'
import { cleanRagKnowledgeContent, RAG_KNOWLEDGE_CHARACTER_LIMIT } from './knowledge'
import { sanitizeProviderError } from './security'

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v1/scrape'

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

export interface RagWebsiteImportResult {
  readonly source: RagKnowledgeDetail
  readonly message: string
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

function extractFirecrawlContent(response: FirecrawlScrapeResponse): {
  readonly title: string | null
  readonly finalUrl: string | null
  readonly content: string
} {
  const data = response.data
  const content = cleanRagKnowledgeContent(
    data?.markdown ?? data?.text ?? data?.html ?? '',
  )

  return {
    title: data?.metadata?.title ?? data?.metadata?.ogTitle ?? null,
    finalUrl: data?.metadata?.sourceURL ?? data?.metadata?.url ?? null,
    content,
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

async function scrapeWithFirecrawl(args: {
  readonly apiKey: string
  readonly url: string
}): Promise<FirecrawlScrapeResponse> {
  const response = await fetch(FIRECRAWL_SCRAPE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: args.url,
      formats: ['markdown'],
      onlyMainContent: false,
    }),
  })

  const payload = await response.json().catch(() => ({})) as FirecrawlScrapeResponse
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Import failed.')
  }
  return payload
}

export async function importRagWebsiteKnowledge(args: {
  readonly workspaceId: string
  readonly userId: string
  readonly url: string
}): Promise<RagWebsiteImportResult> {
  const url = validateRagWebsiteUrl(args.url)
  const apiKey = await getFirecrawlApiKey(args.workspaceId)

  let scraped: FirecrawlScrapeResponse
  try {
    scraped = await scrapeWithFirecrawl({ apiKey, url })
  } catch (error) {
    throw new Error(sanitizeProviderError(error) || 'Import failed.')
  }

  const extracted = extractFirecrawlContent(scraped)
  if (!extracted.content) {
    throw new Error('No readable website content was found.')
  }
  if (extracted.content.length > RAG_KNOWLEDGE_CHARACTER_LIMIT) {
    throw new Error('This website content is too large. Please import a smaller page or reduce the content.')
  }

  const finalUrl = extracted.finalUrl ?? url
  const source = await createRagWebsiteKnowledge({
    workspaceId: args.workspaceId,
    userId: args.userId,
    title: safeWebsiteTitle(finalUrl, extracted.title),
    content: extracted.content,
    sourceUrl: url,
    finalUrl,
  })

  return {
    source,
    message: 'Website imported successfully.',
  }
}

export const __ragWebsiteImportTestUtils = {
  extractFirecrawlContent,
  safeWebsiteTitle,
}
