import { createHash } from 'node:crypto'
import { load } from 'cheerio'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { createRagWebsiteKnowledge, type RagKnowledgeDetail } from './knowledge-store'
import { cleanRagKnowledgeContent, RAG_KNOWLEDGE_CHARACTER_LIMIT } from './knowledge'
import { sanitizeProviderError } from './security'

const FIRECRAWL_V2_BASE_URL = 'https://api.firecrawl.dev/v2'
const DEFAULT_WEBSITE_IMPORT_PAGE_LIMIT = 50
const MAX_WEBSITE_IMPORT_PAGE_LIMIT = 100
const MIN_USEFUL_PAGE_CHARACTERS = 80
const FIRECRAWL_REQUEST_TIMEOUT_MS = 30_000
const FIRECRAWL_CRAWL_POLL_INTERVAL_MS = 2_000
const FIRECRAWL_CRAWL_MAX_WAIT_MS = 90_000
const FIRECRAWL_BATCH_MAX_WAIT_MS = 90_000
const FIRECRAWL_RETRY_COUNT = 2

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
  'panel',
  'portal',
  'clientarea',
  'clientarea.php',
  'client-area',
  'client',
  'submitticket.php',
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
  /^sitemap$/i,
  /^text$/i,
  /^visual$/i,
  /\b(skip to content|toggle navigation|open menu|close menu|menu|hamburger)\b/i,
  /\b(accessibility|accessibility widget|increase text|decrease text|grayscale|high contrast|negative contrast|light background|readable font|reset all|ally by elementor|go\.elementor\.com)\b/i,
  /\b(opens chat|opens the chat window|chat this icon|close|loading|hide|reset|spinner|please wait)\b/i,
  /\b(cookie|cookies|accept all|reject all|privacy preferences)\b/i,
  /\b(newsletter|subscribe to our newsletter|enter your email)\b/i,
  /\b(lorem ipsum|hello world|welcome to wordpress|uncategorized)\b/i,
  /\b(add to cart|view cart|checkout|coupon code|billing details)\b/i,
  /\b(username|password|remember me|forgot password|log in|register)\b/i,
  /\b(function\s*\(|var\s+|let\s+|const\s+|=>|document\.|window\.|canvas|getcontext|requestanimationframe|ctx\.|elementor|wp-json|data-widget_type|fa-solid|landpoly|p\.t\s*[+>]?=)\b/i,
]

interface RagFirecrawlSettingsRow {
  readonly encrypted_api_key: string | null
  readonly enabled: boolean | null
}

interface FirecrawlLink {
  readonly url?: string | null
  readonly href?: string | null
  readonly text?: string | null
  readonly label?: string | null
  readonly title?: string | null
}

type FirecrawlLinkEntry = string | FirecrawlLink

interface FirecrawlScrapeResponse {
  readonly success?: boolean
  readonly data?: {
    readonly markdown?: string | null
    readonly text?: string | null
    readonly html?: string | null
    readonly links?: ReadonlyArray<FirecrawlLinkEntry> | null
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
  readonly links?: ReadonlyArray<FirecrawlLinkEntry> | null
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

interface FirecrawlBatchScrapeResponse extends FirecrawlCrawlResponse {
  readonly data?: ReadonlyArray<FirecrawlCrawlPage> | null
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
  readonly batchScrape?: (urls: ReadonlyArray<string>) => Promise<ReadonlyArray<FirecrawlCrawlPage>>
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
  readonly links: ReadonlyArray<StructuredLink>
  readonly qualityScore: number
}

interface ExtractedWebsiteContent {
  readonly title: string | null
  readonly finalUrl: string | null
  readonly content: string
  readonly links: ReadonlyArray<StructuredLink>
}

type StructuredLinkType =
  | 'order'
  | 'contact'
  | 'policy'
  | 'social'
  | 'booking'
  | 'docs'
  | 'support'
  | 'login'
  | 'asset'
  | 'other'

interface StructuredLink {
  readonly url: string
  readonly label: string | null
  readonly type: StructuredLinkType
}

interface StructuredRecordCounts {
  businessFacts: number
  contacts: number
  locations: number
  products: number
  services: number
  plans: number
  menuItems: number
  faqs: number
  policies: number
  importantLinks: number
  testEndpoints: number
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
  readonly firecrawlModesUsed: ReadonlyArray<string>
  readonly structuredRecords: StructuredRecordCounts
  readonly warnings: ReadonlyArray<string>
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

function isIPv4(value: string): boolean {
  const parts = value.trim().split('.')
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
}

function isSpecOrPriceNumber(value: string, context: string): boolean {
  const combined = `${value} ${context}`
  return /(?:[$€£₨₹]|usd|pkr|aed|eur|gbp|\/mo|\/month|monthly|yearly|annually|price|discount|off|%|gb|mb|tb|ram|cpu|core|storage|nvme|ssd|iops|mbps|gbps|tbps|bandwidth|vcore|thread)/i.test(combined)
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/[^\d+]/g, '')
}

function isPhoneCandidate(value: string, context: string): boolean {
  if (isIPv4(value)) return false
  if (isSpecOrPriceNumber(value, context)) return false
  if (/\b(?:svg|path|viewbox|canvas|ctx|chart|data:image)\b/i.test(context)) return false
  const digits = value.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return false
  if (/^\d{1,4}$/.test(value.trim())) return false
  return /(?:phone|call|tel:|mobile|whatsapp|wa\.me|support|sales|contact)/i.test(context) || value.trim().startsWith('+')
}

function extractPhonesFromLine(line: string): ReadonlyArray<string> {
  return collectMatches(line, /(?:\+?\d[\d\s().-]{7,}\d)/g)
    .filter((phone) => isPhoneCandidate(phone, line))
    .map((phone) => phone.trim())
    .filter(uniqueByLowercase)
}

function extractIpAddresses(content: string): ReadonlyArray<string> {
  return collectMatches(content, /\b(?:\d{1,3}\.){3}\d{1,3}\b/g)
    .filter(isIPv4)
    .filter(uniqueByLowercase)
}

function readLinkEntryUrl(entry: FirecrawlLinkEntry): string | null {
  if (typeof entry === 'string') return entry
  return entry.url ?? entry.href ?? null
}

function readLinkEntryLabel(entry: FirecrawlLinkEntry): string | null {
  if (typeof entry === 'string') return null
  return entry.text ?? entry.label ?? entry.title ?? null
}

function isAssetUrl(url: string): boolean {
  try {
    const lowerPath = new URL(url, 'https://example.com').pathname.toLowerCase()
    return SKIP_FILE_EXTENSIONS.some((extension) => lowerPath.endsWith(extension)) ||
      /\.(avif|bmp|tiff|woff2?|ttf|eot)$/i.test(lowerPath)
  } catch {
    return false
  }
}

function classifyLink(url: string, label: string | null): StructuredLinkType {
  const text = `${url} ${label ?? ''}`.toLowerCase()
  if (isAssetUrl(url) || /logo|image|avatar|icon|cdn|uploads/.test(text)) return 'asset'
  if (/wa\.me|whatsapp|mailto:|tel:|contact/.test(text)) return 'contact'
  if (/facebook|twitter|x\.com|instagram|linkedin|youtube|tiktok|pinterest/.test(text)) return 'social'
  if (/privacy|refund|return|terms|policy|shipping|delivery|warranty|cancellation/.test(text)) return 'policy'
  if (/book|appointment|schedule|reservation/.test(text)) return 'booking'
  if (/docs|documentation|help|knowledgebase|guide|tutorial|support/.test(text)) return 'docs'
  if (/ticket|support|live-chat|chat/.test(text)) return 'support'
  if (/login|register|account|clientarea|panel|dashboard/.test(text)) return 'login'
  if (/order|buy|pricing|plans|package|quote|checkout|cart/.test(text)) return 'order'
  return 'other'
}

function extractMarkdownLinks(markdown: string, startUrl = 'https://example.com'): ReadonlyArray<StructuredLink> {
  return Array.from(markdown.matchAll(/\[([^\]]{0,160})\]\(([^)\s]+)[^)]*\)/g))
    .map((match) => {
      const rawUrl = match[2] ?? ''
      const normalized = normalizeWebsiteCandidateUrl(rawUrl, startUrl) ?? rawUrl
      return {
        url: normalized,
        label: match[1]?.trim() || null,
        type: classifyLink(normalized, match[1] ?? null),
      }
    })
    .filter((link) => link.type !== 'asset')
}

function normalizeStructuredLinks(
  links: ReadonlyArray<FirecrawlLinkEntry> | null | undefined,
  startUrl = 'https://example.com',
): ReadonlyArray<StructuredLink> {
  return (links ?? [])
    .map((entry) => {
      const rawUrl = readLinkEntryUrl(entry)
      if (!rawUrl) return null
      const normalized = normalizeWebsiteCandidateUrl(rawUrl, startUrl) ?? rawUrl
      const label = readLinkEntryLabel(entry)
      return {
        url: normalized,
        label,
        type: classifyLink(normalized, label),
      } satisfies StructuredLink
    })
    .filter((link): link is StructuredLink => link !== null && link.type !== 'asset')
    .filter((link, index, values) => values.findIndex((item) => item.url === link.url && item.type === link.type) === index)
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
    links: data?.links,
    metadata: data?.metadata,
  })
}

function extractFirecrawlCrawlPageContent(page: FirecrawlCrawlPage): ExtractedWebsiteContent {
  return extractPageContent({
    markdown: page.markdown,
    text: page.text,
    html: page.rawHtml ?? page.html,
    links: page.links,
    metadata: page.metadata,
  })
}

function extractPageContent(args: {
  readonly markdown?: string | null
  readonly text?: string | null
  readonly html?: string | null
  readonly links?: ReadonlyArray<FirecrawlLinkEntry> | null
  readonly metadata?: {
    readonly title?: string | null
    readonly sourceURL?: string | null
    readonly url?: string | null
    readonly ogTitle?: string | null
  } | null
}): ExtractedWebsiteContent {
  const structuredHtml = args.html ? extractWebsiteKnowledgeText(args.html) : ''
  const startUrl = args.metadata?.sourceURL ?? args.metadata?.url ?? 'https://example.com'
  const links = [
    ...normalizeStructuredLinks(args.links, startUrl),
    ...(args.html ? extractHtmlLinks(args.html, startUrl) : []),
    ...(args.markdown ? extractMarkdownLinks(args.markdown, startUrl) : []),
  ].filter((link, index, values) => values.findIndex((item) => item.url === link.url && item.type === link.type) === index)
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
    links,
  }
}

function extractWebsiteKnowledgeText(html: string): string {
  return cleanRagKnowledgeContent([
    extractHtmlMetadataText(html),
    extractJsonLdText(html),
    extractBreadcrumbsText(html),
    extractTablesText(html),
    extractBusinessCardsText(html),
    extractBusinessDetailsText(html),
    extractFaqSectionsText(html),
    extractContactLinksText(html),
    extractFooterText(html),
    extractHeadingHierarchyText(html),
    cleanHtmlToText(html),
  ].filter(Boolean).join('\n\n'))
}

function readHtmlTitle(html: string): string | null {
  const $ = load(html)
  return normalizeOptionalText($('title').first().text(), 160)
}

function extractHtmlMetadataText(html: string): string {
  const $ = load(html)
  const title = readHtmlTitle(html)
  const description = readMetaContent(html, 'description') ?? readMetaContent(html, 'og:description')
  const canonicalHref = $('link[rel~="canonical" i]').first().attr('href')
  const openGraph = new Map<string, string>()
  $('meta[property^="og:" i], meta[name^="og:" i]').each((_index, element) => {
    const property = ($(element).attr('property') ?? $(element).attr('name') ?? '').trim().toLowerCase()
    const content = normalizeOptionalText($(element).attr('content'), 500)
    if (property && content && !openGraph.has(property)) openGraph.set(property, content)
  })
  const lines = [
    title ? `Title: ${title}` : '',
    description ? `Description: ${description}` : '',
    canonicalHref ? `Canonical URL: ${decodeHtmlEntities(canonicalHref)}` : '',
    ...Array.from(openGraph.entries()).map(([key, value]) => `${humanizeLabel(key)}: ${value}`),
  ].filter(Boolean)
  return lines.length ? ['## Page Metadata', ...lines].join('\n') : ''
}

function readMetaContent(html: string, name: string): string | null {
  const $ = load(html)
  const content = $(`meta[name="${name}" i], meta[property="${name}" i]`).first().attr('content')
  return normalizeOptionalText(content, 500)
}

function extractJsonLdText(html: string): string {
  const $ = load(html)
  const blocks = $('script[type="application/ld+json" i]')
    .map((_index, element) => $(element).text().trim())
    .get()
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

function extractBreadcrumbsText(html: string): string {
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
      .map((_itemIndex, item) => normalizeExtractedHtmlText($(item).text()))
      .get()
      .filter(Boolean)
    const trail = Array.from(new Set(items)).join(' > ')
    if (trail) trails.push(trail)
  })
  const unique = trails.filter(uniqueByLowercase).slice(0, 10)
  return unique.length ? ['## Breadcrumbs', ...unique.map((trail) => `- ${trail}`)].join('\n') : ''
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
  const $ = load(html)
  const tables = $('table')
    .map((index, element) => {
      const markdown = tableHtmlToMarkdown($.html(element) ?? '')
      return markdown ? `### Table ${index + 1}\n${markdown}` : ''
    })
    .get()
    .filter(Boolean)
    .slice(0, 12)
  return tables.length ? ['## Structured Tables', ...tables].join('\n\n') : ''
}

function extractBusinessCardsText(html: string): string {
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
    'server',
    'hosting',
  ])
  const repeatedCards = extractRepeatedContentBlocks(html)
  const cards = [
    ...repeatedCards.map((cardHtml) => ({ html: cardHtml, structurallyDetected: true })),
    ...attributeCards.map((cardHtml) => ({ html: cardHtml, structurallyDetected: false })),
  ]
    .map(({ html: cardHtml, structurallyDetected }) => ({
      text: structureBusinessCardText(normalizeExtractedHtmlText(cleanHtmlToText(cardHtml))),
      structurallyDetected,
    }))
    .filter(({ text, structurallyDetected }) => text.length >= 30 && (structurallyDetected || looksLikeBusinessCardContent(text)))
    .map(({ text }) => text)
    .filter(uniqueByLowercase)
    .slice(0, 80)

  return cards.length ? ['## Products, Services, Plans and Pricing', ...cards].join('\n\n') : ''
}

function extractBusinessDetailsText(html: string): string {
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
      keywords: ['delivery', 'shipping', 'return', 'refund', 'policy', 'terms', 'warranty', 'cancellation'],
    },
  ]

  return sections
    .map(({ heading, keywords }) => {
      const text: string[] = []
      $('[class], [id]').each((_index, element) => {
        const attributes = `${$(element).attr('class') ?? ''} ${$(element).attr('id') ?? ''}`.toLowerCase()
        if (!keywords.some((keyword) => attributes.includes(keyword))) return
        const value = normalizeExtractedHtmlText($(element).text())
        if (value.length >= 30) text.push(value)
      })
      const uniqueText = text.filter(uniqueByLowercase).slice(0, 12)
      return uniqueText.length ? [heading, ...uniqueText].join('\n\n') : ''
    })
    .filter(Boolean)
    .join('\n\n')
}

function extractFaqSectionsText(html: string): string {
  const $ = load(html)
  const faqValues: string[] = []
  $('details').each((_index, element) => {
    const value = normalizeExtractedHtmlText($(element).text())
    if (value) faqValues.push(value)
  })
  $('[class], [id]').each((_index, element) => {
    const attributes = `${$(element).attr('class') ?? ''} ${$(element).attr('id') ?? ''}`.toLowerCase()
    if (!/(faq|accordion|question|answer)/.test(attributes)) return
    const value = normalizeExtractedHtmlText($(element).text())
    if (value) faqValues.push(value)
  })
  const faqs = faqValues.filter((text) => text.length >= 40).filter(uniqueByLowercase).slice(0, 30)
  return faqs.length ? ['## FAQs', ...faqs.map((faq, index) => `### FAQ section ${index + 1}\n${faq}`)].join('\n\n') : ''
}

function extractContactLinksText(html: string): string {
  const $ = load(html)
  const lines = new Set<string>()
  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href') ?? ''
    const label = normalizeExtractedHtmlText($(element).text())
    if (/^mailto:/i.test(href)) lines.add(`- Email: ${label ? `${label}: ` : ''}${href.replace(/^mailto:/i, '').split('?')[0]}`)
    if (/^tel:/i.test(href)) lines.add(`- Phone: ${label ? `${label}: ` : ''}${href.replace(/^tel:/i, '')}`)
    if (/wa\.me|whatsapp/i.test(href)) lines.add(`- WhatsApp: ${label ? `${label}: ` : ''}${href}`)
  })
  return lines.size ? ['## Contact Links', ...Array.from(lines)].join('\n') : ''
}

function extractHtmlLinks(html: string, startUrl: string): ReadonlyArray<StructuredLink> {
  const $ = load(html)
  return $('a[href]')
    .map((_index, element) => {
      const rawUrl = $(element).attr('href') ?? ''
      const normalized = normalizeWebsiteCandidateUrl(rawUrl, startUrl) ?? rawUrl
      const label = normalizeExtractedHtmlText($(element).text()).slice(0, 160) || null
      return {
        url: normalized,
        label,
        type: classifyLink(normalized, label),
      } satisfies StructuredLink
    })
    .get()
    .filter((link) => link.type !== 'asset')
    .filter((link, index, values) => values.findIndex((item) => item.url === link.url && item.type === link.type) === index)
    .slice(0, 300)
}

function extractFooterText(html: string): string {
  const $ = load(html)
  const footers = $('footer')
    .map((_index, element) => {
      const footer = $(element).clone()
      footer.find('script, style, svg, form, button, iframe').remove()
      footer.find('br').replaceWith('\n')
      footer.find('p, div, section, li, address, time').each((_childIndex, child) => {
        $(child).append('\n')
      })
      return normalizeExtractedHtmlText(footer.text()).slice(0, 6000)
    })
    .get()
    .filter((value) => value.length >= 20)
    .filter(uniqueByLowercase)
    .slice(0, 4)
  return footers.length ? ['## Footer Information', ...footers].join('\n\n') : ''
}

function extractHeadingHierarchyText(html: string): string {
  const $ = load(html)
  const scope = $('main').first().length ? $('main').first().clone() : $('body').first().clone()
  scope.find('script, style, noscript, svg, nav, header, footer, aside, form, button, iframe').remove()
  const nodes = scope
    .find('h1, h2, h3, h4, h5, h6, p, li, dt, dd, address, time, figcaption, summary')
    .map((_index, element) => {
      const node = $(element)
      if (node.is('p, li, dt, dd') && node.parents('p, li, dt, dd').length > 0) return ''
      const tag = element.type === 'tag' ? element.name.toLowerCase() : ''
      const text = normalizeExtractedHtmlText(node.text())
      if (!text || text.length < 2) return ''
      if (/^h[1-6]$/.test(tag)) {
        const level = Math.min(6, Math.max(2, Number(tag.slice(1)) + 1))
        return `${'#'.repeat(level)} ${text}`
      }
      return text
    })
    .get()
    .filter(Boolean)
    .filter(uniqueByLowercase)
    .slice(0, 500)
  return nodes.length ? ['## Page Content by Section', ...nodes].join('\n\n') : ''
}

function cleanHtmlToText(html: string): string {
  const $ = load(html)
  $('script, style, noscript, svg, head, nav, header, footer, aside, form, button, iframe').remove()
  $('del, s, strike, [style*="line-through" i]').each((_index, element) => {
    const text = normalizeExtractedHtmlText($(element).text())
    if (!text || !/(\$|£|€|₹|rs\.?|pkr|usd|eur|gbp)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:usd|eur|gbp|pkr)/i.test(text)) return
    $(element).text(` original price ${text} `)
  })
  $('br').replaceWith('\n')
  $('p, div, section, article, li, h1, h2, h3, h4, h5, h6, tr').each((_index, element) => {
    $(element).append('\n')
  })
  return normalizeExtractedHtmlText($.root().text())
}

function normalizeExtractedHtmlText(value: string): string {
  const lines = decodeHtmlEntities(value)
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

function normalizeOptionalText(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null
  const normalized = normalizeExtractedHtmlText(value)
  return normalized ? normalized.slice(0, maxLength) : null
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

function tableHtmlToMarkdown(tableHtml: string): string {
  const $ = load(tableHtml)
  const rows: string[][] = []
  $('tr').each((_rowIndex, rowElement) => {
    const cells: string[] = []
    $(rowElement).children('th, td').each((_cellIndex, cellElement) => {
      const value = markdownCellText($.html(cellElement) ?? '')
      if (value) cells.push(value)
    })
    if (cells.length > 0) rows.push(cells)
  })

  if (rows.length === 0) return ''
  const width = Math.max(...rows.map((row) => row.length))
  const normalizedRows = rows.map((row) => Array.from({ length: width }, (_item, index) => row[index] ?? ''))
  const header = normalizedRows[0] ?? []
  const separator = header.map((cell) => (looksLikePriceHeader(cell) ? '---:' : '---'))
  const body = normalizedRows.slice(1)

  return [header, separator, ...body]
    .map((row) => `| ${row.map((cell) => cell || ' ').join(' | ')} |`)
    .join('\n')
}

function markdownCellText(html: string): string {
  return normalizeExtractedHtmlText(cleanHtmlToText(html))
    .replace(/\n+/g, '<br>')
    .replace(/\|/g, '\\|')
    .trim()
}

function looksLikePriceHeader(value: string): boolean {
  return /\b(price|amount|cost|fee|rate|monthly|yearly|annual|billing)\b/i.test(value)
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
      const text = normalizeExtractedHtmlText(child.text())
      if (text.length < 30 || text.length > 1800) return
      const heading = normalizeExtractedHtmlText(child.find('h1, h2, h3, h4, h5, h6, [role="heading"]').first().text())
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
        const key = normalizeExtractedHtmlText(cleanHtmlToText(value)).toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        results.push(value)
      }
    }
  })

  return results.slice(0, 80)
}

function structureBusinessCardText(text: string): string {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
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
  return /\b(cpu|core|ram|gb|tb|mb|nvme|ssd|storage|bandwidth|traffic|backup|ssl|domain|database|email|workflow|execution|memory|includes?|serves?|serving|people|person|minutes?|hours?|duration|session|appointment|booking|required|delivery|shipping|size|weight|kg|ml|litre|liter|bed|bath|sq\.?\s?ft|location|branch|level|lessons?|classes?|weeks?|months?|network|port|ddos|root access)\b/i.test(value)
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

function looksLikeBusinessCardContent(value: string): boolean {
  return (
    looksLikePricingContent(value) ||
    /\b(product|service|menu|dish|course|program|treatment|appointment|booking|serves?|duration|delivery|shipping|return|sale|offer|cpu|ram|storage|server|hosting)\b/i.test(value)
  )
}

function looksLikePricingContent(value: string): boolean {
  return /(\$|£|€|₹|rs\.?|pkr|usd|month|monthly|year|yearly|annual|plan|package|price|discount|setup fee|included|features?)/i.test(value)
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

function lineLooksHardJunk(value: string): boolean {
  return (
    /^sitemap$/i.test(value) ||
    /^text$/i.test(value) ||
    /^visual$/i.test(value) ||
    /\b(opens chat|opens the chat window|chat this icon|ally by elementor|go\.elementor\.com)\b/i.test(value) ||
    /\b(data-widget_type|fa-solid|nav-menu\.default|landpoly|p\.t\s*[+>]?=|requestanimationframe|ctx\.|getcontext)\b/i.test(value) ||
    (/^[{}[\],:;"'`=<>/\\()._-]{3,}$/.test(value) && !lineLooksImportant(value))
  )
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
      if (lineLooksHardJunk(line)) return false
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

function scorePageQuality(page: Pick<ImportedWebsitePage, 'url' | 'title' | 'content' | 'links'>): number {
  const path = new URL(page.url).pathname.toLowerCase()
  const title = (page.title ?? '').toLowerCase()
  const main = removeJunkFromContent(page.content).slice(0, 6_000)
  const normalized = normalizeKnowledgeLine(`${title} ${path} ${main}`)
  let score = 0

  if (main.length >= 300) score += 10
  if (main.length >= 1_000) score += 8
  if (/price|pricing|plan|package|[$€£₨₹]\s?\d|monthly|yearly|discount/.test(normalized)) score += 20
  if (/product|service|menu|course|appointment|feature|spec|catalog|shop|treatment|program/.test(normalized)) score += 18
  if (/faq|question|answer|frequently asked/.test(normalized)) score += 16
  if (/refund|return|privacy|terms|shipping|delivery|warranty|cancellation/.test(normalized)) score += 14
  if (/contact|support|sales|email|phone|whatsapp|address|opening hours|location/.test(normalized)) score += 16
  if (extractIpAddresses(main).length > 0) score += 8
  if (page.links.some((link) => link.type === 'order' || link.type === 'booking' || link.type === 'contact')) score += 6

  if (/hello-world|author|category|tag|feed|wp-json|sitemap|xmlrpc/.test(path)) score -= 35
  if (/clientarea|panel|submitticket|cart|checkout|payment|login|register|password/.test(path)) score -= 45
  if (/welcome to wordpress|uncategorized|comment form/.test(normalized)) score -= 30
  if (/language selector|password generator|captcha|form fields|username|remember me/.test(normalized)) score -= 20
  if ((main.match(/requestanimationframe|ctx\.|canvas|function\s*\(|document\.|window\./gi) ?? []).length > 2) score -= 20

  return Math.max(0, Math.min(100, score))
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
): { readonly section: string; readonly counts: Pick<StructuredRecordCounts, 'businessFacts' | 'contacts' | 'locations' | 'importantLinks' | 'testEndpoints'> } {
  const combined = pages.map((page) => page.content).join('\n')
  const emails = collectMatches(combined, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
  const whatsappLinks = collectMatches(combined, /(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com)\/[^\s)'"<>]+/gi)
  const phones = pages
    .flatMap((page) => page.content.split('\n').flatMap(extractPhonesFromLine))
    .map(normalizePhoneDigits)
    .filter(uniqueByLowercase)
    .slice(0, 12)
  const testIps = pages.flatMap((page) => extractIpAddresses(page.content)).filter(uniqueByLowercase).slice(0, 40)
  const allLinks = pages.flatMap((page) => page.links)
    .filter((link) => link.type !== 'asset' && link.type !== 'login')
    .filter((link, index, values) => values.findIndex((item) => item.url === link.url && item.type === link.type) === index)
  const contactLinks = allLinks.filter((link) => link.type === 'contact')
  const socialLinks = allLinks.filter((link) => link.type === 'social')
  const policyLinks = allLinks.filter((link) => link.type === 'policy')
  const orderLinks = allLinks.filter((link) => link.type === 'order' || link.type === 'booking')
  const docsLinks = allLinks.filter((link) => link.type === 'docs' || link.type === 'support')
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
    '# Business Profile',
    `Website: ${startUrl}`,
    companyDetails.length ? ['Company/legal details:', ...companyDetails.map((line) => `- ${line}`)].join('\n') : '',
    locations.length ? ['Locations/hours/address facts:', ...locations.map((line) => `- ${line}`)].join('\n') : '',
    socialLinks.length ? ['Social links:', ...socialLinks.map((link) => `- ${link.label ? `${link.label}: ` : ''}${link.url}`)].join('\n') : '',
    '',
    '# Contact & Support',
    emails.length ? `Support/contact emails: ${emails.join(', ')}` : '',
    whatsappLinks.length ? `WhatsApp links: ${whatsappLinks.join(', ')}` : '',
    phones.length ? `Phone numbers: ${phones.join(', ')}` : '',
    contactLinks.length ? ['Contact links:', ...contactLinks.map((link) => `- ${link.label ? `${link.label}: ` : ''}${link.url}`)].join('\n') : '',
    '',
    '# Locations',
    testIps.length ? ['Test endpoints / IP addresses:', ...testIps.map((ip) => `- IP: ${ip}`)].join('\n') : '',
    '',
    '# Important Links',
    orderLinks.length ? ['Order / CTA / booking links:', ...orderLinks.map((link) => `- ${link.label ? `${link.label}: ` : ''}${link.url}`)].join('\n') : '',
    policyLinks.length ? ['Policy links:', ...policyLinks.map((link) => `- ${link.label ? `${link.label}: ` : ''}${link.url}`)].join('\n') : '',
    docsLinks.length ? ['Docs / help / support links:', ...docsLinks.map((link) => `- ${link.label ? `${link.label}: ` : ''}${link.url}`)].join('\n') : '',
  ].filter(Boolean)

  return {
    section: lines.join('\n'),
    counts: {
      businessFacts: companyDetails.length + socialLinks.length + 1,
      contacts: emails.length + whatsappLinks.length + phones.length + contactLinks.length,
      locations: locations.length,
      importantLinks: allLinks.length,
      testEndpoints: testIps.length,
    },
  }
}

type StructuredSectionKey =
  | 'products'
  | 'pricing'
  | 'locations'
  | 'faqs'
  | 'policies'
  | 'pageSummaries'

function pageSectionKey(page: ImportedWebsitePage): StructuredSectionKey {
  const parsed = new URL(page.url)
  const path = parsed.pathname.toLowerCase()
  const title = (page.title ?? '').toLowerCase()
  const main = normalizeKnowledgeLine(removeJunkFromContent(page.content).split('\n').slice(0, 80).join('\n'))
  const pathTitle = `${path} ${title}`

  if (/faq|frequently-asked|questions/.test(pathTitle) || /\b(faq|frequently asked|question|answer)\b/.test(main)) return 'faqs'
  if (/refund|return|privacy|terms|policy|shipping|delivery|warranty|cancellation/.test(pathTitle)) return 'policies'
  if (/contact|location|locations|address|hours|office|branch/.test(pathTitle) || /\b(location|address|test ip|opening hours|office|branch)\b/.test(main)) return 'locations'
  if (/pricing|price|plan|plans|package|packages|billing/.test(pathTitle) || /\b(plan|package|pricing|billing|discount|monthly|yearly|per month|per year|current price|original price)\b/.test(main)) return 'pricing'
  if (/product|products|shop|store|catalog|menu|service|services|course|appointment|booking|feature|features|hosting|server/.test(pathTitle)) return 'products'
  if (/\b(service|product|menu|course|appointment|feature|spec|treatment|program|catalog|shop|variant|stock)\b/.test(main)) return 'products'
  if (/[$€£₨₹]\s?\d|price|discount|monthly|yearly|per month|per year/.test(main)) return 'pricing'
  if (/\b(refund|return|privacy|terms|policy|shipping|delivery|cancellation)\b/.test(main)) return 'policies'
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
  const usefulLinks = page.links
    .filter((link) => link.type !== 'asset' && link.type !== 'login')
    .slice(0, 20)
  return [
    `## Page: ${page.title ?? page.url}`,
    `URL: ${page.url}`,
    `Purpose: ${pagePurposeForKey(key)}`,
    `Quality score: ${page.qualityScore}`,
    usefulLinks.length ? ['Important links:', ...usefulLinks.map((link) => `- ${link.type}: ${link.label ? `${link.label}: ` : ''}${link.url}`)].join('\n') : '',
    'Important facts:',
    page.content,
  ].filter(Boolean).join('\n\n')
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
  readonly structuredRecords: StructuredRecordCounts
} {
  const rawCharacters = args.pages.reduce((sum, page) => sum + page.rawCharacters, 0)
  const usefulPages = args.pages.filter((page) =>
    !pageContentLooksLowValue(page) &&
    (page.qualityScore >= 10 || lineLooksImportant(page.content)),
  )
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
  const structuredCounts: StructuredRecordCounts = {
    businessFacts: 0,
    contacts: 0,
    locations: 0,
    products: 0,
    services: 0,
    plans: 0,
    menuItems: 0,
    faqs: 0,
    policies: 0,
    importantLinks: 0,
    testEndpoints: 0,
  }

  for (const page of cleanedPages) {
    const key = pageSectionKey(page)
    grouped[key].push(buildStructuredPageBlock(page, key))
    if (key === 'pricing') structuredCounts.plans += 1
    if (key === 'products') {
      structuredCounts.products += /product|catalog|shop/i.test(`${page.title ?? ''} ${page.url} ${page.content}`) ? 1 : 0
      structuredCounts.services += /service|appointment|course|menu|treatment|program|feature/i.test(`${page.title ?? ''} ${page.url} ${page.content}`) ? 1 : 0
      structuredCounts.menuItems += /menu|item|dish|pizza|meal|restaurant/i.test(`${page.title ?? ''} ${page.url} ${page.content}`) ? 1 : 0
    }
    if (key === 'locations') structuredCounts.locations += 1
    if (key === 'faqs') structuredCounts.faqs += 1
    if (key === 'policies') structuredCounts.policies += 1
  }
  const globalFacts = extractGlobalBusinessFacts(usefulPages, args.startUrl)
  structuredCounts.businessFacts += globalFacts.counts.businessFacts
  structuredCounts.contacts += globalFacts.counts.contacts
  structuredCounts.locations += globalFacts.counts.locations
  structuredCounts.importantLinks += globalFacts.counts.importantLinks
  structuredCounts.testEndpoints += globalFacts.counts.testEndpoints

  const sections: string[] = [
    `# Website Knowledge Import`,
    `Source website: ${args.startUrl}`,
    `Firecrawl features used: crawl, sitemap discovery, map fallback, batch scrape fallback, scrape fallback, markdown/html/links extraction`,
    `Imported pages: ${cleanedPages.length}`,
    `Skipped low-value pages: ${lowValuePagesSkipped}`,
    `Raw characters collected: ${rawCharacters}`,
    globalFacts.section,
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
    structuredRecords: structuredCounts,
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
    batchScrape: async (urls) => batchScrapeWithFirecrawl(apiKey, urls),
    map: async (url, limit) => {
      return firecrawlRequest<FirecrawlMapResponse>('/map', apiKey, {
        method: 'POST',
        body: JSON.stringify({
          url,
          limit,
          includeSubdomains: false,
          ignoreSitemap: false,
        }),
      })
    },
    scrape: async (url) => {
      return firecrawlRequest<FirecrawlScrapeResponse>('/scrape', apiKey, {
        method: 'POST',
        body: JSON.stringify({
          url,
          formats: ['markdown', 'html', 'links'],
          onlyMainContent: false,
          timeout: FIRECRAWL_REQUEST_TIMEOUT_MS,
          maxAge: 3_600_000,
        }),
      })
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
        timeout: FIRECRAWL_REQUEST_TIMEOUT_MS,
        maxAge: 3_600_000,
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

async function batchScrapeWithFirecrawl(
  apiKey: string,
  urls: ReadonlyArray<string>,
): Promise<ReadonlyArray<FirecrawlCrawlPage>> {
  const started = await firecrawlRequest<FirecrawlBatchScrapeResponse>('/batch/scrape', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      urls: [...urls],
      formats: ['markdown', 'html', 'links'],
      onlyMainContent: false,
      timeout: FIRECRAWL_REQUEST_TIMEOUT_MS,
      maxAge: 3_600_000,
    }),
  })

  if (Array.isArray(started.data) && started.data.length > 0) return started.data

  const batchId = typeof started.id === 'string' ? started.id : null
  if (!batchId) throw new Error('Firecrawl did not return a batch scrape job ID.')

  const deadline = Date.now() + FIRECRAWL_BATCH_MAX_WAIT_MS
  let latest: FirecrawlBatchScrapeResponse | null = null
  while (Date.now() < deadline) {
    latest = await firecrawlRequest<FirecrawlBatchScrapeResponse>(`/batch/scrape/${encodeURIComponent(batchId)}`, apiKey)
    if (latest.status === 'completed') break
    if (latest.status === 'failed' || latest.status === 'cancelled') {
      throw new Error(`Firecrawl batch scrape ${latest.status}.`)
    }
    await new Promise((resolve) => setTimeout(resolve, FIRECRAWL_CRAWL_POLL_INTERVAL_MS))
  }

  if (!latest || latest.status !== 'completed') {
    throw new Error('Firecrawl batch scrape did not complete before the local import timeout.')
  }

  const pages: FirecrawlCrawlPage[] = []
  if (Array.isArray(latest.data)) pages.push(...latest.data)
  let nextUrl = latest.next
  const visited = new Set<string>()
  while (nextUrl && !visited.has(nextUrl) && visited.size < 100) {
    visited.add(nextUrl)
    const next = await firecrawlRequest<FirecrawlBatchScrapeResponse>(nextUrl, apiKey)
    if (Array.isArray(next.data)) pages.push(...next.data)
    nextUrl = next.next
  }
  return pages
}

class FirecrawlRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message)
    this.name = 'FirecrawlRequestError'
  }
}

function firecrawlErrorMessage(status: number | null, fallback: string): string {
  if (status === 400) return 'Firecrawl could not process this request. Check the website URL or import settings.'
  if (status === 401 || status === 403) return 'Firecrawl API key is missing, invalid, or rejected.'
  if (status === 402) return 'Firecrawl credits or billing issue. Please check your Firecrawl account.'
  if (status === 408) return 'Firecrawl request timed out. Please try again.'
  if (status === 429) return 'Firecrawl rate limit reached. Please try again later.'
  if (status && status >= 500) return 'Firecrawl service is temporarily unavailable. Please try again later.'
  return fallback || 'Firecrawl request failed.'
}

function shouldRetryFirecrawl(status: number | null, attempt: number): boolean {
  if (attempt >= FIRECRAWL_RETRY_COUNT) return false
  return status === 408 || status === 429 || status === null || Boolean(status && status >= 500)
}

async function waitForRetry(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
}

async function firecrawlRequest(
  pathOrUrl: string,
  apiKey: string,
  init?: RequestInit,
): Promise<FirecrawlCrawlResponse>
async function firecrawlRequest<T extends { readonly success?: boolean; readonly error?: string | null }>(
  pathOrUrl: string,
  apiKey: string,
  init?: RequestInit,
): Promise<T>
async function firecrawlRequest<T extends { readonly success?: boolean; readonly error?: string | null }>(
  pathOrUrl: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<T> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${FIRECRAWL_V2_BASE_URL}${pathOrUrl}`
  for (let attempt = 0; attempt <= FIRECRAWL_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FIRECRAWL_REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => ({})) as T
      if (!response.ok || payload.success === false) {
        const message = firecrawlErrorMessage(response.status, payload.error || `Firecrawl returned HTTP ${response.status}.`)
        if (shouldRetryFirecrawl(response.status, attempt)) {
          await waitForRetry(attempt)
          continue
        }
        throw new FirecrawlRequestError(message, response.status)
      }
      return payload
    } catch (error) {
      const status = error instanceof FirecrawlRequestError ? error.status : null
      if (error instanceof Error && error.name === 'AbortError') {
        if (shouldRetryFirecrawl(408, attempt)) {
          await waitForRetry(attempt)
          continue
        }
        throw new FirecrawlRequestError(firecrawlErrorMessage(408, 'Firecrawl request timed out.'), 408)
      }
      if (shouldRetryFirecrawl(status, attempt)) {
        await waitForRetry(attempt)
        continue
      }
      if (error instanceof FirecrawlRequestError) throw error
      throw new FirecrawlRequestError(firecrawlErrorMessage(null, 'Could not connect to Firecrawl right now.'), null)
    } finally {
      clearTimeout(timer)
    }
  }
  throw new FirecrawlRequestError('Firecrawl request failed.', null)
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
  const firecrawlModesUsed = new Set<string>()
  const warnings = new Set<string>()

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
      links: extracted.links,
      qualityScore: scorePageQuality({
        url: finalUrl,
        title: extracted.title,
        content: extracted.content,
        links: extracted.links,
      }),
    })
  }

  if (args.client.crawl) {
    try {
      firecrawlModesUsed.add('crawl')
      const crawlPages = await args.client.crawl(args.startUrl, pageLimit)
      crawlPagesFound = crawlPages.length
      for (const page of crawlPages.slice(0, pageLimit)) {
        const pageUrl = page.metadata?.sourceURL ?? page.metadata?.url ?? args.startUrl
        addImportedPage(pageUrl, extractFirecrawlCrawlPageContent(page))
      }
      if (crawlPages.length > pageLimit) addReason(skippedReasons, 'page_limit_reached')
    } catch {
      addReason(skippedReasons, 'firecrawl_crawl_unavailable_map_fallback')
      warnings.add('Firecrawl crawl failed or timed out; map/batch/scrape fallback was used.')
      firecrawlModesUsed.add('fallback')
    }
  }

  if (importedPages.length === 0) {
    try {
      firecrawlModesUsed.add('map')
      mappedUrls = readFirecrawlMapUrls(await args.client.map(args.startUrl, pageLimit))
    } catch {
      addReason(skippedReasons, 'map_unavailable_single_url_fallback')
      warnings.add('Firecrawl map discovery failed; single-page scrape fallback was used.')
      firecrawlModesUsed.add('fallback')
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

  if (importedPages.length === 0 && args.client.batchScrape && discovered.urls.length > 1) {
    try {
      firecrawlModesUsed.add('batch_scrape')
      const pages = await args.client.batchScrape(discovered.urls)
      for (const page of pages) {
        const pageUrl = page.metadata?.sourceURL ?? page.metadata?.url ?? args.startUrl
        addImportedPage(pageUrl, extractFirecrawlCrawlPageContent(page))
      }
    } catch {
      addReason(skippedReasons, 'batch_scrape_failed')
      warnings.add('Firecrawl batch scrape failed; page-by-page scrape fallback was used.')
      firecrawlModesUsed.add('fallback')
    }
  }

  if (importedPages.length === 0) {
    for (const pageUrl of discovered.urls) {
      try {
        firecrawlModesUsed.add('scrape')
        const scraped = await args.client.scrape(pageUrl)
        addImportedPage(pageUrl, extractFirecrawlContent(scraped))
      } catch {
        pagesFailed += 1
        addReason(skippedReasons, 'scrape_failed')
        warnings.add('Some pages failed during Firecrawl scrape and were skipped.')
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
    warnings.add('Low-value/private/form/archive pages were skipped from chatbot knowledge.')
  }
  if (built.capped) warnings.add('Final knowledge reached the CRM character limit and was capped.')

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
      firecrawlModesUsed: Array.from(firecrawlModesUsed),
      structuredRecords: built.structuredRecords,
      warnings: Array.from(warnings),
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
