import { createHash } from 'node:crypto'

export type WebsiteImportPageStatus = 'imported' | 'skipped' | 'failed' | 'duplicate'

export interface WebsiteImportPage {
  readonly url: string
  readonly canonicalUrl: string | null
  readonly title: string | null
  readonly metaDescription: string | null
  readonly rawText: string | null
  readonly cleanedText: string | null
  readonly contentHash: string | null
  readonly status: WebsiteImportPageStatus
  readonly skipReason: string | null
  readonly httpStatus: number | null
}

export interface WebsiteImportResult {
  readonly startUrl: string
  readonly normalizedOrigin: string
  readonly pages: WebsiteImportPage[]
  readonly draftTitle: string
  readonly draftContent: string
  readonly pagesFound: number
  readonly pagesImported: number
  readonly pagesSkipped: number
  readonly pagesFailed: number
  readonly duplicatePages: number
}

interface CrawlOptions {
  readonly startUrl: string
  readonly pageLimit?: number
  readonly timeoutMs?: number
  readonly fetchImpl?: typeof fetch
}

interface RobotsRules {
  readonly disallow: string[]
}

const DEFAULT_PAGE_LIMIT = 50
const MAX_PAGE_LIMIT = 100
const DEFAULT_TIMEOUT_MS = 8_000
const MAX_RECORDED_SKIPS = 120
export const MAX_WEBSITE_DRAFT_CONTENT_LENGTH = 200_000

const SKIP_PATH_PARTS = [
  'login',
  'admin',
  'account',
  'cart',
  'checkout',
  'wp-admin',
  'media',
  'uploads',
  'gallery',
  'image',
  'tag',
  'author',
  'search',
]

const SKIP_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.pdf',
  '.zip',
  '.mp4',
  '.mp3',
  '.avi',
  '.mov',
  '.webm',
  '.css',
  '.js',
  '.ico',
]

export function normalizeWebsiteUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Website URL is required.')

  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(withProtocol)
  } catch {
    throw new Error('Enter a valid website URL.')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS website URLs are supported.')
  }
  if (!parsed.hostname || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
    throw new Error('Enter a public website URL.')
  }

  parsed.hash = ''
  parsed.search = ''
  parsed.pathname = normalizePath(parsed.pathname)
  return parsed.toString()
}

export function isSameOrigin(candidate: string, origin: string): boolean {
  try {
    return new URL(candidate).origin === origin
  } catch {
    return false
  }
}

export function shouldSkipWebsiteUrl(candidate: string, origin: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return 'invalid_url'
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return 'unsupported_protocol'
  if (parsed.origin !== origin) return 'external_domain'

  const pathname = parsed.pathname.toLowerCase()
  if (SKIP_EXTENSIONS.some((extension) => pathname.endsWith(extension))) return 'media_or_file_url'
  if (SKIP_PATH_PARTS.some((part) => pathname.includes(part))) return 'private_or_low_value_path'
  if (pathname.includes('privacy-policy') || pathname.includes('terms')) return 'policy_page_skipped'

  return null
}

export async function crawlWebsiteForKnowledge(options: CrawlOptions): Promise<WebsiteImportResult> {
  const startUrl = normalizeWebsiteUrl(options.startUrl)
  const start = new URL(startUrl)
  const origin = start.origin
  const pageLimit = clampPageLimit(options.pageLimit)
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const robots = await loadRobotsRules(origin, fetchImpl, timeoutMs)
  const sitemapUrls = await discoverSitemapUrls(origin, fetchImpl, timeoutMs)

  const queue: string[] = []
  const queued = new Set<string>()
  const seenCanonical = new Set<string>()
  const seenHashes = new Set<string>()
  const pages: WebsiteImportPage[] = []
  let recordedSkips = 0

  function recordSkipped(url: string, reason: string) {
    if (recordedSkips >= MAX_RECORDED_SKIPS) return
    recordedSkips += 1
    pages.push({
      url,
      canonicalUrl: null,
      title: null,
      metaDescription: null,
      rawText: null,
      cleanedText: null,
      contentHash: null,
      status: 'skipped',
      skipReason: reason,
      httpStatus: null,
    })
  }

  function enqueue(candidate: string) {
    const normalized = normalizeCandidateUrl(candidate, origin)
    if (!normalized) return
    if (queued.has(normalized)) return
    const skipReason = shouldSkipWebsiteUrl(normalized, origin)
    if (skipReason) {
      recordSkipped(normalized, skipReason)
      return
    }
    if (isRobotsDisallowed(normalized, robots)) {
      recordSkipped(normalized, 'robots_disallowed')
      return
    }
    queued.add(normalized)
    queue.push(normalized)
  }

  enqueue(startUrl)
  for (const sitemapUrl of sitemapUrls) enqueue(sitemapUrl)

  while (queue.length > 0 && pages.filter((page) => page.status === 'imported').length < pageLimit) {
    const url = queue.shift()
    if (!url) break

    let response: Response
    try {
      response = await fetchText(url, fetchImpl, timeoutMs)
    } catch {
      pages.push(failedPage(url, 'request_failed'))
      continue
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (!response.ok) {
      pages.push(failedPage(url, `http_${response.status}`, response.status))
      continue
    }
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      pages.push({ ...failedPage(url, 'non_html_content', response.status), status: 'skipped' })
      continue
    }

    const html = await response.text()
    const canonical = normalizeCandidateUrl(extractCanonicalUrl(html, url) ?? url, origin)
    if (!canonical) {
      pages.push(failedPage(url, 'invalid_canonical', response.status))
      continue
    }
    if (seenCanonical.has(canonical)) {
      pages.push(duplicatePage(url, canonical, 'duplicate_url', response.status))
      continue
    }

    const title = extractTagContent(html, 'title') ?? hostTitle(start.hostname)
    const metaDescription = extractMetaDescription(html)
    const rawText = extractWebsiteKnowledgeText(html)
    const cleanedText = normalizeExtractedText(rawText)

    if (cleanedText.length < 120) {
      pages.push({
        url,
        canonicalUrl: canonical,
        title,
        metaDescription,
        rawText,
        cleanedText,
        contentHash: null,
        status: 'skipped',
        skipReason: 'not_enough_text',
        httpStatus: response.status,
      })
      continue
    }

    const contentHash = hashContent(cleanedText)
    if (seenHashes.has(contentHash)) {
      pages.push(duplicatePage(url, canonical, 'duplicate_content', response.status, title, metaDescription, contentHash))
      continue
    }

    seenCanonical.add(canonical)
    seenHashes.add(contentHash)
    pages.push({
      url,
      canonicalUrl: canonical,
      title,
      metaDescription,
      rawText,
      cleanedText,
      contentHash,
      status: 'imported',
      skipReason: null,
      httpStatus: response.status,
    })

    if (queued.size < pageLimit * 8) {
      for (const link of extractLinks(html, url)) enqueue(link)
    }
  }

  const importedPages = pages.filter((page) => page.status === 'imported')
  const draftTitle = `${hostTitle(start.hostname)} website knowledge`
  const draftContent = buildWebsiteKnowledgeDraft(importedPages)

  return {
    startUrl,
    normalizedOrigin: origin,
    pages,
    draftTitle,
    draftContent,
    pagesFound: queued.size,
    pagesImported: importedPages.length,
    pagesSkipped: pages.filter((page) => page.status === 'skipped').length,
    pagesFailed: pages.filter((page) => page.status === 'failed').length,
    duplicatePages: pages.filter((page) => page.status === 'duplicate').length,
  }
}

export function buildWebsiteKnowledgeDraft(pages: readonly WebsiteImportPage[]): string {
  const importedPages = pages.filter((page) => page.status === 'imported' && page.cleanedText)
  const combinedContent = importedPages
    .filter((page) => page.status === 'imported' && page.cleanedText)
    .map((page) => {
      const parts = [
        `Page: ${page.title ?? page.canonicalUrl ?? page.url}`,
        `URL: ${page.canonicalUrl ?? page.url}`,
        page.metaDescription ? `Summary: ${page.metaDescription}` : '',
        page.cleanedText,
      ].filter(Boolean)
      return parts.join('\n')
    })
    .join('\n\n---\n\n')

  const pageList = importedPages
    .map((page) => `- ${page.title ?? page.canonicalUrl ?? page.url}: ${page.canonicalUrl ?? page.url}`)
    .join('\n')

  return [
    '# Website Knowledge Summary',
    'Review and edit this imported website knowledge before publishing it to the chatbot.',
    '',
    '## Important Pages Imported',
    pageList,
    '',
    '## Business Overview, Services, Pricing, FAQs and Policies',
    combinedContent,
  ]
    .join('\n')
    .slice(0, MAX_WEBSITE_DRAFT_CONTENT_LENGTH)
}

export function extractWebsiteKnowledgeText(html: string): string {
  const structuredParts = [
    extractTablesAsMarkdown(html),
    extractPricingCardsAsText(html),
    extractFaqSectionsAsText(html),
  ].filter(Boolean)

  return [...structuredParts, cleanHtmlToText(html)].join('\n\n')
}

export function cleanHtmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<(nav|header|footer|aside|form|button)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return decodeHtmlEntities(withoutScripts)
}

export function extractTablesAsMarkdown(html: string): string {
  const tables = Array.from(html.matchAll(/<table[\s\S]*?<\/table>/gi))
    .map((match) => tableHtmlToMarkdown(match[0] ?? ''))
    .filter(Boolean)

  if (tables.length === 0) return ''
  return ['## Structured Tables', ...tables.map((table, index) => `### Table ${index + 1}\n${table}`)].join('\n\n')
}

export function extractPricingCardsAsText(html: string): string {
  const cardMatches = extractElementsByAttributeKeyword(html, [
    'pricing',
    'price',
    'plan',
    'package',
    'tier',
    'ncard',
    'ngrid',
    'npname',
    'np-price',
  ])

  const cards = cardMatches
    .map((cardHtml) => structurePricingCardText(normalizeExtractedText(cleanHtmlToText(cardHtml))))
    .filter((text) => text.length >= 40 && looksLikePricingContent(text))
    .filter(uniqueByLowercase)
    .slice(0, 20)

  if (cards.length === 0) return ''
  return ['## Pricing / Plans', ...cards.map((card, index) => `### Pricing card ${index + 1}\n${card}`)].join('\n\n')
}

export function extractFaqSectionsAsText(html: string): string {
  const faqMatches = Array.from(
    html.matchAll(/<(section|article|div)[^>]*(?:class|id)=["'][^"']*(?:faq|accordion|question|answers?)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi),
  )

  const faqs = faqMatches
    .map((match) => normalizeExtractedText(cleanHtmlToText(match[0] ?? '')))
    .filter((text) => text.length >= 40)
    .filter(uniqueByLowercase)
    .slice(0, 20)

  if (faqs.length === 0) return ''
  return ['## FAQs', ...faqs.map((faq, index) => `### FAQ section ${index + 1}\n${faq}`)].join('\n\n')
}

export function normalizeExtractedText(value: string): string {
  const lines = value
    .replace(/\u00a0/g, ' ')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 1)

  const seen = new Set<string>()
  const uniqueLines: string[] = []
  for (const line of lines) {
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    uniqueLines.push(line)
  }
  return uniqueLines.join('\n').trim()
}

export function hashContent(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

async function loadRobotsRules(origin: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<RobotsRules> {
  try {
    const response = await fetchText(`${origin}/robots.txt`, fetchImpl, timeoutMs)
    if (!response.ok) return { disallow: [] }
    return parseRobotsTxt(await response.text())
  } catch {
    return { disallow: [] }
  }
}

export function parseRobotsTxt(value: string): RobotsRules {
  const disallow: string[] = []
  let applies = false
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? ''
    if (!line) continue
    const [rawKey, ...rest] = line.split(':')
    const key = rawKey?.trim().toLowerCase()
    const content = rest.join(':').trim()
    if (key === 'user-agent') {
      applies = content === '*'
    }
    if (applies && key === 'disallow' && content) {
      disallow.push(content)
    }
  }
  return { disallow }
}

function isRobotsDisallowed(candidate: string, rules: RobotsRules): boolean {
  const path = new URL(candidate).pathname
  return rules.disallow.some((rule) => rule !== '/' && path.startsWith(rule))
}

async function discoverSitemapUrls(origin: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<string[]> {
  try {
    const response = await fetchText(`${origin}/sitemap.xml`, fetchImpl, timeoutMs)
    if (!response.ok) return []
    const xml = await response.text()
    return Array.from(xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi))
      .map((match) => decodeHtmlEntities(match[1] ?? '').trim())
      .filter(Boolean)
      .slice(0, 300)
  } catch {
    return []
  }
}

async function fetchText(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.7,*/*;q=0.5',
        'user-agent': 'TalkWagonAIKnowledgeImporter/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

function extractLinks(html: string, baseUrl: string): string[] {
  return Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
    .map((match) => match[1] ?? '')
    .map((href) => {
      try {
        return new URL(href, baseUrl).toString()
      } catch {
        return ''
      }
    })
    .filter(Boolean)
}

function extractCanonicalUrl(html: string, baseUrl: string): string | null {
  const match = html.match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i)
  const tag = match?.[0]
  if (!tag) return null
  const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
  if (!href) return null
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)
  const tag = match?.[0]
  const content = tag?.match(/content=["']([^"']+)["']/i)?.[1]
  return content ? decodeHtmlEntities(content).trim().slice(0, 300) : null
}

function extractTagContent(html: string, tagName: string): string | null {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  return match?.[1] ? normalizeExtractedText(cleanHtmlToText(match[1])).slice(0, 160) : null
}

function normalizeCandidateUrl(candidate: string, origin: string): string | null {
  try {
    const parsed = new URL(candidate, origin)
    parsed.hash = ''
    parsed.search = ''
    parsed.pathname = normalizePath(parsed.pathname)
    return parsed.toString()
  } catch {
    return null
  }
}

function normalizePath(pathname: string): string {
  const cleaned = pathname || '/'
  if (cleaned === '/') return '/'
  return cleaned.replace(/\/{2,}/g, '/').replace(/\/$/, '')
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

function tableHtmlToMarkdown(tableHtml: string): string {
  const rows = Array.from(tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi))
    .map((rowMatch) =>
      Array.from(rowMatch[0].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi))
        .map((cellMatch) => markdownCellText(cellMatch[2] ?? ''))
        .filter(Boolean),
    )
    .filter((row) => row.length > 0)

  if (rows.length === 0) return ''
  const width = Math.max(...rows.map((row) => row.length))
  const normalizedRows = rows.map((row) => Array.from({ length: width }, (_item, index) => row[index] ?? ''))
  const header = normalizedRows[0]
  const separator = header.map((cell) => (looksLikePriceHeader(cell) ? '---:' : '---'))
  const body = normalizedRows.slice(1)

  return [header, separator, ...body]
    .map((row) => `| ${row.map((cell) => cell || ' ').join(' | ')} |`)
    .join('\n')
}

function extractElementsByAttributeKeyword(html: string, keywords: readonly string[]): string[] {
  const results: string[] = []
  const seenStarts = new Set<number>()
  const pattern = /<(section|article|div)\b[^>]*(?:class|id)=["'][^"']*["'][^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(html))) {
    const opening = match[0] ?? ''
    const tagName = (match[1] ?? '').toLowerCase()
    if (!keywords.some((keyword) => opening.toLowerCase().includes(keyword))) continue
    if (seenStarts.has(match.index)) continue
    const element = readBalancedElement(html, match.index, tagName)
    if (!element) continue
    seenStarts.add(match.index)
    results.push(element)
  }

  return results
}

function readBalancedElement(html: string, startIndex: number, tagName: string): string | null {
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi')
  tagPattern.lastIndex = startIndex
  let depth = 0
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(html))) {
    const tag = match[0] ?? ''
    if (tag.startsWith(`</`)) {
      depth -= 1
      if (depth === 0) return html.slice(startIndex, tagPattern.lastIndex)
    } else if (!tag.endsWith('/>')) {
      depth += 1
    }
  }

  return null
}

function structurePricingCardText(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return ''

  const structured: string[] = []
  let index = 0
  const heading = lines[index]
  if (heading && heading.length <= 80) {
    structured.push(`### ${heading}`)
    index += 1
  }

  while (index < lines.length) {
    const current = lines[index] ?? ''
    const next = lines[index + 1] ?? ''
    const afterNext = lines[index + 2] ?? ''
    const inlinePrice = normalizeInlinePrice(current)

    if (inlinePrice) {
      structured.push(`- Price: ${inlinePrice}`)
      index += 1
      continue
    }

    if (isCurrencySymbol(current) && isAmount(next)) {
      const period = isBillingPeriod(afterNext) ? afterNext : ''
      structured.push(`- Price: ${current}${next}${period}`)
      index += period ? 3 : 2
      continue
    }

    if (isAmount(current) && isBillingPeriod(next)) {
      structured.push(`- Price: ${current}${next}`)
      index += 2
      continue
    }

    if (looksLikePlanSpec(current)) {
      structured.push(`- ${current}`)
    } else if (!/^buy now|order now|get started|select plan|choose plan/i.test(current)) {
      structured.push(current)
    }
    index += 1
  }

  return structured.join('\n')
}

function isCurrencySymbol(value: string): boolean {
  return /^[$£€₹]$|^(rs\.?|pkr|usd)$/i.test(value.trim())
}

function isAmount(value: string): boolean {
  return /^\d+(?:[.,]\d+)?$/.test(value.trim()) || /^[$£€₹]\s?\d+(?:[.,]\d+)?/i.test(value.trim())
}

function isBillingPeriod(value: string): boolean {
  return /^\/?\s?(mo|month|monthly|yr|year|yearly|quarter|quarterly|semi-annual|semi annual|2-year|3-year)$/i.test(value.trim())
}

function looksLikePlanSpec(value: string): boolean {
  return /\b(cpu|core|ram|gb|tb|nvme|ssd|storage|bandwidth|traffic|backup|ssl|domain|database|email|workflow|execution|memory)\b/i.test(value)
}

function normalizeInlinePrice(value: string): string | null {
  const trimmed = value.trim()
  const compact = trimmed.match(/^([$£€₹])\s*(\d+(?:[.,]\d+)?)\s*(\/?\s?(?:mo|month|monthly|yr|year|yearly|quarter|quarterly|semi-annual|semi annual|2-year|3-year))$/i)
  if (compact) {
    const period = compact[3]?.replace(/\s+/g, '') ?? ''
    return `${compact[1]}${compact[2]}${period}`
  }

  const named = trimmed.match(/^(USD|PKR|Rs\.?)\s+(\d[\d,.]*)\s*(\/?\s?(?:mo|month|monthly|yr|year|yearly|quarter|quarterly|semi-annual|semi annual|2-year|3-year))?$/i)
  if (named) {
    return [named[1], named[2], named[3]?.replace(/\s+/g, '')].filter(Boolean).join(' ')
  }

  return null
}

function markdownCellText(html: string): string {
  return normalizeExtractedText(cleanHtmlToText(html))
    .replace(/\n+/g, '<br>')
    .replace(/\|/g, '\\|')
    .trim()
}

function looksLikePriceHeader(value: string): boolean {
  return /\b(price|amount|cost|fee|rate|monthly|yearly|annual|billing)\b/i.test(value)
}

function looksLikePricingContent(value: string): boolean {
  return /(\$|£|€|₹|rs\.?|pkr|usd|month|monthly|year|yearly|annual|plan|package|price|discount|setup fee|included|features?)/i.test(value)
}

function uniqueByLowercase(value: string, index: number, values: string[]): boolean {
  return values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index
}

function duplicatePage(
  url: string,
  canonicalUrl: string,
  reason: string,
  httpStatus: number | null,
  title: string | null = null,
  metaDescription: string | null = null,
  contentHash: string | null = null,
): WebsiteImportPage {
  return {
    url,
    canonicalUrl,
    title,
    metaDescription,
    rawText: null,
    cleanedText: null,
    contentHash,
    status: 'duplicate',
    skipReason: reason,
    httpStatus,
  }
}

function failedPage(url: string, reason: string, httpStatus: number | null = null): WebsiteImportPage {
  return {
    url,
    canonicalUrl: null,
    title: null,
    metaDescription: null,
    rawText: null,
    cleanedText: null,
    contentHash: null,
    status: 'failed',
    skipReason: reason,
    httpStatus,
  }
}

function hostTitle(hostname: string): string {
  return hostname.replace(/^www\./, '').split('.')[0]?.replace(/-/g, ' ') || 'Website'
}

function clampPageLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value)) return DEFAULT_PAGE_LIMIT
  return Math.max(1, Math.min(MAX_PAGE_LIMIT, Math.floor(value)))
}
