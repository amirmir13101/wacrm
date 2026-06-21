import { buildChunkSearchMetadata } from '@/lib/ai/retrieval'
import { resolveAiProviderConfig } from '@/lib/ai/provider'
import { parseProviderErrorResponse, safeProviderErrorFromUnknown } from '@/lib/ai/provider-errors'
import {
  buildWebsiteKnowledgeDraft,
  type WebsiteImportPage,
  type WebsiteImportResult,
  type WebsiteImportStructuringSummary,
} from '@/lib/ai/website-import'

export interface AiStructuringSettings {
  readonly enabled: boolean
  readonly callCap: number
}

export interface StructuringPageContext {
  readonly url: string
  readonly title: string | null
  readonly headingPath?: string | null
  readonly text: string
}

export interface GroundingSummary {
  readonly kept: number
  readonly dropped: number
  readonly droppedPaths: readonly string[]
}

export interface StructuredPageFacts {
  readonly facts: Record<string, unknown>
  readonly grounding: GroundingSummary
  readonly source: 'deterministic' | 'ai_structured' | 'mixed' | 'disabled' | 'unavailable' | 'failed'
  readonly message: string | null
}

interface StructuringProviderConfig {
  readonly baseUrl: string
  readonly apiKey: string
  readonly model: string
  readonly provider: string
}

interface StructuringDependencies {
  readonly fetchImpl?: typeof fetch
  readonly resolveProvider?: (workspaceId: string) => Promise<StructuringProviderConfig | null>
  readonly maxDurationMs?: number
  readonly pageTimeoutMs?: number
}

const DEFAULT_STRUCTURING_CALL_CAP = 10
const MAX_STRUCTURING_CALL_CAP = 50
const MAX_PAGE_TEXT_FOR_STRUCTURING = 18_000
const DEFAULT_STRUCTURING_TOTAL_TIMEOUT_MS = 45_000
const DEFAULT_STRUCTURING_PAGE_TIMEOUT_MS = 12_000

export function normalizeStructuringCallCap(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_STRUCTURING_CALL_CAP
  return Math.max(0, Math.min(MAX_STRUCTURING_CALL_CAP, Math.floor(value)))
}

export async function enhanceWebsiteImportWithAiStructuring(args: {
  readonly workspaceId: string
  readonly result: WebsiteImportResult
  readonly settings: AiStructuringSettings
  readonly dependencies?: StructuringDependencies
}): Promise<WebsiteImportResult> {
  const deterministicPages = args.result.pages.map((page) => addDeterministicStructuring(page, args.settings.enabled ? 'deterministic' : 'disabled'))
  if (!args.settings.enabled) {
    return {
      ...args.result,
      pages: deterministicPages,
      aiStructuring: disabledSummary(args.settings.callCap),
      qualityWarnings: [...args.result.qualityWarnings, 'AI structuring disabled; using standard deterministic extraction.'],
    }
  }

  const callCap = normalizeStructuringCallCap(args.settings.callCap)
  if (callCap <= 0) {
    return {
      ...args.result,
      pages: deterministicPages,
      aiStructuring: { ...disabledSummary(0), enabled: true, status: 'disabled', messages: ['AI structuring call cap is 0; using standard extraction.'] },
      qualityWarnings: [...args.result.qualityWarnings, 'AI structuring call cap is 0; using standard extraction.'],
    }
  }

  const provider = await (args.dependencies?.resolveProvider ?? resolveStructuringProvider)(args.workspaceId)
  if (!provider) {
    const summary: WebsiteImportStructuringSummary = {
      enabled: true,
      status: 'unavailable',
      callCap,
      pagesAttempted: 0,
      pagesSucceeded: 0,
      pagesFailed: 0,
      fieldsKept: 0,
      fieldsDropped: 0,
      messages: ['AI structuring unavailable: provider key not configured.'],
    }
    return {
      ...args.result,
      pages: deterministicPages.map((page) => ({ ...page, structuringSource: 'unavailable' })),
      aiStructuring: summary,
      qualityWarnings: [...args.result.qualityWarnings, ...summary.messages],
    }
  }

  const candidates = rankStructuringPages(deterministicPages).slice(0, callCap)
  const byUrl = new Map(deterministicPages.map((page) => [page.canonicalUrl ?? page.url, page]))
  let pagesAttempted = 0
  let pagesSucceeded = 0
  let pagesFailed = 0
  let fieldsKept = 0
  let fieldsDropped = 0
  const messages: string[] = []
  const startedAt = Date.now()

  for (const page of candidates) {
    if (!page.cleanedText) continue
    const remainingMs = resolveRemainingStructuringMs(startedAt, args.dependencies?.maxDurationMs)
    if (remainingMs <= 1_000) {
      messages.push('AI structuring stopped before all eligible pages were processed because the safe request time budget was reached.')
      break
    }
    pagesAttempted += 1
    const structured = await structurePageWithProvider({
      provider,
      page: {
        url: page.canonicalUrl ?? page.url,
        title: page.title,
        text: page.cleanedText,
      },
      fetchImpl: args.dependencies?.fetchImpl,
      timeoutMs: Math.min(args.dependencies?.pageTimeoutMs ?? DEFAULT_STRUCTURING_PAGE_TIMEOUT_MS, remainingMs),
    })
    fieldsKept += structured.grounding.kept
    fieldsDropped += structured.grounding.dropped
    if (structured.source === 'ai_structured' || structured.source === 'mixed') pagesSucceeded += 1
    else pagesFailed += 1
    if (structured.message) messages.push(structured.message)
    byUrl.set(page.canonicalUrl ?? page.url, {
      ...page,
      structuredFacts: structured.facts,
      structuringSource: structured.source,
      structuringGrounding: {
        kept: structured.grounding.kept,
        dropped: structured.grounding.dropped,
        dropped_paths: structured.grounding.droppedPaths,
      },
    })
  }

  const pages = deterministicPages.map((page) => byUrl.get(page.canonicalUrl ?? page.url) ?? page)
  const status: WebsiteImportStructuringSummary['status'] = pagesAttempted === 0
    ? 'unavailable'
    : pagesSucceeded === 0
      ? 'failed'
      : pagesFailed > 0
        ? 'partial'
        : 'completed'
  const summary: WebsiteImportStructuringSummary = {
    enabled: true,
    status,
    callCap,
    pagesAttempted,
    pagesSucceeded,
    pagesFailed,
    fieldsKept,
    fieldsDropped,
    messages: [...new Set(messages)].slice(0, 8),
  }
  return {
    ...args.result,
    pages,
    draftContent: buildWebsiteKnowledgeDraft(pages),
    aiStructuring: summary,
    qualityWarnings: [
      ...args.result.qualityWarnings,
      `AI structuring: ${pagesSucceeded}/${pagesAttempted} pages produced grounded facts; ${fieldsDropped} fields dropped by grounding validation.`,
      ...summary.messages,
    ],
  }
}

export async function structurePageWithProvider(args: {
  readonly provider: StructuringProviderConfig
  readonly page: StructuringPageContext
  readonly fetchImpl?: typeof fetch
  readonly timeoutMs?: number
}): Promise<StructuredPageFacts> {
  const deterministic = deterministicFacts(args.page.text)
  const abortController = typeof AbortController === 'function' ? new AbortController() : null
  const timeout = abortController
    ? setTimeout(() => abortController.abort(), Math.max(50, args.timeoutMs ?? DEFAULT_STRUCTURING_PAGE_TIMEOUT_MS))
    : null
  try {
    const response = await (args.fetchImpl ?? fetch)(`${args.provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: abortController?.signal,
      headers: {
        authorization: `Bearer ${args.provider.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: args.provider.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: STRUCTURING_SYSTEM_PROMPT },
          { role: 'user', content: buildStructuringUserPrompt(args.page) },
        ],
      }),
    })
    if (!response.ok) {
      const safeError = await parseProviderErrorResponse({
        response,
        provider: args.provider.provider,
        model: args.provider.model,
        requestType: 'ai-structuring',
      })
      return fallbackStructuredFacts(deterministic, 'unavailable', `AI structuring unavailable: provider error. ${safeError.adminMessage}`)
    }
    const payload = await response.json().catch(() => null)
    const content = readAssistantContent(payload)
    const parsed = parseStructuredJson(content)
    if (!parsed) return fallbackStructuredFacts(deterministic, 'failed', 'AI structuring produced no verifiable facts for this page; using standard extraction.')
    const grounded = groundStructuredFacts(parsed, args.page.text)
    const merged = mergeStructuredFacts(deterministic, grounded.facts)
    const source = grounded.grounding.kept > 0 ? 'mixed' : 'failed'
    return {
      facts: merged,
      grounding: grounded.grounding,
      source,
      message: grounded.grounding.kept > 0
        ? null
        : 'AI structuring produced no verifiable facts for this page; using standard extraction.',
    }
  } catch (error) {
    const safeError = safeProviderErrorFromUnknown({
      error,
      provider: args.provider.provider,
      model: args.provider.model,
      requestType: 'ai-structuring',
    })
    return fallbackStructuredFacts(deterministic, 'unavailable', `AI structuring unavailable: provider error. ${safeError.adminMessage}`)
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export function groundStructuredFacts(value: unknown, rawText: string): { readonly facts: Record<string, unknown>; readonly grounding: GroundingSummary } {
  const droppedPaths: string[] = []
  let kept = 0
  let dropped = 0
  const grounded = groundValue(value, rawText, '$', droppedPaths, () => { kept += 1 }, () => { dropped += 1 })
  return {
    facts: isRecord(grounded) ? grounded : {},
    grounding: { kept, dropped, droppedPaths },
  }
}

export function mergeStructuredFacts(deterministic: Record<string, unknown>, aiFacts: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...deterministic }
  for (const [key, value] of Object.entries(aiFacts)) {
    if (key === 'pricing_offers' && Array.isArray(value)) {
      merged.pricing_offers = mergePricingOffers(Array.isArray(deterministic.pricing_offers) ? deterministic.pricing_offers : [], value)
    } else if (Array.isArray(value)) {
      merged[key] = mergeFactArrays(Array.isArray(merged[key]) ? merged[key] as unknown[] : [], value)
    } else if (isRecord(value)) {
      merged[key] = { ...(isRecord(merged[key]) ? merged[key] : {}), ...value }
    } else {
      merged[key] = value
    }
  }
  return merged
}

function mergePricingOffers(deterministic: readonly unknown[], aiOffers: readonly unknown[]): unknown[] {
  const byKey = new Map<string, unknown>()
  for (const offer of deterministic) byKey.set(offerKey(offer), offer)
  for (const offer of aiOffers) {
    const key = offerKey(offer)
    const incoming = { ...(isRecord(offer) ? offer : {}), structuring_source: 'ai_structured' }
    const current = byKey.get(key)
    byKey.set(key, structuredOfferCompletenessScore(incoming) > structuredOfferCompletenessScore(current) ? incoming : current ?? incoming)
  }
  return [...byKey.values()]
}

function structuredOfferCompletenessScore(value: unknown): number {
  if (!isRecord(value)) return 0
  return [
    typeof value.entity === 'string' || typeof value.entity_name === 'string' ? 8 : 0,
    isRecord(value.current_price) ? 12 : 0,
    isRecord(value.original_price) ? 10 : 0,
    Array.isArray(value.billing_totals) ? value.billing_totals.length * 12 : 0,
    Array.isArray(value.billing_options) ? value.billing_options.length * 8 : 0,
    typeof value.discount_percent === 'number' ? 5 : 0,
    typeof value.source_excerpt === 'string' ? 3 : 0,
    typeof value.source_text === 'string' ? 2 : 0,
  ].reduce((sum, score) => sum + score, 0)
}

function mergeFactArrays(existing: readonly unknown[], incoming: readonly unknown[]): unknown[] {
  const seen = new Set(existing.map((item) => JSON.stringify(item)))
  const output = [...existing]
  for (const item of incoming) {
    const key = JSON.stringify(item)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(item)
  }
  return output
}

function offerKey(value: unknown): string {
  if (!isRecord(value)) return JSON.stringify(value)
  return String(value.entity ?? value.entity_name ?? value.name ?? value.source_excerpt ?? JSON.stringify(value)).toLowerCase().replace(/\s+/g, ' ').trim()
}

function extractExplicitLabeledPricingOffers(text: string): Record<string, unknown>[] {
  const offers: Record<string, unknown>[] = []
  const lines = text
    .replace(/\s+(#{2,6}\s+)/g, '\n$1')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => /(?:^#{2,6}\s+|\b(?:plan|package|pricing|price)\b).*\bPrice:\s*/i.test(line) && /\bTotal:\s*/i.test(line))

  for (const line of lines) {
    const priceIndex = line.search(/\s+-\s+Price:\s*/i)
    if (priceIndex < 0) continue
    const heading = line.slice(0, priceIndex).replace(/^#{2,6}\s+/, '').trim()
    const detail = line.slice(priceIndex).trim()
    const currentMatch = detail.match(/Price:\s*(\$|£|€|USD|GBP|EUR|PKR|Rs\.?)?\s*(\d+(?:[.,]\d+)?)(?:\s*\/?\s*(mo|month|monthly|yr|year|yearly))?/i)
    const totalMatch = detail.match(/Total:\s*(\$|£|€|USD|GBP|EUR|PKR|Rs\.?)?\s*(\d+(?:[.,]\d+)?)\s+billed\s+per\s+(\d+)?\s*(years?|months?|weeks?|days?)/i)
    if (!currentMatch && !totalMatch) continue
    const originalMatch = [...heading.matchAll(/(\$|£|€|USD|GBP|EUR|PKR|Rs\.?)\s*(\d+(?:[.,]\d+)?)/gi)].at(-1)
    const entity = heading
      .replace(/(\$|£|€|USD|GBP|EUR|PKR|Rs\.?)\s*\d+(?:[.,]\d+)?/gi, '')
      .replace(/\b\d+(?:[.,]\d+)?\s*%\s*OFF\b/gi, '')
      .replace(/\s+-\s*$/, '')
      .trim()
    if (!entity) continue
    const currency = normalizeCurrency(currentMatch?.[1] ?? totalMatch?.[1] ?? originalMatch?.[1] ?? '$')
    const current = currentMatch
      ? {
          text: currentMatch[0].replace(/^Price:\s*/i, '').trim(),
          amount: numberFromText(currentMatch[2]),
          currency,
          period: normalizePricePeriod(currentMatch[3] ?? 'monthly'),
        }
      : null
    const original = originalMatch
      ? {
          text: originalMatch[0].trim(),
          amount: numberFromText(originalMatch[2]),
          currency: normalizeCurrency(originalMatch[1] ?? currency),
          period: current?.period ?? null,
        }
      : null
    const billingTotal = totalMatch
      ? {
          amount: numberFromText(totalMatch[2]),
          currency: normalizeCurrency(totalMatch[1] ?? currency),
          duration_count: Number(totalMatch[3] || '1'),
          duration_unit: normalizeDurationUnit(totalMatch[4] ?? ''),
          source_text: totalMatch[0].trim(),
        }
      : null
    offers.push({
      kind: 'pricing_offer',
      entity,
      entity_name: entity,
      entity_type: 'plan',
      current_price: current,
      original_price: original,
      billing_totals: billingTotal ? [billingTotal] : [],
      billing_options: billingTotal && current
        ? [{
            billing_mode: `${billingTotal.duration_count} ${billingTotal.duration_unit}${billingTotal.duration_count === 1 ? '' : 's'}`,
            effective_price: current,
            billing_total: {
              amount: billingTotal.amount,
              currency: billingTotal.currency,
              period_count: billingTotal.duration_count,
              period_unit: billingTotal.duration_unit,
            },
          }]
        : [],
      source_excerpt: line.slice(0, 500),
      source_text: line.slice(0, 1200),
      confidence: 'high',
    })
  }
  return offers
}

function numberFromText(value: string | undefined): number {
  const number = Number((value ?? '').replace(',', '.'))
  return Number.isFinite(number) ? number : 0
}

function normalizeCurrency(value: string | undefined): string {
  const currency = (value ?? '').trim().toLowerCase()
  if (currency === '£' || currency === 'gbp') return 'GBP'
  if (currency === '€' || currency === 'eur') return 'EUR'
  if (currency === 'pkr' || /^rs\.?$/i.test(currency)) return 'PKR'
  return 'USD'
}

function normalizePricePeriod(value: string): string | null {
  const period = value.toLowerCase()
  if (/mo|month/.test(period)) return 'monthly'
  if (/yr|year/.test(period)) return 'yearly'
  return null
}

function normalizeDurationUnit(value: string): string {
  const unit = value.toLowerCase()
  if (unit.startsWith('year')) return 'year'
  if (unit.startsWith('month')) return 'month'
  if (unit.startsWith('week')) return 'week'
  if (unit.startsWith('day')) return 'day'
  return unit.replace(/s$/, '') || 'period'
}

function addDeterministicStructuring(page: WebsiteImportPage, source: WebsiteImportPage['structuringSource']): WebsiteImportPage {
  if (page.status !== 'imported' || !page.cleanedText) return { ...page, structuringSource: source }
  return {
    ...page,
    structuredFacts: deterministicFacts(page.cleanedText),
    structuringSource: source,
    structuringGrounding: { kept: 0, dropped: 0, dropped_paths: [] },
  }
}

function deterministicFacts(text: string): Record<string, unknown> {
  const metadata = buildChunkSearchMetadata(text, 0)
  const facts = isRecord(metadata.structured_facts) ? metadata.structured_facts : {}
  const labeledOffers = extractExplicitLabeledPricingOffers(text)
  return labeledOffers.length > 0
    ? mergeStructuredFacts(facts, { pricing_offers: labeledOffers })
    : facts
}

function fallbackStructuredFacts(facts: Record<string, unknown>, source: StructuredPageFacts['source'], message: string): StructuredPageFacts {
  return {
    facts,
    grounding: { kept: 0, dropped: 0, droppedPaths: [] },
    source,
    message,
  }
}

function resolveRemainingStructuringMs(startedAt: number, maxDurationMs?: number): number {
  const budget = typeof maxDurationMs === 'number' && Number.isFinite(maxDurationMs)
    ? Math.max(1, maxDurationMs)
    : DEFAULT_STRUCTURING_TOTAL_TIMEOUT_MS
  return budget - (Date.now() - startedAt)
}

async function resolveStructuringProvider(workspaceId: string): Promise<StructuringProviderConfig | null> {
  const config = await resolveAiProviderConfig(workspaceId)
  if (!config?.supportedForChat) return null
  return { baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model, provider: config.provider }
}

function rankStructuringPages(pages: readonly WebsiteImportPage[]): WebsiteImportPage[] {
  return pages
    .filter((page) => page.status === 'imported' && Boolean(page.cleanedText))
    .sort((left, right) => scoreStructuringPage(right) - scoreStructuringPage(left))
}

function scoreStructuringPage(page: WebsiteImportPage): number {
  const text = [page.url, page.title, page.cleanedText].filter(Boolean).join(' ').toLowerCase()
  let score = 0
  if (/\b(price|pricing|plans?|packages?|products?|services?|menu|course|fee|rates?)\b/.test(text)) score += 50
  if (/\b(contact|phone|email|address|location|hours?|opening|support)\b/.test(text)) score += 30
  if (/\b(refund|return|policy|terms|shipping|delivery|faq)\b/.test(text)) score += 25
  if (/\/$/.test(page.url)) score += 10
  return score
}

const STRUCTURING_SYSTEM_PROMPT = [
  'You extract structured business facts from one source page for a CRM chatbot.',
  'Return JSON only. Do not include markdown.',
  'Never invent, calculate, guess, infer, or complete missing facts.',
  'Only output values that are literally present in the provided source text.',
  'You may classify roles of existing values: current price, original price, discount percent, billing total, SKU/code, spec, contact, policy, FAQ.',
  'If unsure, omit the field.',
  'Use existing keys such as pricing_offers, contact_info, policies, hours, faqs, specs, features.',
  'For pricing_offers, include billing_options when multiple billing choices are explicitly present.',
  'Each fact should include source_excerpt with the exact nearby source proof.',
].join('\n')

function buildStructuringUserPrompt(page: StructuringPageContext): string {
  return [
    `Page title: ${page.title ?? 'Unknown'}`,
    `Page URL: ${page.url}`,
    page.headingPath ? `Heading path: ${page.headingPath}` : '',
    'Source text:',
    page.text.slice(0, MAX_PAGE_TEXT_FOR_STRUCTURING),
  ].filter(Boolean).join('\n\n')
}

function readAssistantContent(payload: unknown): string | null {
  if (!isRecord(payload)) return null
  const choices = payload.choices
  if (!Array.isArray(choices)) return null
  const first = choices[0]
  if (!isRecord(first) || !isRecord(first.message)) return null
  return typeof first.message.content === 'string' ? first.message.content : null
}

function parseStructuredJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function groundValue(
  value: unknown,
  rawText: string,
  path: string,
  droppedPaths: string[],
  markKept: () => void,
  markDropped: () => void,
): unknown {
  if (Array.isArray(value)) {
    const kept = value
      .map((item, index) => groundValue(item, rawText, `${path}[${index}]`, droppedPaths, markKept, markDropped))
      .filter((item) => item !== undefined)
    return kept.length > 0 ? kept : undefined
  }
  if (isRecord(value)) {
    const output: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      const grounded = groundValue(item, rawText, `${path}.${key}`, droppedPaths, markKept, markDropped)
      if (grounded !== undefined) output[key] = grounded
    }
    if (!groundedObjectHasRequiredValue(path, output)) {
      markDropped()
      droppedPaths.push(path)
      return undefined
    }
    return Object.keys(output).length > 0 ? output : undefined
  }
  if (typeof value === 'number') {
    if (numberGrounded(value, rawText)) {
      markKept()
      return value
    }
    markDropped()
    droppedPaths.push(path)
    return undefined
  }
  if (typeof value === 'string') {
    if (!needsGrounding(value) || stringGrounded(value, rawText)) {
      if (needsGrounding(value)) markKept()
      return value
    }
    markDropped()
    droppedPaths.push(path)
    return undefined
  }
  if (typeof value === 'boolean' || value === null) return value
  return undefined
}

function needsGrounding(value: string): boolean {
  return /(?:\d|@|https?:\/\/|wa\.me|tel:|[$€£]|usd|pkr|eur|gbp|aed|sar|rs\.?)/i.test(value)
}

function stringGrounded(value: string, rawText: string): boolean {
  const haystack = normalizeGroundingText(rawText)
  const needle = normalizeGroundingText(value)
  if (needle && haystack.includes(needle)) return true
  if (currencyGrounded(needle, rawText)) return true
  const digits = value.replace(/\D/g, '')
  if (digits.length >= 5 && rawText.replace(/\D/g, '').includes(digits)) return true
  const amount = value.match(/\d+(?:[.,]\d+)?/)?.[0]
  return amount ? numberGrounded(Number(amount.replace(',', '.')), rawText) : false
}

function groundedObjectHasRequiredValue(path: string, value: Record<string, unknown>): boolean {
  if (Object.keys(value).length === 0) return false
  if (/\.(current_price|original_price|billing_total|discount)$/i.test(path)) {
    return typeof value.amount === 'number'
      || typeof value.percent === 'number'
      || typeof value.value === 'number'
      || typeof value.value === 'string'
  }
  if (/\.(contact_info|contacts|phones|emails)\[\d+\]$/i.test(path)) {
    return typeof value.value === 'string'
      || typeof value.href === 'string'
      || typeof value.url === 'string'
      || typeof value.phone === 'string'
      || typeof value.email === 'string'
  }
  if (/\.(pricing_offers|billing_options)\[\d+\]$/i.test(path)) {
    return typeof value.entity === 'string'
      || typeof value.name === 'string'
      || isRecord(value.current_price)
      || isRecord(value.original_price)
      || isRecord(value.billing_total)
  }
  return true
}

function currencyGrounded(normalizedValue: string, rawText: string): boolean {
  const text = rawText.toLowerCase()
  if (normalizedValue === 'usd') return text.includes('$') || text.includes('usd')
  if (normalizedValue === 'gbp') return text.includes('£') || text.includes('gbp')
  if (normalizedValue === 'eur') return text.includes('€') || text.includes('eur')
  if (normalizedValue === 'pkr') return /\brs\.?\b|pkr|₨/i.test(rawText)
  if (normalizedValue === 'aed') return /\baed\b|د\.إ/i.test(rawText)
  if (normalizedValue === 'sar') return /\bsar\b|ر\.س/i.test(rawText)
  return false
}

function numberGrounded(value: number, rawText: string): boolean {
  const rounded = String(value).replace(/\.0+$/, '')
  const escaped = rounded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\./g, '[.,]')
  return new RegExp(`(^|[^\\d])${escaped}([^\\d]|$)`).test(rawText)
}

function normalizeGroundingText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').replace(/[“”]/g, '"').trim()
}

function disabledSummary(callCap: number): WebsiteImportStructuringSummary {
  return {
    enabled: false,
    status: 'disabled',
    callCap,
    pagesAttempted: 0,
    pagesSucceeded: 0,
    pagesFailed: 0,
    fieldsKept: 0,
    fieldsDropped: 0,
    messages: ['AI structuring disabled; using standard deterministic extraction.'],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
