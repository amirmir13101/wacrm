import type { SupabaseClient } from '@supabase/supabase-js'

import {
  applyPercentage,
  applyTax,
  bulkOrTieredPrice,
  conflictingFacts,
  convertBillingPeriod,
  detectCalculationIntent,
  detectConflictingFacts,
  formatCurrency,
  prorate,
  type BillingPeriod,
  type CalculationResult,
} from '@/lib/ai/calculations'
import { generateEmbedding, hashKnowledgeContent, estimateTokenCount } from '@/lib/ai/embeddings'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export interface RetrievalQuestionAnalysis {
  readonly question: string
  readonly terms: readonly string[]
  readonly exactSignals: readonly string[]
  readonly numbers: readonly number[]
  readonly calculationIntent: ReturnType<typeof detectCalculationIntent>
}

export interface RetrievalCandidate {
  readonly id: string
  readonly sourceId: string | null
  readonly sourceTitle: string | null
  readonly sourceType: string | null
  readonly chunkText: string
  readonly searchText: string
  readonly sourceUrl: string | null
  readonly headingPath: string | null
  readonly chunkIndex: number | null
  readonly structuredFacts: Record<string, unknown> | null
  readonly exactScore: number
  readonly keywordScore: number
  readonly vectorScore: number
  readonly rrfScore: number
  readonly finalScore: number
  readonly conflictPenalty: number
}

export interface HybridRetrievalResult {
  readonly analysis: RetrievalQuestionAnalysis
  readonly evidence: readonly RetrievalCandidate[]
  readonly chunks: readonly string[]
  readonly calculation: CalculationResult | null
  readonly fallbackReason: string | null
  readonly debug: {
    readonly formula: 'rrf'
    readonly selectedChunkIds: readonly string[]
    readonly calculationInvoked: boolean
  }
}

interface KnowledgeChunkRow {
  readonly id?: string | null
  readonly workspace_id?: string | null
  readonly source_id?: string | null
  readonly chunk_text: string
  readonly search_text?: string | null
  readonly source_url?: string | null
  readonly heading_path?: string | null
  readonly chunk_index?: number | null
  readonly structured_facts?: Record<string, unknown> | null
  readonly metadata?: Record<string, unknown> | null
  readonly source?: {
    readonly id?: string | null
    readonly title?: string | null
    readonly source_type?: string | null
    readonly status?: string | null
  } | null
}

const MAX_EVIDENCE = 6
const RRF_K = 60
const MIN_EVIDENCE_SCORE = 0.015

export function analyzeRetrievalQuestion(question: string): RetrievalQuestionAnalysis {
  const normalized = question.trim()
  const exactSignals = extractExactSignals(normalized)
  return {
    question: normalized,
    terms: tokenize(normalized),
    exactSignals,
    numbers: [...normalized.matchAll(/\b\d+(?:[.,]\d+)?\b/g)].map((match) => Number(match[0].replace(',', '.'))),
    calculationIntent: detectCalculationIntent(normalized),
  }
}

export async function hybridRetrieveKnowledge(args: {
  readonly workspaceId: string
  readonly question: string
  readonly client?: SupabaseClient
  readonly limit?: number
}): Promise<HybridRetrievalResult> {
  const admin = args.client ?? supabaseAdmin()
  const queryEmbedding = await generateEmbedding(args.question, args.workspaceId).catch(() => null)
  const rpcRows = queryEmbedding
    ? await fetchRpcMatches(admin, args.workspaceId, args.question, queryEmbedding.embedding)
    : []
  const directRows = await fetchWorkspaceChunks(admin, args.workspaceId)
  const mergedRows = mergeChunkRows([...rpcRows, ...directRows])
  return hybridRetrieveFromRows({
    question: args.question,
    rows: mergedRows,
    limit: args.limit,
  })
}

export function hybridRetrieveFromRows(args: {
  readonly question: string
  readonly rows: readonly KnowledgeChunkRow[]
  readonly limit?: number
}): HybridRetrievalResult {
  const analysis = analyzeRetrievalQuestion(args.question)
  const activeRows = args.rows.filter((row) => row.chunk_text && row.source?.status !== 'archived')
  const scored = activeRows.map((row, index) => scoreCandidate(row, index, analysis))
  const exactRanked = rankBy(scored, (item) => item.exactScore)
  const keywordRanked = rankBy(scored, (item) => item.keywordScore)
  const vectorRanked = rankBy(scored, (item) => item.vectorScore)
  const conflictGroups = detectCandidateConflicts(scored)

  const fused = scored
    .map((candidate) => {
      const rrfScore =
        reciprocalRank(exactRanked, candidate.id) +
        reciprocalRank(keywordRanked, candidate.id) +
        reciprocalRank(vectorRanked, candidate.id)
      const conflictPenalty = conflictGroups.has(candidate.id) ? 1 : 0
      return {
        ...candidate,
        rrfScore,
        conflictPenalty,
        finalScore: Math.max(0, rrfScore - conflictPenalty),
      }
    })
    .filter((candidate) => candidate.finalScore >= MIN_EVIDENCE_SCORE)
    .sort((left, right) => right.finalScore - left.finalScore)
    .slice(0, args.limit ?? MAX_EVIDENCE)

  const calculation = analysis.calculationIntent.hasIntent ? calculateFromEvidence(analysis, fused) : null
  const fallbackReason =
    fused.length === 0
      ? 'no_relevant_knowledge'
      : calculation && calculation.status !== 'computed'
        ? calculation.status
        : null

  const calculationBlock =
    calculation?.status === 'computed'
      ? `Computed fact: ${formatCalculationValue(calculation)}\nFormula: ${calculation.formula}\nSource chunk IDs: ${calculation.sourceChunkIds.join(', ')}`
      : null

  return {
    analysis,
    evidence: fused,
    chunks: [...fused.map(formatEvidenceBlock), ...(calculationBlock ? [calculationBlock] : [])],
    calculation,
    fallbackReason,
    debug: {
      formula: 'rrf',
      selectedChunkIds: fused.map((item) => item.id),
      calculationInvoked: analysis.calculationIntent.hasIntent,
    },
  }
}

export function validateGroundedAnswer(args: {
  readonly answer: string
  readonly evidence: readonly string[]
  readonly calculation?: CalculationResult | null
  readonly fallback: string
}): { readonly ok: true } | { readonly ok: false; readonly reason: string; readonly answer: string } {
  const answer = args.answer.trim()
  if (!answer || answer === args.fallback) return { ok: true }
  const evidenceText = args.evidence.join('\n').toLowerCase()
  const allowedNumbers = new Set<string>()
  for (const number of extractNumberStrings(args.evidence.join('\n'))) allowedNumbers.add(normalizeNumberString(number))
  if (args.calculation?.status === 'computed' && args.calculation.value !== null) {
    allowedNumbers.add(normalizeNumberString(String(args.calculation.value)))
    allowedNumbers.add(normalizeNumberString(args.calculation.value.toFixed(2)))
  }
  for (const number of extractNumberStrings(answer)) {
    if (!allowedNumbers.has(normalizeNumberString(number))) {
      return { ok: false, reason: 'unsupported_numeric_fact', answer: args.fallback }
    }
  }

  const claims = extractExactClaimSignals(answer)
  for (const claim of claims) {
    if (!evidenceText.includes(claim.toLowerCase())) {
      return { ok: false, reason: 'unsupported_exact_fact', answer: args.fallback }
    }
  }
  return { ok: true }
}

export function buildChunkSearchMetadata(chunkText: string, index: number, sourceUrl?: string | null): Record<string, unknown> {
  return {
    index,
    content_hash: hashKnowledgeContent(chunkText),
    token_count: estimateTokenCount(chunkText),
    source_url: sourceUrl ?? null,
    structured_facts: extractStructuredFacts(chunkText),
  }
}

async function fetchWorkspaceChunks(client: SupabaseClient, workspaceId: string): Promise<KnowledgeChunkRow[]> {
  const { data, error } = await client
    .from('ai_knowledge_chunks')
    .select('id, workspace_id, source_id, chunk_text, search_text, source_url, heading_path, chunk_index, structured_facts, metadata, source:ai_knowledge_sources!inner(id, title, source_type, status)')
    .eq('workspace_id', workspaceId)
    .eq('source.status', 'active')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as KnowledgeChunkRow[]
}

async function fetchRpcMatches(
  client: SupabaseClient,
  workspaceId: string,
  question: string,
  embedding: readonly number[],
): Promise<KnowledgeChunkRow[]> {
  const { data, error } = await client.rpc('match_ai_knowledge_chunks', {
    p_workspace_id: workspaceId,
    p_query_text: question,
    p_query_embedding: `[${embedding.join(',')}]`,
    p_match_count: 40,
    p_candidate_count: 120,
  })
  if (error) return []
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: readString(row.chunk_id),
    source_id: readString(row.source_id),
    chunk_text: readString(row.chunk_text) ?? '',
    search_text: readString(row.search_text),
    source_url: readString(row.source_url),
    heading_path: readString(row.heading_path),
    chunk_index: readNumber(row.chunk_index),
    structured_facts: isRecord(row.structured_facts) ? row.structured_facts : null,
    source: {
      id: readString(row.source_id),
      title: readString(row.source_title),
      source_type: readString(row.source_type),
      status: 'active',
    },
  }))
}

function scoreCandidate(row: KnowledgeChunkRow, index: number, analysis: RetrievalQuestionAnalysis): RetrievalCandidate {
  const text = row.search_text || row.chunk_text
  const haystack = text.toLowerCase()
  const exactScore = analysis.exactSignals.reduce((score, signal) => {
    const normalized = signal.toLowerCase()
    return score + (haystack.includes(normalized) ? 10 : 0)
  }, 0)
  const keywordScore = analysis.terms.reduce((score, term) => score + countOccurrences(haystack, term), 0)
  const vectorScore = semanticSimilarityHeuristic(analysis.question, text)
  return {
    id: row.id ?? `${row.source_id ?? 'chunk'}:${index}`,
    sourceId: row.source_id ?? null,
    sourceTitle: row.source?.title ?? null,
    sourceType: row.source?.source_type ?? null,
    chunkText: row.chunk_text,
    searchText: text,
    sourceUrl: row.source_url ?? readMetadataString(row.metadata, 'source_url'),
    headingPath: row.heading_path ?? readMetadataString(row.metadata, 'heading_path'),
    chunkIndex: row.chunk_index ?? index,
    structuredFacts: row.structured_facts ?? (isRecord(row.metadata?.structured_facts) ? row.metadata.structured_facts : null),
    exactScore,
    keywordScore,
    vectorScore,
    rrfScore: 0,
    finalScore: 0,
    conflictPenalty: 0,
  }
}

function semanticSimilarityHeuristic(question: string, text: string): number {
  const normalizedQuestion = question.toLowerCase()
  const normalizedText = text.toLowerCase()
  let score = 0
  const synonymGroups = [
    ['return', 'refund', 'exchange', 'bring it back'],
    ['hours', 'open', 'close', 'closed', 'closing', 'timing', 'schedule'],
    ['delivery', 'shipping', 'courier', 'dispatch'],
    ['address', 'location', 'branch', 'where'],
    ['price', 'cost', 'fee', 'rate', 'how much'],
    ['faq', 'question', 'answer', 'help', 'book', 'booking', 'appointment'],
  ]
  for (const group of synonymGroups) {
    if (group.some((word) => includesSemanticSignal(normalizedQuestion, word)) && group.some((word) => includesSemanticSignal(normalizedText, word))) {
      score += 8
    }
  }
  return score
}

function includesSemanticSignal(value: string, signal: string): boolean {
  if (signal.includes(' ')) return value.includes(signal)
  return new RegExp(`\\b${escapeRegex(signal)}\\b`, 'i').test(value)
}

function calculateFromEvidence(
  analysis: RetrievalQuestionAnalysis,
  candidates: readonly RetrievalCandidate[],
): CalculationResult | null {
  const facts = candidates.flatMap((candidate) => extractNumericFactsFromCandidate(candidate))
  const priceFacts = facts.filter((fact): fact is ExtractedPriceFact => fact.kind === 'price')
  const percentFacts = facts.filter((fact): fact is ExtractedPercentFact => fact.kind === 'percent')
  const taxFacts = facts.filter((fact): fact is ExtractedPercentFact => fact.kind === 'tax_rate')
  if (detectConflictingFacts(priceFacts.map((fact) => ({ value: fact.amount, label: fact.label, unit: `${fact.currency}/${fact.period ?? ''}` })))) {
    return conflictingFacts('Conflicting price facts were found.', '', priceFacts.map((fact) => fact.sourceChunkId))
  }

  const price = priceFacts[0]
  if (!price) return null
  const sourceIds = [price.sourceChunkId]
  let result: CalculationResult | null = null

  if (analysis.calculationIntent.percentage) {
    const percent = percentFacts[0]
    if (!percent) return null
    result = applyPercentage(price.amount, percent.value, /markup/i.test(analysis.question) ? 'markup' : 'discount', [...sourceIds, percent.sourceChunkId], price.currency)
  }

  if (analysis.calculationIntent.periodConversion) {
    const baseAmount = result?.status === 'computed' && result.value !== null ? result.value : price.amount
    const fromPeriod = price.period
    const toPeriod = analysis.calculationIntent.targetPeriod
    if (!fromPeriod || !toPeriod) return null
    result = convertBillingPeriod(baseAmount, fromPeriod, toPeriod, [...new Set([...(result?.sourceChunkIds ?? sourceIds)])], price.currency)
  }

  if (analysis.calculationIntent.bulk && analysis.calculationIntent.quantity) {
    result = bulkOrTieredPrice(price.amount, analysis.calculationIntent.quantity, sourceIds, extractPricingTiers(candidates), price.currency)
  }

  if (analysis.calculationIntent.proration) {
    const days = analysis.numbers
    if (days.length >= 2) result = prorate(price.amount, days[0] ?? 0, days[1] ?? 0, sourceIds, price.currency)
  }

  if (analysis.calculationIntent.tax) {
    const tax = taxFacts[0] ?? percentFacts[0]
    if (!tax) return null
    result = applyTax(price.amount, tax.value, /\b(inclusive|including)\b/i.test(analysis.question) ? 'inclusive' : 'exclusive', [...sourceIds, tax.sourceChunkId], price.currency)
  }

  return result
}

interface ExtractedPriceFact {
  readonly kind: 'price'
  readonly amount: number
  readonly currency: string
  readonly period: BillingPeriod | null
  readonly label: string | null
  readonly sourceChunkId: string
}

interface ExtractedPercentFact {
  readonly kind: 'percent' | 'tax_rate'
  readonly value: number
  readonly label: string | null
  readonly sourceChunkId: string
}

function extractNumericFactsFromCandidate(candidate: RetrievalCandidate): Array<ExtractedPriceFact | ExtractedPercentFact> {
  const text = candidate.searchText
  const facts: Array<ExtractedPriceFact | ExtractedPercentFact> = []
  for (const match of text.matchAll(/(?:(USD|PKR|EUR|GBP|AED|SAR|Rs\.?|₨|\$|€|£)\s*)?(\d+(?:[.,]\d+)?)(?:\s*(USD|PKR|EUR|GBP|AED|SAR))?(?:\s*\/?\s*(monthly|month|yearly|year|annual|weekly|week|daily|day))?/gi)) {
    const afterMatch = text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 1)
    const hasExplicitPriceMarker = Boolean(match[1] || match[3] || match[4])
    if (!hasExplicitPriceMarker && /^[a-z%]/i.test(afterMatch)) continue
    const context = text.slice(Math.max(0, match.index - 80), (match.index ?? 0) + match[0].length + 80).toLowerCase()
    if (!/(price|cost|fee|rate|plan|package|per|\/|month|year|week|day|\$|rs|pkr|usd|eur|gbp)/i.test(context)) continue
    facts.push({
      kind: 'price',
      amount: Number(match[2]?.replace(',', '.')),
      currency: normalizeCurrency(match[1] ?? match[3] ?? '$'),
      period: normalizePeriod(match[4] ?? ''),
      label: extractNearbyLabel(text, match.index ?? 0),
      sourceChunkId: candidate.id,
    })
  }
  for (const match of text.matchAll(/(\d+(?:[.,]\d+)?)\s*%\s*(discount|off|tax|vat|gst|markup)?/gi)) {
    const label = match[2]?.toLowerCase() ?? null
    facts.push({
      kind: label && /(tax|vat|gst)/.test(label) ? 'tax_rate' : 'percent',
      value: Number(match[1]?.replace(',', '.')),
      label,
      sourceChunkId: candidate.id,
    })
  }
  return facts.filter((fact) => ('amount' in fact ? Number.isFinite(fact.amount) : Number.isFinite(fact.value)))
}

function extractPricingTiers(candidates: readonly RetrievalCandidate[]) {
  return candidates.flatMap((candidate) =>
    [...candidate.searchText.matchAll(/(?:minimum|min|from|over|above|for)\s+(\d+)\s+(?:units?|items?).{0,80}?(\d+(?:[.,]\d+)?)/gi)].map((match) => ({
      minQuantity: Number(match[1]),
      unitPrice: Number(match[2]?.replace(',', '.')),
      sourceChunkId: candidate.id,
    })),
  ).filter((tier) => Number.isFinite(tier.minQuantity) && Number.isFinite(tier.unitPrice))
}

function detectCandidateConflicts(candidates: readonly RetrievalCandidate[]): Set<string> {
  const prices = candidates.flatMap((candidate) => extractNumericFactsFromCandidate(candidate).filter((fact): fact is ExtractedPriceFact => fact.kind === 'price'))
  const byLabel = new Map<string, ExtractedPriceFact[]>()
  for (const price of prices) {
    const label = normalizeConflictLabel(price.label)
    if (!label) continue
    const key = `${label}:${price.currency}:${price.period ?? ''}`.toLowerCase()
    byLabel.set(key, [...(byLabel.get(key) ?? []), price])
  }
  const conflicting = new Set<string>()
  for (const group of byLabel.values()) {
    if (new Set(group.map((fact) => fact.amount)).size > 1) {
      group.forEach((fact) => conflicting.add(fact.sourceChunkId))
    }
  }
  return conflicting
}

function normalizeConflictLabel(label: string | null): string | null {
  if (!label) return null
  const normalized = label
    .toLowerCase()
    .replace(/(?:\$|rs\.?|pkr|usd|eur|gbp)\s*\d+(?:[.,]\d+)?/gi, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:%|gb|tb|mb|core|cpu|ram|nvme|storage|month|monthly|year|yearly|mo)\b/gi, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!/[a-z]/.test(normalized)) return null

  const generic = new Set([
    'price',
    'starting from',
    'from',
    'total',
    'billed per',
    'monthly',
    'yearly',
    'plan',
    'package',
    'pricing',
  ])
  if (generic.has(normalized)) return null

  return normalized.length >= 3 ? normalized.slice(0, 80) : null
}

function formatEvidenceBlock(candidate: RetrievalCandidate): string {
  return [
    `Chunk ID: ${candidate.id}`,
    candidate.sourceTitle ? `Source: ${candidate.sourceTitle}` : '',
    candidate.sourceUrl ? `URL: ${candidate.sourceUrl}` : '',
    candidate.headingPath ? `Heading: ${candidate.headingPath}` : '',
    candidate.chunkText,
  ].filter(Boolean).join('\n')
}

function formatCalculationValue(calculation: CalculationResult): string {
  return calculation.unit && /^[A-Z]{3}$/.test(calculation.unit)
    ? formatCurrency(calculation.value ?? 0, calculation.unit)
    : `${calculation.value} ${calculation.unit}`.trim()
}

function extractStructuredFacts(text: string): Record<string, unknown> {
  return {
    prices: [...text.matchAll(/(?:\$|Rs\.?|PKR|USD|EUR|GBP)\s*\d+(?:[.,]\d+)?/gi)].map((match) => match[0]),
    percentages: [...text.matchAll(/\d+(?:[.,]\d+)?\s*%/g)].map((match) => match[0]),
  }
}

function extractExactSignals(question: string): string[] {
  const signals = new Set<string>()
  for (const match of question.matchAll(/"([^"]+)"|'([^']+)'/g)) signals.add((match[1] ?? match[2] ?? '').trim())
  for (const match of question.matchAll(/\b\d+(?:[.,]\d+)?\s?(?:gb|tb|mb|kg|g|ml|l|hours?|days?|weeks?|months?|years?|units?|items?)\b/gi)) signals.add(match[0].replace(/\s+/g, ''))
  for (const match of question.matchAll(/(?:\$|Rs\.?|PKR|USD|EUR|GBP)\s*\d+(?:[.,]\d+)?/gi)) signals.add(match[0])
  for (const term of tokenize(question).filter((term) => /\d/.test(term))) signals.add(term)
  return [...signals].filter(Boolean)
}

function extractExactClaimSignals(answer: string): string[] {
  return [
    ...answer.matchAll(/\b[A-Z]{2,}[A-Z0-9-]*\b/g),
    ...answer.matchAll(/\+?\d[\d\s().-]{7,}\d/g),
    ...answer.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
  ].map((match) => match[0])
}

function extractNumberStrings(value: string): string[] {
  return [...value.matchAll(/\b\d+(?:[.,]\d+)?\b/g)].map((match) => match[0])
}

function normalizeNumberString(value: string): string {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? String(Math.round((parsed + Number.EPSILON) * 100) / 100) : value
}

function rankBy(candidates: readonly RetrievalCandidate[], readScore: (candidate: RetrievalCandidate) => number): RetrievalCandidate[] {
  return candidates.filter((candidate) => readScore(candidate) > 0).sort((left, right) => readScore(right) - readScore(left))
}

function reciprocalRank(ranked: readonly RetrievalCandidate[], id: string): number {
  const index = ranked.findIndex((candidate) => candidate.id === id)
  return index === -1 ? 0 : 1 / (RRF_K + index + 1)
}

function mergeChunkRows(rows: readonly KnowledgeChunkRow[]): KnowledgeChunkRow[] {
  const byId = new Map<string, KnowledgeChunkRow>()
  rows.forEach((row, index) => byId.set(row.id ?? `${row.source_id ?? 'row'}:${index}`, row))
  return [...byId.values()]
}

function tokenize(value: string): string[] {
  const stopWords = new Set(['the', 'and', 'for', 'with', 'you', 'your', 'are', 'how', 'what', 'when', 'where', 'can', 'does', 'about', 'that', 'this', 'from', 'have', 'please'])
  return [...new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((term) => term.length >= 3 && !stopWords.has(term)))]
}

function countOccurrences(haystack: string, needle: string): number {
  return needle ? haystack.split(needle).length - 1 : 0
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeCurrency(value: string): string {
  const normalized = value.trim().toUpperCase()
  if (normalized === '$') return 'USD'
  if (normalized === 'RS.' || normalized === 'RS' || normalized === '₨') return 'PKR'
  return normalized.length === 3 ? normalized : 'USD'
}

function normalizePeriod(value: string): BillingPeriod | null {
  const normalized = value.toLowerCase()
  if (/day|daily/.test(normalized)) return 'daily'
  if (/week|weekly/.test(normalized)) return 'weekly'
  if (/month|monthly/.test(normalized)) return 'monthly'
  if (/year|yearly|annual/.test(normalized)) return 'yearly'
  return null
}

function extractNearbyLabel(text: string, index: number): string | null {
  const before = text.slice(Math.max(0, index - 80), index).split(/\n/).pop()?.trim()
  return before ? before.replace(/^#+\s*/, '').slice(0, 80) : null
}

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
