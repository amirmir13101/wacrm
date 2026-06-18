import { createHash } from 'node:crypto'
import { load } from 'cheerio'

import type { FirecrawlCrawlPage } from '@/lib/ai/firecrawl'

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

export function buildWebsiteImportFromFirecrawl(args: {
  readonly startUrl: string
  readonly pages: readonly FirecrawlCrawlPage[]
}): WebsiteImportResult {
  const start = new URL(args.startUrl)
  const seenCanonical = new Set<string>()
  const seenHashes = new Set<string>()
  const pages: WebsiteImportPage[] = []

  for (const page of args.pages) {
    const metadata = page.metadata ?? {}
    const sourceUrl = readMetadataString(metadata, 'sourceURL') ?? readMetadataString(metadata, 'url') ?? args.startUrl
    const canonicalUrl = normalizeCandidateUrl(sourceUrl, start.origin)
    const title = readMetadataString(metadata, 'title')
    const metaDescription = readMetadataString(metadata, 'description')
    const statusCode = readMetadataNumber(metadata, 'statusCode')
    const error = readMetadataString(metadata, 'error')

    if (!canonicalUrl || !isSameOrigin(canonicalUrl, start.origin)) {
      pages.push(failedPage(sourceUrl, 'external_or_invalid_firecrawl_url', statusCode))
      continue
    }
    if (error || (statusCode !== null && statusCode >= 400)) {
      pages.push(failedPage(canonicalUrl, error ? `firecrawl_${slugReason(error)}` : `http_${statusCode}`, statusCode))
      continue
    }
    if (seenCanonical.has(canonicalUrl)) {
      pages.push(duplicatePage(canonicalUrl, canonicalUrl, 'duplicate_url', statusCode, title, metaDescription))
      continue
    }

    const rawHtml = page.rawHtml ?? page.html ?? ''
    const structuredText = rawHtml ? extractWebsiteKnowledgeText(rawHtml, canonicalUrl) : ''
    const markdown = normalizeExtractedText(page.markdown ?? '')
    const cleanedText = normalizeExtractedText([structuredText, markdown].filter(Boolean).join('\n\n'))
    if (cleanedText.length < 80) {
      pages.push({
        url: canonicalUrl,
        canonicalUrl,
        title,
        metaDescription,
        rawText: rawHtml || markdown,
        cleanedText,
        contentHash: null,
        status: 'skipped',
        skipReason: 'not_enough_text',
        httpStatus: statusCode,
      })
      continue
    }

    const contentHash = hashContent(cleanedText)
    if (seenHashes.has(contentHash)) {
      pages.push(duplicatePage(canonicalUrl, canonicalUrl, 'duplicate_content', statusCode, title, metaDescription, contentHash))
      continue
    }

    seenCanonical.add(canonicalUrl)
    seenHashes.add(contentHash)
    pages.push({
      url: canonicalUrl,
      canonicalUrl,
      title,
      metaDescription,
      rawText: rawHtml || markdown,
      cleanedText,
      contentHash,
      status: 'imported',
      skipReason: null,
      httpStatus: statusCode ?? 200,
    })
  }

  const importedPages = pages.filter((page) => page.status === 'imported')
  return {
    startUrl: args.startUrl,
    normalizedOrigin: start.origin,
    pages,
    draftTitle: `${hostTitle(start.hostname)} website knowledge`,
    draftContent: buildWebsiteKnowledgeDraft(importedPages),
    pagesFound: args.pages.length,
    pagesImported: importedPages.length,
    pagesSkipped: pages.filter((page) => page.status === 'skipped').length,
    pagesFailed: pages.filter((page) => page.status === 'failed').length,
    duplicatePages: pages.filter((page) => page.status === 'duplicate').length,
  }
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

export interface WebsiteDocumentMetadata {
  readonly title: string | null
  readonly description: string | null
  readonly canonicalUrl: string | null
  readonly openGraph: Readonly<Record<string, string>>
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
    const documentMetadata = extractWebsiteDocumentMetadata(html, url)
    const canonical = normalizeCandidateUrl(documentMetadata.canonicalUrl ?? url, origin)
    if (!canonical) {
      pages.push(failedPage(url, 'invalid_canonical', response.status))
      continue
    }
    if (seenCanonical.has(canonical)) {
      pages.push(duplicatePage(url, canonical, 'duplicate_url', response.status))
      continue
    }

    const title = documentMetadata.title ?? hostTitle(start.hostname)
    const metaDescription = documentMetadata.description
    const rawText = extractWebsiteKnowledgeText(html, url)
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

export function extractWebsiteKnowledgeText(html: string, pageUrl?: string): string {
  const structuredParts = [
    extractPageMetadataAsText(html, pageUrl),
    extractJsonLdAsText(html),
    extractBreadcrumbsAsText(html),
    extractTablesAsMarkdown(html),
    extractBusinessCardsAsText(html),
    extractBusinessDetailsAsText(html),
    extractFaqSectionsAsText(html),
    extractContactLinksAsText(html),
    extractFooterFactsAsText(html),
    extractPageHierarchyAsText(html),
  ].filter(Boolean)

  return [...structuredParts, cleanHtmlToText(html)].join('\n\n')
}

export function cleanHtmlToText(html: string): string {
  const $ = load(html)
  $('script, style, noscript, svg, head, nav, header, footer, aside, form, button').remove()
  $('br').replaceWith('\n')
  $('p, div, section, article, li, h1, h2, h3, h4, h5, h6, tr').each((_index, element) => {
    $(element).append('\n')
  })
  return decodeHtmlEntities($.root().text())
}

export function extractTablesAsMarkdown(html: string): string {
  const $ = load(html)
  const tables: string[] = []
  $('table').each((_index, element) => {
    const markdown = tableHtmlToMarkdown($.html(element))
    if (markdown) tables.push(markdown)
  })

  if (tables.length === 0) return ''
  return ['## Structured Tables', ...tables.map((table, index) => `### Table ${index + 1}\n${table}`)].join('\n\n')
}

export function extractPricingCardsAsText(html: string): string {
  return extractBusinessCardsAsText(html)
}

export function extractBusinessCardsAsText(html: string): string {
  const attributeCards = extractElementsByAttributeKeyword(html, [
    'pricing',
    'price',
    'plan',
    'package',
    'tier',
    'product',
    'service',
    'menu',
    'dish',
    'food',
    'course',
    'program',
    'treatment',
    'appointment',
    'booking',
    'offer',
    'deal',
    'catalog',
    'item',
    'ncard',
    'ngrid',
    'npname',
    'np-price',
  ])
  const repeatedCards = extractRepeatedContentBlocks(html)

  const cards = [
    ...repeatedCards.map((html) => ({ html, structurallyDetected: true })),
    ...attributeCards.map((html) => ({ html, structurallyDetected: false })),
  ]
    .map(({ html, structurallyDetected }) => ({
      text: structureBusinessCardText(normalizeExtractedText(cleanHtmlToText(html))),
      structurallyDetected,
    }))
    .filter(({ text, structurallyDetected }) => text.length >= 30 && (structurallyDetected || looksLikeBusinessCardContent(text)))
    .map(({ text }) => text)
    .filter(uniqueByLowercase)
    .slice(0, 40)

  if (cards.length === 0) return ''
  return ['## Products, Services, Plans and Pricing', ...cards].join('\n\n')
}

export function extractBusinessDetailsAsText(html: string): string {
  const $ = load(html)
  const sections = [
    {
      heading: '## Business Hours and Booking',
      keywords: ['hours', 'opening', 'schedule', 'appointment', 'booking', 'reservation'],
    },
    {
      heading: '## Contact and Locations',
      keywords: ['contact', 'location', 'address', 'branch', 'phone', 'email', 'map'],
    },
    {
      heading: '## Delivery, Returns and Policies',
      keywords: ['delivery', 'shipping', 'return', 'refund', 'policy', 'terms'],
    },
  ]

  return sections
    .map(({ heading, keywords }) => {
      const text: string[] = []
      $('[class], [id]').each((_index, element) => {
        const attributes = `${$(element).attr('class') ?? ''} ${$(element).attr('id') ?? ''}`.toLowerCase()
        if (!keywords.some((keyword) => attributes.includes(keyword))) return
        const value = normalizeExtractedText($(element).text())
        if (value.length >= 30) text.push(value)
      })
      const uniqueText = text
        .filter((value) => value.length >= 30)
        .filter(uniqueByLowercase)
        .slice(0, 12)
      return uniqueText.length > 0 ? [heading, ...uniqueText].join('\n\n') : ''
    })
    .filter(Boolean)
    .join('\n\n')
}

export function extractFaqSectionsAsText(html: string): string {
  const $ = load(html)
  const faqValues: string[] = []
  $('details').each((_index, element) => {
    const value = normalizeExtractedText($(element).text())
    if (value) faqValues.push(value)
  })
  $('[class], [id]').each((_index, element) => {
    const attributes = `${$(element).attr('class') ?? ''} ${$(element).attr('id') ?? ''}`.toLowerCase()
    if (!/(faq|accordion|question|answer)/.test(attributes)) return
    const value = normalizeExtractedText($(element).text())
    if (value) faqValues.push(value)
  })

  const faqs = faqValues
    .filter((text) => text.length >= 40)
    .filter(uniqueByLowercase)
    .slice(0, 20)

  if (faqs.length === 0) return ''
  return ['## FAQs', ...faqs.map((faq, index) => `### FAQ section ${index + 1}\n${faq}`)].join('\n\n')
}

export function extractWebsiteDocumentMetadata(html: string, baseUrl?: string): WebsiteDocumentMetadata {
  const $ = load(html)
  const title = normalizeOptionalText($('title').first().text(), 160)
  const description = normalizeOptionalText(
    $('meta[name="description" i]').first().attr('content') ?? $('meta[property="og:description" i]').first().attr('content'),
    300,
  )
  const canonicalHref = $('link[rel~="canonical" i]').first().attr('href')
  const canonicalUrl = resolveOptionalUrl(canonicalHref, baseUrl)
  const openGraph: Record<string, string> = {}
  $('meta[property^="og:" i], meta[name^="og:" i]').each((_index, element) => {
    const property = ($(element).attr('property') ?? $(element).attr('name') ?? '').trim().toLowerCase()
    const content = normalizeOptionalText($(element).attr('content'), 500)
    if (property && content && !openGraph[property]) openGraph[property] = content
  })
  return { title, description, canonicalUrl, openGraph }
}

export function extractPageMetadataAsText(html: string, baseUrl?: string): string {
  const metadata = extractWebsiteDocumentMetadata(html, baseUrl)
  const lines = [
    metadata.title ? `- Title: ${metadata.title}` : '',
    metadata.description ? `- Description: ${metadata.description}` : '',
    metadata.canonicalUrl ? `- Canonical URL: ${metadata.canonicalUrl}` : '',
    ...Object.entries(metadata.openGraph).map(([key, value]) => `- ${humanizePropertyName(key)}: ${value}`),
  ].filter(Boolean)
  return lines.length > 0 ? ['## Page Metadata', ...lines].join('\n') : ''
}

export function extractJsonLdAsText(html: string): string {
  const $ = load(html)
  const blocks: string[] = []
  $('script[type="application/ld+json" i]').each((_index, element) => {
    const raw = $(element).text().trim()
    if (!raw) return
    try {
      const parsed: unknown = JSON.parse(raw)
      for (const item of normalizeJsonLdItems(parsed)) {
        const formatted = formatStructuredValue(item, 0)
        if (formatted) blocks.push(formatted)
      }
    } catch {
      // Invalid structured data should not prevent visible website content from importing.
    }
  })
  const unique = blocks.filter(uniqueByLowercase).slice(0, 40)
  return unique.length > 0 ? ['## Structured Website Data', ...unique].join('\n\n') : ''
}

export function extractBreadcrumbsAsText(html: string): string {
  const $ = load(html)
  const trails: string[] = []
  const selectors = [
    '[aria-label*="breadcrumb" i]',
    '[class*="breadcrumb" i]',
    '[id*="breadcrumb" i]',
    '[itemtype*="BreadcrumbList" i]',
  ]
  $(selectors.join(', ')).each((_index, element) => {
    const items = $(element)
      .find('a, li, [itemprop="name"]')
      .map((_itemIndex, item) => normalizeExtractedText($(item).text()))
      .get()
      .filter(Boolean)
    const trail = Array.from(new Set(items)).join(' > ')
    if (trail) trails.push(trail)
  })
  const unique = trails.filter(uniqueByLowercase).slice(0, 10)
  return unique.length > 0 ? ['## Breadcrumbs', ...unique.map((trail) => `- ${trail}`)].join('\n') : ''
}

export function extractContactLinksAsText(html: string): string {
  const $ = load(html)
  const phones = new Set<string>()
  const emails = new Set<string>()
  $('a[href^="tel:" i]').each((_index, element) => {
    const href = ($(element).attr('href') ?? '').replace(/^tel:/i, '').trim()
    const label = normalizeExtractedText($(element).text())
    if (href) phones.add(label && label !== href ? `${label}: ${href}` : href)
  })
  $('a[href^="mailto:" i]').each((_index, element) => {
    const href = ($(element).attr('href') ?? '').replace(/^mailto:/i, '').split('?')[0]?.trim() ?? ''
    const label = normalizeExtractedText($(element).text())
    if (href) emails.add(label && label !== href ? `${label}: ${href}` : href)
  })
  const lines = [
    ...Array.from(phones).map((value) => `- Phone: ${value}`),
    ...Array.from(emails).map((value) => `- Email: ${value}`),
  ]
  return lines.length > 0 ? ['## Contact Links', ...lines].join('\n') : ''
}

export function extractFooterFactsAsText(html: string): string {
  const $ = load(html)
  const values: string[] = []
  $('footer').each((_index, element) => {
    const footer = $(element).clone()
    footer.find('script, style, svg, form, button').remove()
    footer.find('br').replaceWith('\n')
    footer.find('p, div, section, li, address, time').each((_childIndex, child) => {
      $(child).append('\n')
    })
    const text = normalizeExtractedText(footer.text())
    if (text.length >= 20) values.push(text.slice(0, 6000))
  })
  const unique = values.filter(uniqueByLowercase).slice(0, 4)
  return unique.length > 0 ? ['## Footer Information', ...unique].join('\n\n') : ''
}

export function extractPageHierarchyAsText(html: string): string {
  const $ = load(html)
  const scope = $('main').first().length > 0 ? $('main').first().clone() : $('body').first().clone()
  scope.find('script, style, noscript, svg, nav, header, footer, aside, form, button').remove()
  const output: string[] = []
  scope.find('h1, h2, h3, h4, h5, h6, p, li, dt, dd, address, time, figcaption, summary').each((_index, element) => {
    const node = $(element)
    if (node.is('p, li, dt, dd') && node.parents('p, li, dt, dd').length > 0) return
    const text = normalizeExtractedText(node.text())
    if (!text || text.length < 2) return
    const tag = element.type === 'tag' ? element.name.toLowerCase() : ''
    if (/^h[1-6]$/.test(tag)) {
      const level = Math.min(6, Math.max(2, Number(tag.slice(1)) + 1))
      output.push(`${'#'.repeat(level)} ${text}`)
    } else {
      output.push(text)
    }
  })
  const unique = output.filter(uniqueByLowercase).slice(0, 500)
  return unique.length > 0 ? ['## Page Content by Section', ...unique].join('\n\n') : ''
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
  const $ = load(tableHtml)
  const rows: string[][] = []
  $('tr').each((_rowIndex, rowElement) => {
    const cells: string[] = []
    $(rowElement).children('th, td').each((_cellIndex, cellElement) => {
      const value = markdownCellText($.html(cellElement))
      if (value) cells.push(value)
    })
    if (cells.length > 0) rows.push(cells)
  })

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
  const $ = load(html)
  const results: string[] = []
  $('[class], [id]').each((_index, element) => {
    const attributes = `${$(element).attr('class') ?? ''} ${$(element).attr('id') ?? ''}`.toLowerCase()
    if (!keywords.some((keyword) => attributes.includes(keyword))) return
    const outerHtml = $.html(element)
    if (outerHtml) results.push(outerHtml)
  })
  return results
}

function extractRepeatedContentBlocks(html: string): string[] {
  const $ = load(html)
  const results: string[] = []
  const seen = new Set<string>()

  $('main, section, article, div, ul, ol').each((_parentIndex, parentElement) => {
    const children = $(parentElement).children('article, section, div, li')
    if (children.length < 2 || children.length > 30) return

    const groups = new Map<string, string[]>()
    children.each((_childIndex, childElement) => {
      const child = $(childElement)
      const text = normalizeExtractedText(child.text())
      if (text.length < 30 || text.length > 1800) return
      const heading = normalizeExtractedText(child.find('h1, h2, h3, h4, h5, h6, [role="heading"]').first().text())
      const detailCount = child.find('p, li, dt, dd, time, address, strong').length
      if (!heading || detailCount < 1) return

      const directShape = child
        .children()
        .map((_index, element) => (element.type === 'tag' ? element.name.toLowerCase() : ''))
        .get()
        .filter(Boolean)
        .slice(0, 8)
        .join(',')
      const tagName = childElement.type === 'tag' ? childElement.name.toLowerCase() : ''
      const signature = `${tagName}|${directShape}|${Math.min(detailCount, 5)}`
      const values = groups.get(signature) ?? []
      const outerHtml = $.html(childElement)
      if (outerHtml) values.push(outerHtml)
      groups.set(signature, values)
    })

    for (const values of groups.values()) {
      if (values.length < 2) continue
      for (const value of values) {
        const key = normalizeExtractedText(cleanHtmlToText(value)).toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        results.push(value)
      }
    }
  })

  return results.slice(0, 60)
}

function structureBusinessCardText(text: string): string {
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
  return /\b(cpu|core|ram|gb|tb|mb|nvme|ssd|storage|bandwidth|traffic|backup|ssl|domain|database|email|workflow|execution|memory|includes?|serves?|serving|people|person|minutes?|hours?|duration|session|appointment|booking|required|delivery|shipping|size|weight|kg|ml|litre|liter|bed|bath|sq\.?\s?ft|location|branch|level|lessons?|classes?|weeks?|months?)\b/i.test(value)
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

function looksLikeBusinessCardContent(value: string): boolean {
  return (
    looksLikePricingContent(value) ||
    /\b(product|service|menu|dish|course|program|treatment|appointment|booking|serves?|duration|delivery|shipping|return|sale|offer)\b/i.test(value)
  )
}

function looksLikePricingContent(value: string): boolean {
  return /(\$|£|€|₹|rs\.?|pkr|usd|month|monthly|year|yearly|annual|plan|package|price|discount|setup fee|included|features?)/i.test(value)
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null
  const normalized = normalizeExtractedText(decodeHtmlEntities(value))
  return normalized ? normalized.slice(0, maxLength) : null
}

function resolveOptionalUrl(value: string | null | undefined, baseUrl?: string): string | null {
  if (!value) return null
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

function humanizePropertyName(value: string): string {
  return value
    .replace(/^og:/i, 'Open Graph ')
    .replace(/^@/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim()
}

function normalizeJsonLdItems(value: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeJsonLdItems(item))
  if (!isRecord(value)) return []
  const graph = value['@graph']
  if (Array.isArray(graph)) return graph.flatMap((item) => normalizeJsonLdItems(item))
  return [value]
}

function formatStructuredValue(value: Record<string, unknown>, depth: number): string {
  if (depth > 4) return ''
  const typeValue = scalarText(value['@type'])
  const nameValue = scalarText(value.name) ?? scalarText(value.headline)
  const heading = nameValue ?? typeValue ?? 'Structured item'
  const lines: string[] = [`${'#'.repeat(Math.min(6, depth + 3))} ${heading}`]

  for (const [key, item] of Object.entries(value)) {
    if (key === '@context' || key === '@graph' || key === '@type' || key === 'name' || key === 'headline') continue
    if (item === null || item === undefined) continue
    const label = humanizePropertyName(key)
    const scalar = scalarText(item)
    if (scalar) {
      lines.push(`- ${label}: ${scalar}`)
      continue
    }
    if (Array.isArray(item)) {
      const scalarValues = item.map((entry) => scalarText(entry)).filter((entry): entry is string => Boolean(entry))
      if (scalarValues.length > 0) lines.push(`- ${label}: ${scalarValues.join(', ')}`)
      for (const nested of item) {
        if (!isRecord(nested)) continue
        const formatted = formatStructuredValue(nested, depth + 1)
        if (formatted) lines.push(formatted)
      }
      continue
    }
    if (isRecord(item)) {
      const formatted = formatStructuredValue(item, depth + 1)
      if (formatted) lines.push(formatted)
    }
  }

  return lines.join('\n').slice(0, 12_000)
}

function scalarText(value: unknown): string | null {
  if (typeof value === 'string') return normalizeOptionalText(value, 2000)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readMetadataString(metadata: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readMetadataNumber(metadata: Readonly<Record<string, unknown>>, key: string): number | null {
  const value = metadata[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function slugReason(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'page_error'
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
