import { supabaseAdmin } from '@/lib/automations/admin-client'
import { loadAiConfig } from '@/lib/ai/config'
import { generateReply } from '@/lib/ai/generate'

const DEFAULT_STRUCTURING_CALL_CAP = 3
const MAX_STRUCTURING_CALL_CAP = 5
const MAX_PAGE_CHARACTERS_PER_BATCH = 16_000
const MAX_BATCH_CHARACTERS = 38_000

export interface RagWebsiteStructuringPage {
  readonly url: string
  readonly title: string | null
  readonly content: string
}

export interface RagWebsiteStructuringResult {
  readonly markdown: string
  readonly used: boolean
  readonly batchesAttempted: number
  readonly batchesSucceeded: number
  readonly recordsAccepted: number
  readonly recordsDropped: number
  readonly warnings: ReadonlyArray<string>
}

export interface RagWebsiteStructuringGenerationInput {
  readonly system: string
  readonly prompt: string
}

export type RagWebsiteStructuringGenerator = (
  input: RagWebsiteStructuringGenerationInput,
) => Promise<string>

interface GroundedFact {
  readonly label: string | null
  readonly value: string
  readonly sourceUrl: string
  readonly evidence: string
}

interface GroundedOffering {
  readonly name: string
  readonly category: string | null
  readonly description: string | null
  readonly features: ReadonlyArray<string>
  readonly sourceUrl: string
  readonly evidence: string
}

interface GroundedPrice {
  readonly name: string
  readonly variant: string | null
  readonly price: string
  readonly billingPeriod: string | null
  readonly priceType: string | null
  readonly originalPrice: string | null
  readonly discount: string | null
  readonly setupFee: string | null
  readonly features: ReadonlyArray<string>
  readonly sourceUrl: string
  readonly evidence: string
}

interface GroundedFaq {
  readonly question: string
  readonly answer: string
  readonly sourceUrl: string
  readonly evidence: string
}

interface GroundedWebsiteStructure {
  readonly businessSummary: ReadonlyArray<GroundedFact>
  readonly offerings: ReadonlyArray<GroundedOffering>
  readonly pricing: ReadonlyArray<GroundedPrice>
  readonly faqs: ReadonlyArray<GroundedFaq>
  readonly contacts: ReadonlyArray<GroundedFact>
  readonly legalDetails: ReadonlyArray<GroundedFact>
  readonly importantNotes: ReadonlyArray<GroundedFact>
}

interface GroundingCounter {
  accepted: number
  dropped: number
}

interface GroundingPage {
  readonly source: RagWebsiteStructuringPage
  readonly normalizedContent: string
}

const EMPTY_STRUCTURE: GroundedWebsiteStructure = {
  businessSummary: [],
  offerings: [],
  pricing: [],
  faqs: [],
  contacts: [],
  legalDetails: [],
  importantNotes: [],
}

const WEBSITE_STRUCTURING_SYSTEM_PROMPT = [
  'You convert website crawl evidence into clean, chatbot-ready CRM knowledge for any type of business.',
  'Return one JSON object only. Do not return Markdown, comments, or code fences.',
  'Use only facts literally present in the supplied source pages.',
  'Never invent, calculate, infer, combine, or complete missing facts.',
  'Copy factual values exactly from the source, including names, prices, billing periods, discounts, dates, phone numbers, emails, addresses, policies, and feature text.',
  'Keep every service, product, package, menu item, course, appointment, property, or plan tied to its own evidence.',
  'Never move a price, feature, limitation, or billing period from one offering to another.',
  'For every record, set source_url to the exact supplied page URL and evidence to an exact nearby source excerpt that proves every factual field in that record.',
  'For pricing, create one pricing record per explicitly visible price/billing option. Preserve monthly, yearly, multi-year, weekly, one-time, setup-fee, trial, original, current, and sale labels exactly as shown.',
  'Do not convert prices or derive totals. If a value is absent, omit that field.',
  'Use these exact top-level JSON arrays: business_summary, offerings, pricing, faqs, contacts, legal_details, important_notes.',
  'business_summary, contacts, legal_details, and important_notes records: {"label":"optional classification","value":"exact source fact","source_url":"exact URL","evidence":"exact source excerpt"}.',
  'offerings records: {"name":"exact name","category":"optional exact category","description":"optional exact description","features":["exact feature"],"source_url":"exact URL","evidence":"exact nearby excerpt"}.',
  'pricing records: {"name":"exact offering name","variant":"optional exact variant","price":"exact visible price","billing_period":"optional exact period text","price_type":"optional classification such as current, original, sale, setup fee, or billing total","original_price":"optional exact original price","discount":"optional exact discount","setup_fee":"optional exact setup fee","features":["exact nearby feature"],"source_url":"exact URL","evidence":"exact nearby excerpt containing the offering name and price"}.',
  'faqs records: {"question":"exact question","answer":"exact answer","source_url":"exact URL","evidence":"exact question and answer excerpt"}.',
  'Return empty arrays for sections not found in this evidence batch.',
].join('\n')

export async function structureRagWebsiteKnowledgeForWorkspace(args: {
  readonly workspaceId: string
  readonly startUrl: string
  readonly pages: ReadonlyArray<RagWebsiteStructuringPage>
}): Promise<RagWebsiteStructuringResult> {
  const generator = await resolveWorkspaceStructuringGenerator(args.workspaceId)
  if (!generator) {
    return unavailableResult(
      'AI structuring was not used because an enabled AI provider key is not configured. The deterministic structure and visible Firecrawl evidence were preserved.',
    )
  }

  return structureRagWebsiteKnowledge({
    startUrl: args.startUrl,
    pages: args.pages,
    generate: generator,
  })
}

export async function structureRagWebsiteKnowledge(args: {
  readonly startUrl: string
  readonly pages: ReadonlyArray<RagWebsiteStructuringPage>
  readonly generate: RagWebsiteStructuringGenerator
  readonly callCap?: number
}): Promise<RagWebsiteStructuringResult> {
  const callCap = normalizeCallCap(args.callCap)
  const batches = buildEvidenceBatches(args.pages, callCap)
  if (batches.length === 0) {
    return unavailableResult('AI structuring found no readable page evidence. The deterministic website draft was preserved.')
  }

  const generated = await Promise.all(batches.map(async (batch) => {
    try {
      const text = await args.generate({
        system: WEBSITE_STRUCTURING_SYSTEM_PROMPT,
        prompt: buildWebsiteStructuringPrompt(args.startUrl, batch),
      })
      return { text, failed: false }
    } catch {
      return { text: '', failed: true }
    }
  }))

  const pagesByUrl = buildGroundingPageMap(args.pages)
  const counter: GroundingCounter = { accepted: 0, dropped: 0 }
  let combined = EMPTY_STRUCTURE
  let batchesSucceeded = 0

  for (const result of generated) {
    if (result.failed) continue
    const parsed = parseJsonObject(result.text)
    if (!parsed) {
      counter.dropped += 1
      continue
    }
    const grounded = groundWebsiteStructure(parsed, pagesByUrl, counter)
    const acceptedBeforeMerge = countGroundedRecords(grounded)
    if (acceptedBeforeMerge > 0) batchesSucceeded += 1
    combined = mergeGroundedStructures(combined, grounded)
  }

  const markdown = renderGroundedWebsiteKnowledge(combined)
  const used = countGroundedRecords(combined) > 0
  const warnings: string[] = []
  if (!used) {
    warnings.push('AI structuring produced no source-grounded records. The deterministic structure and visible Firecrawl evidence were preserved.')
  } else {
    warnings.push(`AI structuring kept ${counter.accepted} source-grounded record${counter.accepted === 1 ? '' : 's'} and dropped ${counter.dropped} unsupported record${counter.dropped === 1 ? '' : 's'}.`)
  }
  if (batchesSucceeded < batches.length) {
    warnings.push('Some AI structuring batches were unavailable or contained no verifiable facts; visible Firecrawl evidence was preserved for review.')
  }

  return {
    markdown: used ? markdown : '',
    used,
    batchesAttempted: batches.length,
    batchesSucceeded,
    recordsAccepted: counter.accepted,
    recordsDropped: counter.dropped,
    warnings,
  }
}

async function resolveWorkspaceStructuringGenerator(
  workspaceId: string,
): Promise<RagWebsiteStructuringGenerator | null> {
  try {
    const config = await loadAiConfig(supabaseAdmin(), workspaceId, { requireActive: false })
    if (!config) return null

    return async (input) => {
      const result = await generateReply({
        config,
        systemPrompt: input.system,
        messages: [{ role: 'user', content: input.prompt }],
      })
      return result.text
    }
  } catch {
    return null
  }
}

function normalizeCallCap(value: number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.min(MAX_STRUCTURING_CALL_CAP, Math.floor(value)))
  }
  const configured = Number(process.env.RAG_WEBSITE_STRUCTURING_CALL_CAP)
  return Number.isFinite(configured)
    ? Math.max(1, Math.min(MAX_STRUCTURING_CALL_CAP, Math.floor(configured)))
    : DEFAULT_STRUCTURING_CALL_CAP
}

function buildEvidenceBatches(
  pages: ReadonlyArray<RagWebsiteStructuringPage>,
  callCap: number,
): ReadonlyArray<ReadonlyArray<RagWebsiteStructuringPage>> {
  const ordered = interleavePageSegments(prioritizeStructuringPages(pages))
  const batches: RagWebsiteStructuringPage[][] = []
  let current: RagWebsiteStructuringPage[] = []
  let currentLength = 0

  for (const page of ordered) {
    const content = page.content
    if (!content) continue
    const prepared = { ...page, content }
    const estimatedLength = content.length + page.url.length + (page.title?.length ?? 0) + 80
    if (current.length > 0 && currentLength + estimatedLength > MAX_BATCH_CHARACTERS) {
      batches.push(current)
      if (batches.length >= callCap) break
      current = []
      currentLength = 0
    }
    current.push(prepared)
    currentLength += estimatedLength
  }

  if (current.length > 0 && batches.length < callCap) batches.push(current)
  return batches
}

function interleavePageSegments(
  pages: ReadonlyArray<RagWebsiteStructuringPage>,
): ReadonlyArray<RagWebsiteStructuringPage> {
  const segmented = pages.map((page) => splitStructuringPage(page))
  const output: RagWebsiteStructuringPage[] = []
  const longest = segmented.reduce((max, segments) => Math.max(max, segments.length), 0)
  for (let index = 0; index < longest; index += 1) {
    for (const segments of segmented) {
      const segment = segments[index]
      if (segment) output.push(segment)
    }
  }
  return output
}

function splitStructuringPage(
  page: RagWebsiteStructuringPage,
): ReadonlyArray<RagWebsiteStructuringPage> {
  const content = compactStructuringText(page.content)
  if (!content) return []
  const segments: string[] = []
  let current: string[] = []
  let currentLength = 0

  for (const line of content.split('\n')) {
    if (line.length > MAX_PAGE_CHARACTERS_PER_BATCH) {
      if (current.length > 0) {
        segments.push(current.join('\n'))
        current = []
        currentLength = 0
      }
      for (let offset = 0; offset < line.length; offset += MAX_PAGE_CHARACTERS_PER_BATCH) {
        segments.push(line.slice(offset, offset + MAX_PAGE_CHARACTERS_PER_BATCH))
      }
      continue
    }
    const nextLength = currentLength + line.length + (current.length > 0 ? 1 : 0)
    if (current.length > 0 && nextLength > MAX_PAGE_CHARACTERS_PER_BATCH) {
      segments.push(current.join('\n'))
      current = []
      currentLength = 0
    }
    current.push(line)
    currentLength += line.length + (current.length > 1 ? 1 : 0)
  }
  if (current.length > 0) segments.push(current.join('\n'))

  return segments.map((segment) => ({ ...page, content: segment }))
}

function prioritizeStructuringPages(
  pages: ReadonlyArray<RagWebsiteStructuringPage>,
): ReadonlyArray<RagWebsiteStructuringPage> {
  const readable = pages
    .filter((page) => compactStructuringText(page.content).length >= 40)
    .sort((left, right) => scoreStructuringPage(right) - scoreStructuringPage(left))
  const categories = ['summary', 'offering', 'pricing', 'contact', 'faq', 'policy', 'legal'] as const
  const selected: RagWebsiteStructuringPage[] = []
  const seen = new Set<string>()

  for (const category of categories) {
    const page = readable.find((candidate) => classifyStructuringPage(candidate) === category)
    if (!page || seen.has(page.url)) continue
    seen.add(page.url)
    selected.push(page)
  }
  for (const page of readable) {
    if (seen.has(page.url)) continue
    seen.add(page.url)
    selected.push(page)
  }
  return selected
}

function classifyStructuringPage(
  page: RagWebsiteStructuringPage,
): 'summary' | 'offering' | 'pricing' | 'contact' | 'faq' | 'policy' | 'legal' | 'other' {
  const text = `${page.url} ${page.title ?? ''} ${page.content.slice(0, 4_000)}`.toLowerCase()
  if (/pricing|prices?|plans?|packages?|billing|fees?|rates?|menu/.test(text)) return 'pricing'
  if (/contact|phone|email|whatsapp|address|location|opening hours|support/.test(text)) return 'contact'
  if (/faq|frequently asked|questions?/.test(text)) return 'faq'
  if (/refund|return|privacy|terms|policy|shipping|delivery|warranty|cancellation/.test(text)) return 'policy'
  if (/company number|legal name|registered|founder|owner|director/.test(text)) return 'legal'
  if (/services?|products?|solutions?|courses?|appointments?|catalog|features?/.test(text)) return 'offering'
  if (isRootPage(page.url) || /about|company|overview/.test(text)) return 'summary'
  return 'other'
}

function scoreStructuringPage(page: RagWebsiteStructuringPage): number {
  const category = classifyStructuringPage(page)
  const categoryScore: Record<ReturnType<typeof classifyStructuringPage>, number> = {
    summary: 90,
    offering: 85,
    pricing: 100,
    contact: 95,
    faq: 80,
    policy: 78,
    legal: 82,
    other: 20,
  }
  return categoryScore[category] + Math.min(25, Math.floor(page.content.length / 1_500))
}

function isRootPage(value: string): boolean {
  try {
    const url = new URL(value)
    return url.pathname === '/' || url.pathname === ''
  } catch {
    return false
  }
}

function compactStructuringText(value: string): string {
  const lines: string[] = []
  const seen = new Set<string>()
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.replace(/[ \t]+/g, ' ').trim()
    if (!line) continue
    const key = normalizeGroundingText(line)
    if (!key || seen.has(key)) continue
    seen.add(key)
    lines.push(line)
  }
  return lines.join('\n')
}

function buildWebsiteStructuringPrompt(
  startUrl: string,
  pages: ReadonlyArray<RagWebsiteStructuringPage>,
): string {
  const evidence = pages.map((page, index) => [
    `SOURCE PAGE ${index + 1}`,
    `URL: ${page.url}`,
    `TITLE: ${page.title ?? 'Untitled page'}`,
    'VISIBLE CONTENT:',
    page.content,
  ].join('\n')).join('\n\n---\n\n')

  return [
    `Website root: ${startUrl}`,
    'Structure only the evidence in this batch. Other batches may cover other pages.',
    'Remember: values and evidence must be copied exactly; do not calculate or infer.',
    '',
    evidence,
  ].join('\n')
}

function buildGroundingPageMap(
  pages: ReadonlyArray<RagWebsiteStructuringPage>,
): ReadonlyMap<string, GroundingPage> {
  const output = new Map<string, GroundingPage>()
  for (const page of pages) {
    output.set(normalizeSourceUrl(page.url), {
      source: page,
      normalizedContent: normalizeGroundingText(page.content),
    })
  }
  return output
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = (fenced ?? value).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed: unknown = JSON.parse(candidate.slice(start, end + 1))
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function groundWebsiteStructure(
  value: Record<string, unknown>,
  pagesByUrl: ReadonlyMap<string, GroundingPage>,
  counter: GroundingCounter,
): GroundedWebsiteStructure {
  return {
    businessSummary: groundFactArray(value.business_summary, pagesByUrl, counter),
    offerings: groundOfferingArray(value.offerings, pagesByUrl, counter),
    pricing: groundPriceArray(value.pricing, pagesByUrl, counter),
    faqs: groundFaqArray(value.faqs, pagesByUrl, counter),
    contacts: groundFactArray(value.contacts, pagesByUrl, counter),
    legalDetails: groundFactArray(value.legal_details, pagesByUrl, counter),
    importantNotes: groundFactArray(value.important_notes, pagesByUrl, counter),
  }
}

function groundFactArray(
  value: unknown,
  pagesByUrl: ReadonlyMap<string, GroundingPage>,
  counter: GroundingCounter,
): ReadonlyArray<GroundedFact> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const context = groundingContext(item, pagesByUrl)
    const factValue = readString(item, 'value')
    if (!context || !factValue || !isGroundedValue(factValue, context)) {
      counter.dropped += 1
      return []
    }
    counter.accepted += 1
    return [{
      label: readString(item, 'label'),
      value: factValue,
      sourceUrl: context.page.source.url,
      evidence: context.evidence,
    }]
  })
}

function groundOfferingArray(
  value: unknown,
  pagesByUrl: ReadonlyMap<string, GroundingPage>,
  counter: GroundingCounter,
): ReadonlyArray<GroundedOffering> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const context = groundingContext(item, pagesByUrl)
    const name = readString(item, 'name')
    if (!context || !name || !isGroundedInEvidence(name, context.evidence)) {
      counter.dropped += 1
      return []
    }
    const category = groundedOptionalString(item, 'category', context)
    const description = groundedOptionalString(item, 'description', context)
    const features = groundedStringArray(readValue(item, 'features'), context, true)
    counter.accepted += 1
    return [{
      name,
      category,
      description,
      features,
      sourceUrl: context.page.source.url,
      evidence: context.evidence,
    }]
  })
}

function groundPriceArray(
  value: unknown,
  pagesByUrl: ReadonlyMap<string, GroundingPage>,
  counter: GroundingCounter,
): ReadonlyArray<GroundedPrice> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const context = groundingContext(item, pagesByUrl)
    const name = readString(item, 'name')
    const price = readString(item, 'price')
    if (
      !context ||
      !name ||
      !price ||
      !isGroundedInEvidence(name, context.evidence) ||
      !isGroundedInEvidence(price, context.evidence)
    ) {
      counter.dropped += 1
      return []
    }
    counter.accepted += 1
    return [{
      name,
      variant: groundedOptionalString(item, 'variant', context, true),
      price,
      billingPeriod: groundedOptionalString(item, 'billing_period', context, true),
      priceType: controlledPriceType(readString(item, 'price_type')),
      originalPrice: groundedOptionalString(item, 'original_price', context, true),
      discount: groundedOptionalString(item, 'discount', context, true),
      setupFee: groundedOptionalString(item, 'setup_fee', context, true),
      features: groundedStringArray(readValue(item, 'features'), context, true),
      sourceUrl: context.page.source.url,
      evidence: context.evidence,
    }]
  })
}

function groundFaqArray(
  value: unknown,
  pagesByUrl: ReadonlyMap<string, GroundingPage>,
  counter: GroundingCounter,
): ReadonlyArray<GroundedFaq> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const context = groundingContext(item, pagesByUrl)
    const question = readString(item, 'question')
    const answer = readString(item, 'answer')
    if (
      !context ||
      !question ||
      !answer ||
      !isGroundedValue(question, context) ||
      !isGroundedValue(answer, context)
    ) {
      counter.dropped += 1
      return []
    }
    counter.accepted += 1
    return [{
      question,
      answer,
      sourceUrl: context.page.source.url,
      evidence: context.evidence,
    }]
  })
}

function groundingContext(
  value: unknown,
  pagesByUrl: ReadonlyMap<string, GroundingPage>,
): { readonly page: GroundingPage; readonly evidence: string } | null {
  if (!isRecord(value)) return null
  const sourceUrl = readString(value, 'source_url')
  const evidence = readString(value, 'evidence')
  if (!sourceUrl || !evidence) return null
  const page = pagesByUrl.get(normalizeSourceUrl(sourceUrl))
  if (!page || !evidenceGrounded(evidence, page.normalizedContent)) return null
  return { page, evidence: singleLine(evidence).slice(0, 1_200) }
}

function evidenceGrounded(evidence: string, normalizedPage: string): boolean {
  const normalizedEvidence = normalizeGroundingText(evidence)
  if (normalizedEvidence.length < 8) return false
  if (normalizedPage.includes(normalizedEvidence)) return true
  if (!specificEvidenceClaimsGrounded(evidence, normalizedPage)) return false
  const words = normalizedEvidence.split(' ').filter((word) => word.length > 1)
  if (words.length < 5) return false
  const matched = words.filter((word) => normalizedPage.includes(word)).length
  return matched / words.length >= 0.92
}

function specificEvidenceClaimsGrounded(evidence: string, normalizedPage: string): boolean {
  const claims = evidence.match(
    /https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:[$£€₨₹]\s*\d[\d,.]*|\b(?:USD|EUR|GBP|PKR|AED|CAD|AUD|INR|Rs\.?)\s*\d[\d,.]*)|\b\d+(?:[.,]\d+)?\s*%|\b(?:\+?\d[\d\s().-]{6,}\d)\b/gi,
  ) ?? []
  return claims.every((claim) => {
    const normalizedClaim = normalizeGroundingText(claim).replace(/[.,;:]+$/, '')
    if (normalizedPage.includes(normalizedClaim)) return true
    const digits = claim.replace(/\D/g, '')
    return digits.length >= 5 && normalizedPage.replace(/\D/g, '').includes(digits)
  })
}

function isGroundedValue(
  value: string,
  context: { readonly page: GroundingPage; readonly evidence: string },
): boolean {
  return isGroundedInEvidence(value, context.evidence) || context.page.normalizedContent.includes(normalizeGroundingText(value))
}

function isGroundedInEvidence(value: string, evidence: string): boolean {
  const normalizedValue = normalizeGroundingText(value)
  const normalizedEvidence = normalizeGroundingText(evidence)
  if (!normalizedValue) return false
  if (normalizedEvidence.includes(normalizedValue)) return true
  const digits = value.replace(/\D/g, '')
  return digits.length >= 5 && evidence.replace(/\D/g, '').includes(digits)
}

function groundedOptionalString(
  value: unknown,
  key: string,
  context: { readonly page: GroundingPage; readonly evidence: string },
  requireNearbyEvidence = false,
): string | null {
  const candidate = readString(value, key)
  if (!candidate) return null
  return (requireNearbyEvidence ? isGroundedInEvidence(candidate, context.evidence) : isGroundedValue(candidate, context))
    ? candidate
    : null
}

function groundedStringArray(
  value: unknown,
  context: { readonly page: GroundingPage; readonly evidence: string },
  requireNearbyEvidence: boolean,
): ReadonlyArray<string> {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string =>
    typeof item === 'string' &&
    (requireNearbyEvidence ? isGroundedInEvidence(item, context.evidence) : isGroundedValue(item, context)),
  )
}

function controlledPriceType(value: string | null): string | null {
  if (!value) return null
  const normalized = value.toLowerCase().replace(/[_-]+/g, ' ').trim()
  return /^(current|original|sale|discounted|list|setup fee|billing total|trial|one time)$/.test(normalized)
    ? normalized
    : null
}

function mergeGroundedStructures(
  left: GroundedWebsiteStructure,
  right: GroundedWebsiteStructure,
): GroundedWebsiteStructure {
  return {
    businessSummary: uniqueRecords([...left.businessSummary, ...right.businessSummary]),
    offerings: uniqueRecords([...left.offerings, ...right.offerings]),
    pricing: uniqueRecords([...left.pricing, ...right.pricing]),
    faqs: uniqueRecords([...left.faqs, ...right.faqs]),
    contacts: uniqueRecords([...left.contacts, ...right.contacts]),
    legalDetails: uniqueRecords([...left.legalDetails, ...right.legalDetails]),
    importantNotes: uniqueRecords([...left.importantNotes, ...right.importantNotes]),
  }
}

function uniqueRecords<T>(values: ReadonlyArray<T>): ReadonlyArray<T> {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = JSON.stringify(value).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function countGroundedRecords(value: GroundedWebsiteStructure): number {
  return value.businessSummary.length +
    value.offerings.length +
    value.pricing.length +
    value.faqs.length +
    value.contacts.length +
    value.legalDetails.length +
    value.importantNotes.length
}

function renderGroundedWebsiteKnowledge(value: GroundedWebsiteStructure): string {
  const sourceUrls = uniqueRecords([
    ...value.businessSummary.map((item) => item.sourceUrl),
    ...value.offerings.map((item) => item.sourceUrl),
    ...value.pricing.map((item) => item.sourceUrl),
    ...value.faqs.map((item) => item.sourceUrl),
    ...value.contacts.map((item) => item.sourceUrl),
    ...value.legalDetails.map((item) => item.sourceUrl),
    ...value.importantNotes.map((item) => item.sourceUrl),
  ])
  return [
    '# Business Summary',
    renderFacts(value.businessSummary),
    '# Services / Products / Plans',
    renderOfferings(value.offerings),
    '# Pricing',
    renderPricing(value.pricing),
    '# FAQs',
    renderFaqs(value.faqs),
    '# Contact Details',
    renderFacts(value.contacts),
    '# Legal / Company Details',
    renderFacts(value.legalDetails),
    '# Important Notes',
    renderFacts(value.importantNotes),
    '# Source Evidence',
    sourceUrls.length > 0 ? sourceUrls.map((url) => `- ${url}`).join('\n') : emptySectionText(),
  ].join('\n\n')
}

function renderFacts(values: ReadonlyArray<GroundedFact>): string {
  if (values.length === 0) return emptySectionText()
  return values.map((item) => [
    `- ${item.label ? `${singleLine(item.label)}: ` : ''}${singleLine(item.value)}`,
    `  - Source URL: ${item.sourceUrl}`,
    `  - Evidence: ${item.evidence}`,
  ].join('\n')).join('\n')
}

function renderOfferings(values: ReadonlyArray<GroundedOffering>): string {
  if (values.length === 0) return emptySectionText()
  return values.map((item) => [
    `## ${singleLine(item.name)}`,
    item.category ? `- Category: ${singleLine(item.category)}` : '',
    item.description ? `- Description: ${singleLine(item.description)}` : '',
    item.features.length > 0 ? ['- Features:', ...item.features.map((feature) => `  - ${singleLine(feature)}`)].join('\n') : '',
    `- Source URL: ${item.sourceUrl}`,
    `- Evidence: ${item.evidence}`,
  ].filter(Boolean).join('\n')).join('\n\n')
}

function renderPricing(values: ReadonlyArray<GroundedPrice>): string {
  if (values.length === 0) return emptySectionText()
  return values.map((item) => [
    `## ${singleLine(item.name)}${item.variant ? ` — ${singleLine(item.variant)}` : ''}`,
    `- Price: ${singleLine(item.price)}`,
    item.billingPeriod ? `- Billing period: ${singleLine(item.billingPeriod)}` : '',
    item.priceType ? `- Price type: ${singleLine(item.priceType)}` : '',
    item.originalPrice ? `- Original price: ${singleLine(item.originalPrice)}` : '',
    item.discount ? `- Discount: ${singleLine(item.discount)}` : '',
    item.setupFee ? `- Setup fee: ${singleLine(item.setupFee)}` : '',
    item.features.length > 0 ? ['- Included features:', ...item.features.map((feature) => `  - ${singleLine(feature)}`)].join('\n') : '',
    `- Source URL: ${item.sourceUrl}`,
    `- Evidence: ${item.evidence}`,
  ].filter(Boolean).join('\n')).join('\n\n')
}

function renderFaqs(values: ReadonlyArray<GroundedFaq>): string {
  if (values.length === 0) return emptySectionText()
  return values.map((item) => [
    `## ${singleLine(item.question)}`,
    singleLine(item.answer),
    `- Source URL: ${item.sourceUrl}`,
    `- Evidence: ${item.evidence}`,
  ].join('\n')).join('\n\n')
}

function emptySectionText(): string {
  return '- No verified details were found in the crawled content.'
}

function unavailableResult(warning: string): RagWebsiteStructuringResult {
  return {
    markdown: '',
    used: false,
    batchesAttempted: 0,
    batchesSucceeded: 0,
    recordsAccepted: 0,
    recordsDropped: 0,
    warnings: [warning],
  }
}

function normalizeSourceUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return value.trim().replace(/\/$/, '').toLowerCase()
  }
}

function normalizeGroundingText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_~#>|\[\](){}]/g, ' ')
    .replace(/[^\p{L}\p{N}@+:/.,%$£€₨₹-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function readString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null
  const candidate = value[key]
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

function readValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
