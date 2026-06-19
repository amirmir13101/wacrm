import type { SupabaseClient } from '@supabase/supabase-js'

import {
  applyPercentage,
  applyTax,
  bulkOrTieredPrice,
  conflictingFacts,
  convertBillingTotal,
  detectCalculationIntent,
  formatCurrency,
  prorate,
  type BillingPeriod,
  type CalculationResult,
} from '@/lib/ai/calculations'
import { generateEmbedding, hashKnowledgeContent, estimateTokenCount } from '@/lib/ai/embeddings'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export interface RetrievalQuestionAnalysis {
  readonly question: string
  readonly contextualQuery: string | null
  readonly terms: readonly string[]
  readonly entityTerms: readonly string[]
  readonly entityPhrases: readonly string[]
  readonly queryVariants: readonly string[]
  readonly exactSignals: readonly string[]
  readonly numbers: readonly number[]
  readonly intents: RetrievalIntents
  readonly comparison: {
    readonly enabled: boolean
    readonly entities: readonly string[]
  }
  readonly calculationIntent: ReturnType<typeof detectCalculationIntent>
}

export interface RetrievalIntents {
  readonly pricing: boolean
  readonly policy: boolean
  readonly hours: boolean
  readonly contact: boolean
  readonly location: boolean
  readonly faq: boolean
  readonly productOrService: boolean
  readonly company: boolean
  readonly ownership: boolean
  readonly date: boolean
  readonly comparison: boolean
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
  readonly entityScore: number
  readonly phraseScore: number
  readonly headingScore: number
  readonly answerScore: number
  readonly proximityScore: number
  readonly neighborScore: number
  readonly noisePenalty: number
  readonly vectorScore: number
  readonly rrfScore: number
  readonly finalScore: number
  readonly conflictPenalty: number
  readonly reasons: readonly string[]
  readonly rerankScore: number
  readonly rerankReasons: readonly string[]
}

export interface HybridRetrievalResult {
  readonly analysis: RetrievalQuestionAnalysis
  readonly evidence: readonly RetrievalCandidate[]
  readonly chunks: readonly string[]
  readonly calculation: CalculationResult | null
  readonly fallbackReason: string | null
  readonly debug: {
    readonly formula: 'rrf'
    readonly activeChunkCount: number
    readonly exactCandidatesCount: number
    readonly keywordCandidatesCount: number
    readonly vectorCandidatesCount: number
    readonly answerBearingCandidatesCount: number
    readonly selectedChunkIds: readonly string[]
    readonly selectedEvidence: ReadonlyArray<{
      readonly id: string
      readonly sourceTitle: string | null
      readonly sourceUrl: string | null
      readonly exactScore: number
      readonly keywordScore: number
      readonly vectorScore: number
      readonly finalScore: number
      readonly matchTypes: readonly string[]
      readonly reasons: readonly string[]
      readonly rerankScore: number
      readonly rerankReasons: readonly string[]
    }>
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
const MIN_ROBUST_SCORE = 8

const QUERY_SYNONYM_GROUPS = [
  ['price', 'pricing', 'cost', 'fee', 'rate', 'charge', 'how much'],
  ['phone', 'contact number', 'telephone', 'call', 'number'],
  ['email', 'mail', 'contact', 'reach', 'write to'],
  ['hours', 'open', 'available', 'schedule', 'timing', 'when'],
  ['return', 'refund', 'money back', 'cancel', 'reimbursement'],
  ['delivery', 'shipping', 'dispatch', 'send', 'ship'],
  ['owner', 'founder', 'who runs', 'behind', 'company'],
  ['address', 'location', 'where', 'find us', 'situated'],
] as const

export function expandQuery(question: string): string[] {
  const original = question.trim()
  if (!original) return []
  const variants = new Set<string>([original])
  const normalized = original.replace(/\s+/g, ' ').trim()
  const normalizedForms = [
    normalized.replace(/^what is the price of\s+(.+?)\??$/i, '$1 price'),
    normalized.replace(/^how much does\s+(.+?)\s+cost\??$/i, '$1 cost'),
    normalized.replace(/^do you offer\s+(.+?)\??$/i, '$1'),
    normalized.replace(/^can i get\s+(.+?)\??$/i, '$1'),
    normalized.replace(/^tell me about\s+(.+?)\??$/i, '$1 information'),
  ]
  normalizedForms.filter((variant) => variant !== normalized).forEach((variant) => variants.add(variant.trim()))

  for (const group of QUERY_SYNONYM_GROUPS) {
    const matched = group.find((synonym) => includesSemanticSignal(normalized.toLowerCase(), synonym))
    if (!matched) continue
    for (const synonym of group) {
      if (synonym === matched) continue
      variants.add(replaceSignalPreservingCase(normalized, matched, synonym))
      if (variants.size >= 5) break
    }
    if (variants.size >= 5) break
  }

  return [...variants].filter(Boolean).slice(0, 5)
}

export function analyzeRetrievalQuestion(question: string, contextualQuery?: string | null): RetrievalQuestionAnalysis {
  const normalized = question.trim()
  const context = contextualQuery?.trim() ?? ''
  const contextTerms = context ? tokenize(context) : []
  const exactSignals = [...new Set([...extractExactSignals(normalized), ...extractExactSignals(context)])]
  const currentTerms = tokenize(normalized)
  const terms = [...new Set([...currentTerms, ...contextTerms])].slice(0, 30)
  const currentIntents = detectRetrievalIntents(normalized)
  const contextIntents = context ? detectRetrievalIntents(context) : null
  const comparison = detectComparisonIntent(normalized)
  const intents = mergeRetrievalIntents(currentIntents, contextIntents, comparison.enabled)
  const entityTerms = extractEntityTerms(normalized, terms, intents, context)
  const comparisonEntities = comparison.entities.filter((entity) => !entityTerms.includes(entity))
  const mergedEntityTerms = [...entityTerms, ...comparisonEntities].slice(0, 12)
  const entityPhrases = extractEntityPhrases(mergedEntityTerms)
  return {
    question: normalized,
    contextualQuery: context || null,
    terms,
    entityTerms: mergedEntityTerms,
    entityPhrases,
    queryVariants: buildQueryVariants(normalized, terms, mergedEntityTerms, entityPhrases, intents),
    exactSignals,
    numbers: [...normalized.matchAll(/\b\d+(?:[.,]\d+)?\b/g)].map((match) => Number(match[0].replace(',', '.'))),
    intents,
    comparison,
    calculationIntent: detectCalculationIntent(normalized),
  }
}

export async function hybridRetrieveKnowledge(args: {
  readonly workspaceId: string
  readonly question: string
  readonly contextualQuery?: string | null
  readonly client?: SupabaseClient
  readonly limit?: number
}): Promise<HybridRetrievalResult> {
  const admin = args.client ?? supabaseAdmin()
  const queryForEmbedding = [args.contextualQuery, args.question].filter(Boolean).join('\n')
  const queryEmbedding = await generateEmbedding(queryForEmbedding || args.question, args.workspaceId).catch(() => null)
  const rpcRows = queryEmbedding
    ? await fetchRpcMatches(admin, args.workspaceId, queryForEmbedding || args.question, queryEmbedding.embedding)
    : []
  const directRows = await fetchWorkspaceChunks(admin, args.workspaceId)
  const mergedRows = mergeChunkRows([...rpcRows, ...directRows])
  const variants = expandQuery(args.question)
  const results = await Promise.all(
    variants.map(async (question) => retrieveSingleQueryFromRows({
      question,
      contextualQuery: args.contextualQuery,
      rows: mergedRows,
      limit: Math.max(args.limit ?? MAX_EVIDENCE, 12),
    })),
  )
  return mergeExpandedRetrievalResults({
    originalQuestion: args.question,
    contextualQuery: args.contextualQuery,
    rows: mergedRows,
    results,
    limit: args.limit,
  })
}

export function hybridRetrieveFromRows(args: {
  readonly question: string
  readonly contextualQuery?: string | null
  readonly rows: readonly KnowledgeChunkRow[]
  readonly limit?: number
}): HybridRetrievalResult {
  const variants = expandQuery(args.question)
  const results = variants.map((question) => retrieveSingleQueryFromRows({
    question,
    contextualQuery: args.contextualQuery,
    rows: args.rows,
    limit: Math.max(args.limit ?? MAX_EVIDENCE, 12),
  }))
  return mergeExpandedRetrievalResults({
    originalQuestion: args.question,
    contextualQuery: args.contextualQuery,
    rows: args.rows,
    results,
    limit: args.limit,
  })
}

function retrieveSingleQueryFromRows(args: {
  readonly question: string
  readonly contextualQuery?: string | null
  readonly rows: readonly KnowledgeChunkRow[]
  readonly limit?: number
}): HybridRetrievalResult {
  const analysis = analyzeRetrievalQuestion(args.question, args.contextualQuery)
  const activeRows = args.rows.filter((row) => row.chunk_text && row.source?.status !== 'archived')
  const baseScored = activeRows.map((row, index) => scoreCandidate(row, index, analysis))
  const scored = applyNeighborExpansion(baseScored)
  const exactRanked = rankBy(scored, (item) => item.exactScore)
  const keywordRanked = rankBy(scored, (item) => item.keywordScore)
  const vectorRanked = rankBy(scored, (item) => item.vectorScore)
  const answerRanked = rankBy(scored, (item) => item.answerScore + item.proximityScore + item.headingScore + item.neighborScore)
  const conflictGroups = detectCandidateConflicts(scored)

  const ranked = scored
    .map((candidate) => {
      const rrfScore =
        reciprocalRank(exactRanked, candidate.id) +
        reciprocalRank(keywordRanked, candidate.id) +
        reciprocalRank(vectorRanked, candidate.id) +
        reciprocalRank(answerRanked, candidate.id)
      const conflictPenalty = conflictGroups.has(candidate.id) ? 1000 : 0
      const robustScore = candidate.exactScore +
        candidate.keywordScore +
        candidate.entityScore +
        candidate.phraseScore +
        candidate.headingScore +
        candidate.answerScore +
        candidate.proximityScore +
        candidate.neighborScore +
        candidate.vectorScore -
        candidate.noisePenalty
      const missingEntityPenalty = shouldRequireEntityMatch(analysis)
        ? Math.max(0, analysis.entityTerms.length - countMatchedEntityTerms(candidate.searchText, analysis.entityTerms)) * 12
        : 0
      return {
        ...candidate,
        rrfScore,
        conflictPenalty,
        finalScore: Math.max(0, robustScore + rrfScore - conflictPenalty - missingEntityPenalty),
      }
    })
    .filter((candidate) =>
      candidate.conflictPenalty === 0 &&
      candidateHasRequiredEntity(candidate, analysis) &&
      (candidate.finalScore >= MIN_ROBUST_SCORE || (!shouldRequireEntityMatch(analysis) && candidate.rrfScore >= MIN_EVIDENCE_SCORE)),
    )
    .sort((left, right) => right.finalScore - left.finalScore)

  const fused = mergeComparisonEvidence(ranked, scored, analysis).slice(0, args.limit ?? MAX_EVIDENCE)

  const calculation = analysis.calculationIntent.hasIntent ? calculateFromEvidence(analysis, fused) : null
  const fallbackReason =
    fused.length === 0
      ? 'no_relevant_knowledge'
      : analysis.calculationIntent.hasIntent && !calculation
        ? 'cannot_compute'
      : calculation && calculation.status !== 'computed'
        ? calculation.status
        : null

  const calculationBlock =
    calculation?.status === 'computed'
      ? `Computed fact: ${formatCalculationValue(calculation)}\nFormula: ${calculation.formula}\nSource chunk IDs: ${calculation.sourceChunkIds.join(', ')}`
      : null
  const factGuidanceBlock = buildFactGuidanceBlock(analysis, fused)

  return {
    analysis,
    evidence: fused,
    chunks: [...fused.map(formatEvidenceBlock), ...(factGuidanceBlock ? [factGuidanceBlock] : []), ...(calculationBlock ? [calculationBlock] : [])],
    calculation,
    fallbackReason,
    debug: {
      formula: 'rrf',
      activeChunkCount: activeRows.length,
      exactCandidatesCount: exactRanked.length,
      keywordCandidatesCount: keywordRanked.length,
      vectorCandidatesCount: vectorRanked.length,
      answerBearingCandidatesCount: scored.filter((candidate) => candidate.answerScore > 0).length,
      selectedChunkIds: fused.map((item) => item.id),
      selectedEvidence: fused.map((item) => ({
        id: item.id,
        sourceTitle: item.sourceTitle,
        sourceUrl: item.sourceUrl,
        exactScore: item.exactScore,
        keywordScore: item.keywordScore,
        vectorScore: item.vectorScore,
        finalScore: item.finalScore,
        matchTypes: buildMatchTypes(item.reasons),
        reasons: item.reasons,
        rerankScore: item.rerankScore,
        rerankReasons: item.rerankReasons,
      })),
      calculationInvoked: analysis.calculationIntent.hasIntent,
    },
  }
}

function mergeExpandedRetrievalResults(args: {
  readonly originalQuestion: string
  readonly contextualQuery?: string | null
  readonly rows: readonly KnowledgeChunkRow[]
  readonly results: readonly HybridRetrievalResult[]
  readonly limit?: number
}): HybridRetrievalResult {
  const analysis = analyzeRetrievalQuestion(args.originalQuestion, args.contextualQuery)
  const byId = new Map<string, RetrievalCandidate>()
  for (const result of args.results) {
    for (const candidate of result.evidence) {
      const current = byId.get(candidate.id)
      if (!current || candidate.finalScore > current.finalScore) byId.set(candidate.id, candidate)
    }
  }
  const reranked = rerankCandidates(args.originalQuestion, [...byId.values()], args.limit ?? MAX_EVIDENCE)
  const calculation = analysis.calculationIntent.hasIntent ? calculateFromEvidence(analysis, reranked) : null
  const fallbackReason =
    reranked.length === 0
      ? 'no_relevant_knowledge'
      : analysis.calculationIntent.hasIntent && !calculation
        ? 'cannot_compute'
        : calculation && calculation.status !== 'computed'
          ? calculation.status
          : null
  const calculationBlock =
    calculation?.status === 'computed'
      ? `Computed fact: ${formatCalculationValue(calculation)}\nFormula: ${calculation.formula}\nSource chunk IDs: ${calculation.sourceChunkIds.join(', ')}`
      : null
  const factGuidanceBlock = buildFactGuidanceBlock(analysis, reranked)
  const primary = args.results[0]

  return {
    analysis: {
      ...analysis,
      queryVariants: [...new Set([...analysis.queryVariants, ...expandQuery(args.originalQuestion)])],
    },
    evidence: reranked,
    chunks: [
      ...reranked.map(formatEvidenceBlock),
      ...(factGuidanceBlock ? [factGuidanceBlock] : []),
      ...(calculationBlock ? [calculationBlock] : []),
    ],
    calculation,
    fallbackReason,
    debug: {
      formula: 'rrf',
      activeChunkCount: primary?.debug.activeChunkCount ?? args.rows.length,
      exactCandidatesCount: Math.max(0, ...args.results.map((result) => result.debug.exactCandidatesCount)),
      keywordCandidatesCount: Math.max(0, ...args.results.map((result) => result.debug.keywordCandidatesCount)),
      vectorCandidatesCount: Math.max(0, ...args.results.map((result) => result.debug.vectorCandidatesCount)),
      answerBearingCandidatesCount: Math.max(0, ...args.results.map((result) => result.debug.answerBearingCandidatesCount)),
      selectedChunkIds: reranked.map((candidate) => candidate.id),
      selectedEvidence: reranked.map((candidate) => ({
        id: candidate.id,
        sourceTitle: candidate.sourceTitle,
        sourceUrl: candidate.sourceUrl,
        exactScore: candidate.exactScore,
        keywordScore: candidate.keywordScore,
        vectorScore: candidate.vectorScore,
        finalScore: candidate.finalScore,
        matchTypes: buildMatchTypes(candidate.reasons),
        reasons: candidate.reasons,
        rerankScore: candidate.rerankScore,
        rerankReasons: candidate.rerankReasons,
      })),
      calculationInvoked: analysis.calculationIntent.hasIntent,
    },
  }
}

export function rerankCandidates(
  question: string,
  candidates: readonly RetrievalCandidate[],
  topK: number,
): RetrievalCandidate[] {
  const analysis = analyzeRetrievalQuestion(question)
  const normalizedQuestion = normalizeComparableText(question)
  const meaningfulTerms = tokenize(question)
  const scored = candidates.map((candidate) => {
    const text = candidate.searchText
    const normalizedText = normalizeComparableText(text)
    const reasons: string[] = []
    let rerankScore = candidate.finalScore
    const exactPhraseMatch = normalizedQuestion.length >= 4 && normalizedText.includes(normalizedQuestion)
    const closeVariantMatch = analysis.queryVariants.some((variant) => {
      const normalizedVariant = normalizeComparableText(variant)
      return normalizedVariant.length >= 4 && normalizedText.includes(normalizedVariant)
    })
    if (exactPhraseMatch) {
      rerankScore += 80
      reasons.push('rerank_exact_phrase')
    } else if (closeVariantMatch) {
      rerankScore += 40
      reasons.push('rerank_close_variant')
    }

    const factDensity = countAnswerBearingFacts(text, analysis)
    if (factDensity > 0) {
      rerankScore += Math.min(36, factDensity * 9)
      reasons.push(`rerank_fact_density:${factDensity}`)
    }
    const coveredTerms = meaningfulTerms.filter((term) => normalizedText.includes(term)).length
    const coverage = meaningfulTerms.length > 0 ? coveredTerms / meaningfulTerms.length : 0
    if (coverage > 0) {
      rerankScore += coverage * 24
      reasons.push(`rerank_term_coverage:${coverage.toFixed(2)}`)
    }

    const wordCount = text.trim().split(/\s+/).filter(Boolean).length
    if (/^[A-Z0-9"“]/.test(candidate.chunkText.trim()) && /[.!?)]$/.test(candidate.chunkText.trim())) {
      rerankScore += 6
      reasons.push('rerank_complete_sentence')
    }
    if (/^[a-z]/.test(candidate.chunkText.trim())) {
      rerankScore -= 10
      reasons.push('rerank_mid_sentence_penalty')
    }
    if (wordCount < 50) {
      rerankScore -= 6
      reasons.push('rerank_short_chunk_penalty')
    }
    if (looksLikeNavigationText(candidate.chunkText)) {
      rerankScore -= 45
      reasons.push('rerank_navigation_penalty')
    }
    if (isHighValueSource(candidate)) {
      rerankScore += 5
      reasons.push('rerank_high_value_source')
    }
    if (candidate.conflictPenalty > 0) {
      rerankScore -= candidate.conflictPenalty
      reasons.push('rerank_conflict_penalty')
    }
    return {
      ...candidate,
      rerankScore,
      rerankReasons: reasons,
      reasons: [...new Set([...candidate.reasons, ...reasons])],
    }
  })

  const exactMatches = scored.filter((candidate) => candidate.rerankReasons.includes('rerank_exact_phrase'))
  const ordered = scored.sort((left, right) => right.rerankScore - left.rerankScore)
  const selected = new Map<string, RetrievalCandidate>()
  for (const candidate of exactMatches) selected.set(candidate.id, candidate)
  for (const candidate of ordered) {
    if (selected.size >= Math.max(topK, exactMatches.length)) break
    selected.set(candidate.id, candidate)
  }
  return [...selected.values()].sort((left, right) => right.rerankScore - left.rerankScore)
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
  const metadataText = [
    row.source?.title,
    row.source_url ?? readMetadataString(row.metadata, 'source_url'),
    row.heading_path ?? readMetadataString(row.metadata, 'heading_path'),
  ].filter(Boolean).join('\n')
  const text = [metadataText, row.search_text || row.chunk_text].filter(Boolean).join('\n')
  const haystack = text.toLowerCase()
  const headingHaystack = metadataText.toLowerCase()
  const exactScore = analysis.exactSignals.reduce((score, signal) => {
    const normalized = signal.toLowerCase()
    return score + (haystack.includes(normalized) ? 10 : 0)
  }, 0)
  const keywordScore = analysis.terms.reduce((score, term) => score + countOccurrences(haystack, term), 0)
  const entityScore = scoreEntityTerms(haystack, analysis.entityTerms)
  const phraseScore = scorePhrases(haystack, [...analysis.entityPhrases, ...analysis.queryVariants])
  const headingScore = scoreHeadingAndSource(headingHaystack, analysis)
  const answerScore = scoreAnswerBearingEvidence(text, analysis)
  const proximityScore = scoreEntityAnswerProximity(text, analysis, answerScore)
  const noisePenalty = scoreNoisePenalty(text, analysis)
  const vectorScore = semanticSimilarityHeuristic(analysis.question, text)
  const reasons = buildCandidateReasons({
    exactScore,
    keywordScore,
    entityScore,
    phraseScore,
    headingScore,
    answerScore,
    proximityScore,
    neighborScore: 0,
    vectorScore,
    noisePenalty,
  })
  return {
    id: row.id ?? `${row.source_id ?? 'chunk'}:${index}`,
    sourceId: row.source_id ?? null,
    sourceTitle: row.source?.title ?? null,
    sourceType: row.source?.source_type ?? null,
    chunkText: row.chunk_text,
    searchText: text,
    sourceUrl: row.source_url ?? readMetadataString(row.metadata, 'source_url'),
    headingPath: row.heading_path ?? readMetadataString(row.metadata, 'heading_path'),
    chunkIndex: row.chunk_index ?? null,
    structuredFacts: row.structured_facts ?? (isRecord(row.metadata?.structured_facts) ? row.metadata.structured_facts : null),
    exactScore,
    keywordScore,
    entityScore,
    phraseScore,
    headingScore,
    answerScore,
    proximityScore,
    neighborScore: 0,
    noisePenalty,
    vectorScore,
    rrfScore: 0,
    finalScore: 0,
    conflictPenalty: 0,
    reasons,
    rerankScore: 0,
    rerankReasons: [],
  }
}

function replaceSignalPreservingCase(value: string, signal: string, replacement: string): string {
  const pattern = signal.includes(' ')
    ? new RegExp(escapeRegex(signal), 'i')
    : new RegExp(`\\b${escapeRegex(signal)}\\b`, 'i')
  return value
    .replace(pattern, replacement)
    .replace(/\bnumber\s+number\b/gi, 'number')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+@.$%/\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countAnswerBearingFacts(text: string, analysis: RetrievalQuestionAnalysis): number {
  const patterns: RegExp[] = []
  if (analysis.intents.pricing) patterns.push(/(?:[$€£₹]|usd|pkr|eur|gbp|aed|sar|rs\.?)\s*\d+(?:[.,]\d+)?|\bprice\s*:/gi)
  if (analysis.intents.contact) patterns.push(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\+?\d[\d\s().-]{7,}\d|mailto:|tel:|wa\.me/gi)
  if (analysis.intents.hours) patterns.push(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}:\d{2}|am|pm|open|closed)\b/gi)
  if (analysis.intents.policy) patterns.push(/\b(?:refund|return|exchange|cancel|warranty|policy)\b/gi)
  if (analysis.intents.date) patterns.push(/\b(?:20\d{2}-\d{2}-\d{2}|founded|launched|published|updated)\b/gi)
  if (analysis.intents.productOrService) patterns.push(/\b(?:includes?|features?|specs?|duration|size|quantity)\b/gi)
  return patterns.reduce((count, pattern) => count + Math.min(4, (text.match(pattern) ?? []).length), 0)
}

function looksLikeNavigationText(text: string): boolean {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 4) return false
  const shortLines = lines.filter((line) => line.split(/\s+/).length <= 4).length
  const links = (text.match(/https?:\/\/|^\s*[-*]\s+\[[^\]]+\]/gm) ?? []).length
  const facts = (text.match(/[$€£₹]\s*\d|@|\+?\d[\d\s().-]{7,}\d|\b(?:monday|refund|price|address)\b/gi) ?? []).length
  const menuLabels = lines.filter((line) =>
    /^(?:home|products?|services?|pricing|contact|about|faq|login|sign in|menu|policies?|refund policy)$/i.test(line),
  ).length
  return shortLines / lines.length >= 0.75 && (links >= 2 || menuLabels >= Math.ceil(lines.length / 2) || facts === 0)
}

function isHighValueSource(candidate: RetrievalCandidate): boolean {
  return /\b(pricing|price|contact|about|faq|services?|products?|menu|policy|policies)\b/i.test(
    [candidate.sourceUrl, candidate.headingPath].filter(Boolean).join(' '),
  )
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
    ['phone', 'whatsapp', 'wa.me', 'tel', 'call', 'contact'],
    ['company', 'legal', 'registration', 'company number', 'incorporated'],
    ['owner', 'founder', 'behind', 'operated by', 'owned by'],
    ['date', 'created', 'built', 'founded', 'launch', 'published', 'updated'],
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

function detectRetrievalIntents(question: string): RetrievalIntents {
  const normalized = question.toLowerCase()
  return {
    pricing: /\b(price|pricing|cost|fee|rate|charge|charges|how much|monthly|yearly|plan|package)\b/.test(normalized),
    policy: /\b(refund|return|exchange|cancel|cancellation|money back|terms?|policy|warranty)\b/.test(normalized),
    hours: /\b(hours?|open|close|closed|closing|timing|schedule|when are you open)\b/.test(normalized),
    contact: /\b(contact|support|email|phone|call|whatsapp|help desk|ticket)\b/.test(normalized),
    location: /\b(location|address|where|office|branch|map|city|country)\b/.test(normalized),
    faq: /\b(faq|question|help|how do i|can i|do you|does it|is there)\b/.test(normalized),
    productOrService: /\b(product|service|plan|package|menu|item|course|treatment|appointment|booking|available|sell|offer|include|includes|feature|spec)\b/.test(normalized),
    company: /\b(company|business|legal|entity|registration|registered|company number|incorporated|limited|ltd|llc|inc)\b/.test(normalized),
    ownership: /\b(owner|owned|founder|founded by|behind|run by|operated by|director|ceo)\b/.test(normalized),
    date: /\b(date|built|created|founded|launched|launch|started|established|published|updated|modified|page date|sitemap)\b/.test(normalized),
    comparison: /\b(compare|comparison|difference|different|vs|versus|better|which one|between)\b/.test(normalized),
  }
}

function mergeRetrievalIntents(
  current: RetrievalIntents,
  context: RetrievalIntents | null,
  comparison: boolean,
): RetrievalIntents {
  return {
    pricing: current.pricing || Boolean(context?.pricing),
    policy: current.policy || Boolean(context?.policy),
    hours: current.hours || Boolean(context?.hours),
    contact: current.contact || Boolean(context?.contact),
    location: current.location || Boolean(context?.location),
    faq: current.faq || Boolean(context?.faq),
    productOrService: current.productOrService || Boolean(context?.productOrService),
    company: current.company || Boolean(context?.company),
    ownership: current.ownership || Boolean(context?.ownership),
    date: current.date || Boolean(context?.date),
    comparison: current.comparison || Boolean(context?.comparison) || comparison,
  }
}

function detectComparisonIntent(question: string): { readonly enabled: boolean; readonly entities: readonly string[] } {
  const normalized = question.toLowerCase()
  const enabled = /\b(compare|comparison|difference|different|vs|versus|better|which one|between)\b/.test(normalized)
  if (!enabled) return { enabled: false, entities: [] }

  const entities = new Set<string>()
  const between = normalized.match(/\bbetween\s+([a-z0-9][a-z0-9\s-]{1,60}?)\s+and\s+([a-z0-9][a-z0-9\s-]{1,60})(?:\?|$|\.|,)/)
  if (between) {
    entities.add(cleanComparisonEntity(between[1] ?? ''))
    entities.add(cleanComparisonEntity(between[2] ?? ''))
  }
  for (const match of normalized.matchAll(/\b([a-z0-9][a-z0-9\s-]{1,40}?)\s+(?:vs|versus)\s+([a-z0-9][a-z0-9\s-]{1,40})(?:\?|$|\.|,)/g)) {
    entities.add(cleanComparisonEntity(match[1] ?? ''))
    entities.add(cleanComparisonEntity(match[2] ?? ''))
  }
  return { enabled, entities: [...entities].filter((entity) => entity.length >= 2).slice(0, 4) }
}

function cleanComparisonEntity(value: string): string {
  return value
    .replace(/\b(the|a|an|plan|package|service|product|option|one|is|are|what|which|better|difference|compare)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractEntityTerms(question: string, terms: readonly string[], intents: RetrievalIntents, contextualQuery = ''): string[] {
  const generic = new Set([
    'price', 'pricing', 'cost', 'fee', 'rate', 'charge', 'charges', 'monthly', 'yearly',
    'plan', 'plans', 'package', 'packages', 'product', 'products', 'service', 'services',
    'menu', 'item', 'items', 'course', 'courses', 'treatment', 'appointment', 'booking',
    'available', 'sell', 'sells', 'offer', 'offers', 'include', 'includes', 'feature',
    'features', 'spec', 'specs', 'refund', 'return', 'exchange', 'cancel', 'cancellation',
    'money', 'back', 'policy', 'terms', 'hours', 'open', 'close', 'closed', 'closing',
    'timing', 'schedule', 'contact', 'support', 'email', 'phone', 'call', 'help', 'desk',
    'ticket', 'location', 'located', 'address', 'where', 'office', 'branch', 'city', 'country',
    'faq', 'question', 'questions', 'much', 'number', 'numbers', 'whatsapp', 'phone',
    'company', 'business', 'legal', 'entity', 'registration', 'registered', 'ltd',
    'limited', 'llc', 'inc', 'owner', 'owned', 'founder', 'behind', 'director', 'ceo',
    'date', 'built', 'created', 'founded', 'launched', 'launch', 'started',
    'established', 'published', 'updated', 'modified', 'page', 'sitemap', 'time',
  ])
  const entities = new Set<string>()
  for (const term of terms) {
    if (!generic.has(term)) entities.add(term)
  }
  for (const term of tokenize(contextualQuery)) {
    if (!generic.has(term)) entities.add(term)
  }
  for (const match of question.matchAll(/\b\d+(?:[.,]\d+)?\s?(?:gb|tb|mb|kb|cores?|cpu|ram|kg|g|mg|ml|l|hours?|hrs?|days?|weeks?|months?|years?|people|persons?|servings?|sq\.?\s?ft|sqm)\b/gi)) {
    entities.add(match[0].toLowerCase().replace(/\s+/g, ''))
  }
  const hasSpecificIntent = intents.pricing || intents.policy || intents.hours || intents.contact || intents.location || intents.faq || intents.productOrService || intents.company || intents.ownership || intents.date
  if (!hasSpecificIntent && entities.size === 0) {
    for (const term of terms.slice(0, 3)) entities.add(term)
  }
  return [...entities]
}

function extractEntityPhrases(entityTerms: readonly string[]): string[] {
  const phrases = new Set<string>()
  for (let index = 0; index < entityTerms.length - 1; index += 1) {
    phrases.add(`${entityTerms[index]} ${entityTerms[index + 1]}`)
  }
  return [...phrases]
}

function buildQueryVariants(
  question: string,
  terms: readonly string[],
  entityTerms: readonly string[],
  entityPhrases: readonly string[],
  intents: RetrievalIntents,
): string[] {
  const variants = new Set<string>(entityPhrases)
  const synonymGroups = [
    intents.pricing ? ['price', 'cost', 'fee', 'rate', 'pricing'] : [],
    intents.policy ? ['refund', 'return', 'money back', 'cancellation', 'policy'] : [],
    intents.hours ? ['hours', 'open', 'close', 'timing', 'business hours'] : [],
    intents.location ? ['location', 'address', 'office', 'branch'] : [],
    intents.contact ? ['support', 'contact', 'email', 'phone', 'whatsapp', 'wa.me', 'tel', 'call', 'help'] : [],
    intents.company ? ['company', 'legal entity', 'company number', 'registration', 'registered'] : [],
    intents.ownership ? ['owner', 'founder', 'owned by', 'operated by', 'behind'] : [],
    intents.date ? ['date', 'built', 'created', 'founded', 'launched', 'published', 'updated', 'sitemap'] : [],
  ].filter((group) => group.length > 0)

  for (const entity of entityTerms) {
    variants.add(entity)
    if (intents.pricing) {
      variants.add(`${entity} price`)
      variants.add(`${entity} pricing`)
      variants.add(`${entity} plan`)
    }
    for (const group of synonymGroups) {
      for (const synonym of group) variants.add(`${entity} ${synonym}`)
    }
  }
  for (const phrase of entityPhrases) {
    if (intents.pricing) variants.add(`${phrase} price`)
    for (const group of synonymGroups) {
      for (const synonym of group) variants.add(`${phrase} ${synonym}`)
    }
  }
  for (const term of terms) {
    for (const group of synonymGroups) {
      if (group.includes(term)) group.forEach((synonym) => variants.add(synonym))
    }
  }
  variants.add(question.toLowerCase())
  return [...variants].filter((variant) => variant.length >= 3).slice(0, 40)
}

function scoreEntityTerms(haystack: string, entityTerms: readonly string[]): number {
  if (entityTerms.length === 0) return 0
  let score = 0
  const compactHaystack = haystack.replace(/\s+/g, '')
  for (const entity of entityTerms) {
    const compactEntity = entity.replace(/\s+/g, '')
    if (haystack.includes(entity)) score += 8
    else if (compactEntity.length >= 2 && compactHaystack.includes(compactEntity)) score += 8
  }
  if (entityTerms.length > 1 && score >= entityTerms.length * 8) score += 10
  return score
}

function scorePhrases(haystack: string, phrases: readonly string[]): number {
  let score = 0
  for (const phrase of phrases) {
    if (phrase.length >= 4 && haystack.includes(phrase.toLowerCase())) score += phrase.split(/\s+/).length >= 2 ? 12 : 4
  }
  return Math.min(score, 40)
}

function scoreHeadingAndSource(headingHaystack: string, analysis: RetrievalQuestionAnalysis): number {
  if (!headingHaystack) return 0
  let score = 0
  for (const entity of analysis.entityTerms) {
    if (headingHaystack.includes(entity)) score += 10
  }
  for (const phrase of analysis.entityPhrases) {
    if (headingHaystack.includes(phrase)) score += 12
  }
  for (const term of analysis.terms) {
    if (headingHaystack.includes(term)) score += 2
  }
  return Math.min(score, 35)
}

function scoreAnswerBearingEvidence(text: string, analysis: RetrievalQuestionAnalysis): number {
  const normalized = text.toLowerCase()
  let score = 0
  if (analysis.intents.pricing && containsPriceFact(text)) score += 20
  if (analysis.intents.hours && /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm|\d{1,2}:\d{2}|open|close|closed|hours?)\b/i.test(text)) score += 18
  if (analysis.intents.contact && /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{7,}\d|mailto:|tel:|wa\.me|whatsapp|support|contact)/i.test(text)) score += 22
  if (analysis.intents.location && /\b(address|location|office|branch|street|road|city|country|map)\b/i.test(text)) score += 16
  if (analysis.intents.policy && /\b(refund|return|exchange|cancel|cancellation|money back|terms|policy|warranty)\b/i.test(text)) score += 18
  if (analysis.intents.productOrService && /\b(product|service|plan|package|menu|course|treatment|feature|spec|storage|ram|cpu|duration|includes?)\b/i.test(text)) score += 10
  if (analysis.intents.faq && /\b(faq|question|answer|yes|no|can|do you|does)\b/i.test(normalized)) score += 6
  if (analysis.intents.company && /\b(company|legal entity|company number|registration|registered|incorporated|ltd|limited|llc|inc)\b/i.test(text)) score += 20
  if (analysis.intents.ownership && /\b(owner|owned by|founder|founded by|operated by|run by|behind|director|ceo|company behind)\b/i.test(text)) score += 18
  if (analysis.intents.date && /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|published|updated|modified|lastmod|page date|sitemap|founded|launched|established|created)\b/i.test(text)) score += 18
  return score
}

function scoreEntityAnswerProximity(text: string, analysis: RetrievalQuestionAnalysis, answerScore: number): number {
  if (answerScore <= 0 || analysis.entityTerms.length === 0) return 0
  const normalized = text.toLowerCase()
  const answerIndexes = findAnswerFactIndexes(normalized, analysis)
  if (answerIndexes.length === 0) return 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (const entity of analysis.entityTerms) {
    const entityIndex = normalized.indexOf(entity)
    if (entityIndex === -1) continue
    for (const answerIndex of answerIndexes) {
      bestDistance = Math.min(bestDistance, Math.abs(entityIndex - answerIndex))
    }
  }
  if (!Number.isFinite(bestDistance)) return 0
  if (bestDistance <= 180) return 20
  if (bestDistance <= 500) return 12
  if (bestDistance <= 1000) return 6
  return 0
}

function findAnswerFactIndexes(text: string, analysis: RetrievalQuestionAnalysis): number[] {
  const patterns: RegExp[] = []
  if (analysis.intents.pricing) patterns.push(/(?:\$|rs\.?|pkr|usd|eur|gbp)?\s*\d+(?:[.,]\d+)?\s*(?:\/?\s*(?:mo|month|monthly|year|yearly|annual))?/gi)
  if (analysis.intents.hours) patterns.push(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}:\d{2}|am|pm|open|close|closed)\b/gi)
  if (analysis.intents.contact) patterns.push(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\+?\d[\d\s().-]{7,}\d|mailto:|tel:|wa\.me|whatsapp/gi)
  if (analysis.intents.policy) patterns.push(/\b(refund|return|exchange|cancel|cancellation|money back|terms|policy)\b/gi)
  if (analysis.intents.location) patterns.push(/\b(address|location|office|branch|street|road|city|country)\b/gi)
  if (analysis.intents.company) patterns.push(/\b(company|legal entity|company number|registration|registered|incorporated|ltd|limited)\b|\b\d{6,}\b/gi)
  if (analysis.intents.ownership) patterns.push(/\b(owner|owned by|founder|founded by|operated by|behind|company behind)\b/gi)
  if (analysis.intents.date) patterns.push(/\b\d{4}-\d{2}-\d{2}\b|\b(?:published|updated|modified|lastmod|page date|sitemap|founded|launched|created)\b/gi)
  return patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match.index ?? 0))
}

function scoreNoisePenalty(text: string, analysis: RetrievalQuestionAnalysis): number {
  let penalty = 0
  const urlCount = (text.match(/https?:\/\//gi) ?? []).length
  if (urlCount >= 10) penalty += Math.min(12, urlCount)
  const imageCount = (text.match(/!\[/g) ?? []).length
  if (imageCount >= 3) penalty += Math.min(10, imageCount)
  if (analysis.entityTerms.length > 0 && scoreEntityTerms(text.toLowerCase(), analysis.entityTerms) === 0) penalty += 8
  return penalty
}

function applyNeighborExpansion(candidates: readonly RetrievalCandidate[]): RetrievalCandidate[] {
  const seeds = candidates.filter((candidate) =>
    candidate.entityScore + candidate.phraseScore + candidate.headingScore >= 8 ||
    (candidate.answerScore > 0 && candidate.keywordScore > 0),
  )
  return candidates.map((candidate) => {
    let neighborScore = 0
    const neighborReasons = new Set(candidate.reasons)
    for (const seed of seeds) {
      if (!candidate.sourceId || candidate.sourceId !== seed.sourceId || candidate.id === seed.id) continue
      if (candidate.chunkIndex === null || seed.chunkIndex === null) continue
      const distance = Math.abs(candidate.chunkIndex - seed.chunkIndex)
      if (distance > 1) continue
      if (seed.entityScore + seed.phraseScore + seed.headingScore > 0 && candidate.answerScore > 0) {
        neighborScore = Math.max(neighborScore, 14)
        neighborReasons.add('neighbor_answer_fact')
      }
      if (seed.answerScore > 0 && candidate.entityScore + candidate.phraseScore + candidate.headingScore > 0) {
        neighborScore = Math.max(neighborScore, 10)
        neighborReasons.add('neighbor_entity_context')
      }
    }
    if (neighborScore === candidate.neighborScore) return candidate
    return {
      ...candidate,
      neighborScore,
      reasons: [...neighborReasons],
    }
  })
}

function shouldRequireEntityMatch(analysis: RetrievalQuestionAnalysis): boolean {
  return analysis.entityTerms.length > 0 && (analysis.intents.pricing || analysis.intents.productOrService || analysis.intents.contact || analysis.intents.location)
}

function mergeComparisonEvidence(
  ranked: readonly RetrievalCandidate[],
  allCandidates: readonly RetrievalCandidate[],
  analysis: RetrievalQuestionAnalysis,
): RetrievalCandidate[] {
  if (!analysis.comparison.enabled || analysis.comparison.entities.length < 2) return [...ranked]
  const byId = new Map<string, RetrievalCandidate>()
  for (const candidate of ranked) byId.set(candidate.id, candidate)
  for (const entity of analysis.comparison.entities) {
    const entityMatches = allCandidates
      .filter((candidate) => candidate.conflictPenalty === 0 && candidate.searchText.toLowerCase().includes(entity.toLowerCase()))
      .sort((left, right) =>
        (right.answerScore + right.entityScore + right.phraseScore + right.keywordScore + right.vectorScore) -
        (left.answerScore + left.entityScore + left.phraseScore + left.keywordScore + left.vectorScore),
      )
      .slice(0, 2)
    for (const candidate of entityMatches) {
      const existing = byId.get(candidate.id)
      byId.set(candidate.id, existing ?? {
        ...candidate,
        finalScore: Math.max(candidate.finalScore, candidate.answerScore + candidate.entityScore + candidate.keywordScore + 12),
        reasons: [...new Set([...candidate.reasons, 'comparison_entity_match'])],
      })
    }
  }
  return [...byId.values()].sort((left, right) => right.finalScore - left.finalScore)
}

function candidateHasRequiredEntity(candidate: RetrievalCandidate, analysis: RetrievalQuestionAnalysis): boolean {
  if (!shouldRequireEntityMatch(analysis)) return true
  if (candidate.neighborScore > 0) return true
  if (candidate.headingScore > 0 || candidate.phraseScore > 0) return true
  return countMatchedEntityTerms(candidate.searchText, analysis.entityTerms) >= Math.max(1, Math.ceil(analysis.entityTerms.length * 0.6))
}

function countMatchedEntityTerms(text: string, entityTerms: readonly string[]): number {
  const haystack = text.toLowerCase()
  const compactHaystack = haystack.replace(/\s+/g, '')
  return entityTerms.filter((entity) => {
    const normalized = entity.toLowerCase()
    return haystack.includes(normalized) || compactHaystack.includes(normalized.replace(/\s+/g, ''))
  }).length
}

function buildCandidateReasons(scores: {
  readonly exactScore: number
  readonly keywordScore: number
  readonly entityScore: number
  readonly phraseScore: number
  readonly headingScore: number
  readonly answerScore: number
  readonly proximityScore: number
  readonly neighborScore: number
  readonly vectorScore: number
  readonly noisePenalty: number
}): string[] {
  const reasons: string[] = []
  if (scores.exactScore > 0) reasons.push('exact_signal')
  if (scores.keywordScore > 0) reasons.push('keyword_match')
  if (scores.entityScore > 0) reasons.push('entity_match')
  if (scores.phraseScore > 0) reasons.push('phrase_or_variant_match')
  if (scores.headingScore > 0) reasons.push('heading_or_source_match')
  if (scores.answerScore > 0) reasons.push('answer_bearing_fact')
  if (scores.proximityScore > 0) reasons.push('entity_fact_proximity')
  if (scores.neighborScore > 0) reasons.push('neighbor_expansion')
  if (scores.vectorScore > 0) reasons.push('semantic_match')
  if (scores.noisePenalty > 0) reasons.push('noise_penalty')
  return reasons
}

function containsPriceFact(text: string): boolean {
  return /(?:\$|rs\.?|pkr|usd|eur|gbp)\s*\d+(?:[.,]\d+)?|\bprice\s*:\s*\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s*\/\s*(?:mo|month|monthly|year|yearly|annual)\b|\b\d+(?:[.,]\d+)?\s*(?:mo|month|monthly|year|yearly|annual)\b/i.test(text)
}

function calculateFromEvidence(
  analysis: RetrievalQuestionAnalysis,
  candidates: readonly RetrievalCandidate[],
): CalculationResult | null {
  const facts = candidates.flatMap((candidate) => extractNumericFactsFromCandidate(candidate))
  const priceFacts = facts.filter((fact): fact is ExtractedPriceFact => fact.kind === 'price')
  const percentFacts = facts.filter((fact): fact is ExtractedPercentFact => fact.kind === 'percent')
  const taxFacts = facts.filter((fact): fact is ExtractedPercentFact => fact.kind === 'tax_rate')
  if (hasSameLabelPriceConflict(priceFacts)) {
    return conflictingFacts('Conflicting price facts were found.', '', priceFacts.map((fact) => fact.sourceChunkId))
  }

  const price = selectCalculationPriceFact(analysis, priceFacts)
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
    result = convertBillingTotal(baseAmount, fromPeriod, toPeriod, [...new Set([...(result?.sourceChunkIds ?? sourceIds)])], price.currency)
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

function selectCalculationPriceFact(
  analysis: RetrievalQuestionAnalysis,
  priceFacts: readonly ExtractedPriceFact[],
): ExtractedPriceFact | null {
  if (priceFacts.length === 0) return null
  const targetPeriod = analysis.calculationIntent.targetPeriod
  const preferredSourcePeriod = targetPeriod === 'monthly'
    ? 'yearly'
    : targetPeriod === 'yearly'
      ? 'monthly'
      : null
  const questionNumbers = new Set(analysis.numbers.map((number) => roundCalculationNumber(number)))

  return [...priceFacts]
    .map((fact, index) => {
      let score = priceFacts.length - index
      if (questionNumbers.has(roundCalculationNumber(fact.amount))) score += 100
      if (preferredSourcePeriod && fact.period === preferredSourcePeriod) score += 50
      if (targetPeriod && fact.period === targetPeriod) score += 15
      if (analysis.calculationIntent.percentage && /\b(regular|original|monthly|price)\b/.test(fact.context)) score += 20
      if (analysis.calculationIntent.periodConversion && fact.isTotal) score += 25
      if (analysis.entityTerms.some((term) => fact.context.includes(term))) score += 10
      return { fact, score }
    })
    .sort((left, right) => right.score - left.score)[0]?.fact ?? null
}

function hasSameLabelPriceConflict(priceFacts: readonly ExtractedPriceFact[]): boolean {
  const grouped = new Map<string, Set<number>>()
  for (const fact of priceFacts) {
    const label = normalizeConflictLabel(fact.label)
    if (!label) continue
    const key = `${label}:${fact.currency}:${fact.period ?? ''}`.toLowerCase()
    const values = grouped.get(key) ?? new Set<number>()
    values.add(roundCalculationNumber(fact.amount))
    grouped.set(key, values)
  }
  return [...grouped.values()].some((values) => values.size > 1)
}

function roundCalculationNumber(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

interface ExtractedPriceFact {
  readonly kind: 'price'
  readonly amount: number
  readonly currency: string
  readonly period: BillingPeriod | null
  readonly label: string | null
  readonly context: string
  readonly isTotal: boolean
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
    const period = normalizePeriod(match[4] ?? '') ?? inferPricePeriod(context)
    facts.push({
      kind: 'price',
      amount: Number(match[2]?.replace(',', '.')),
      currency: normalizeCurrency(match[1] ?? match[3] ?? '$'),
      period,
      label: extractNearbyLabel(text, match.index ?? 0),
      context,
      isTotal: /\b(total|billed|invoice|charged)\b/.test(context),
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
    .replace(/^[-\s]+|[-\s]+$/g, '')
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

function buildFactGuidanceBlock(
  analysis: RetrievalQuestionAnalysis,
  candidates: readonly RetrievalCandidate[],
): string | null {
  if (candidates.length === 0) return null
  const text = candidates.map((candidate) => candidate.chunkText).join('\n')
  const lines: string[] = []

  if (analysis.intents.contact) {
    const phones = uniqueMatches(text, /(?:tel:\s*)?\+?\d[\d\s().-]{7,}\d/gi)
      .map((value) => value.replace(/^tel:\s*/i, '').trim())
      .slice(0, 5)
    const whatsappLinks = uniqueMatches(text, /(?:https?:\/\/)?wa\.me\/\d+|whatsapp:\S+/gi).slice(0, 5)
    const emails = uniqueMatches(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi).slice(0, 5)
    if (phones.length > 0) lines.push(`Contact phone numbers found in source: ${phones.join(', ')}`)
    if (whatsappLinks.length > 0) lines.push(`WhatsApp links found in source: ${whatsappLinks.join(', ')}`)
    if (emails.length > 0) lines.push(`Email addresses found in source: ${emails.join(', ')}`)
  }

  if (analysis.intents.company || analysis.intents.ownership) {
    const legalNames = extractLegalEntityNames(text).slice(0, 5)
    const companyNumbers = uniqueMatches(text, /\b(?:company number|registration number|registered number)\s*:?\s*([A-Z0-9-]{5,})\b/gi)
      .map((value) => value.replace(/^(?:company number|registration number|registered number)\s*:?\s*/i, '').trim())
      .slice(0, 5)
    if (legalNames.length > 0) lines.push(`Legal/company names found in source: ${legalNames.join(', ')}`)
    if (companyNumbers.length > 0) lines.push(`Company/registration numbers found in source: ${companyNumbers.join(', ')}`)
    if (analysis.intents.ownership && legalNames.length > 0) {
      lines.push('If no individual owner/founder is explicitly named, say the source lists the legal/company entity but does not explicitly name an individual owner.')
    }
  }

  if (analysis.intents.date) {
    const exactDateLabels = uniqueMatches(text, /\b(?:founded|founded on|launched|launched on|established|created|built)\s*:?\s*(?:on\s*)?([A-Z][a-z]{2,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi).slice(0, 5)
    const pageDates = uniqueMatches(text, /\b(?:page date|published|updated|modified|lastmod|sitemap date|date)\s*:?\s*(\d{4}-\d{2}-\d{2})\b/gi)
      .map((value) => value.replace(/^(?:page date|published|updated|modified|lastmod|sitemap date|date)\s*:?\s*/i, '').trim())
      .slice(0, 10)
    const allIsoDates = uniqueMatches(text, /\b20\d{2}-\d{2}-\d{2}\b/g).slice(0, 10)
    const dates = pageDates.length > 0 ? pageDates : allIsoDates
    if (exactDateLabels.length > 0) lines.push(`Exact founded/launch/created dates found in source: ${exactDateLabels.join(', ')}`)
    if (dates.length > 0) {
      lines.push(`Page or sitemap dates found in source: ${dates.join(', ')}`)
      if (exactDateLabels.length === 0) {
        lines.push('If the exact built/founded/launch date is not provided, say so clearly and only mention the related page/sitemap dates shown in the source.')
      }
    }
  }

  return lines.length > 0
    ? `Derived fact guidance from selected source evidence:\n${lines.map((line) => `- ${line}`).join('\n')}`
    : null
}

function buildMatchTypes(reasons: readonly string[]): string[] {
  const types = new Set<string>()
  if (reasons.includes('exact_signal')) types.add('exact')
  if (reasons.includes('keyword_match') || reasons.includes('phrase_or_variant_match') || reasons.includes('entity_match')) types.add('keyword')
  if (reasons.includes('semantic_match')) types.add('vector')
  if (reasons.includes('neighbor_expansion')) types.add('neighbor')
  if (reasons.includes('answer_bearing_fact')) types.add('answer_fact')
  return [...types]
}

function uniqueMatches(text: string, pattern: RegExp): string[] {
  const values = new Set<string>()
  for (const match of text.matchAll(pattern)) {
    const value = (match[1] ?? match[0] ?? '').trim()
    if (value) values.add(value)
  }
  return [...values]
}

function extractLegalEntityNames(text: string): string[] {
  const values = new Set<string>()
  for (const match of text.matchAll(/\b([A-Z][A-Za-z0-9&.,' -]{2,80}\s+(?:Ltd|Limited|LLC|Inc|Corporation|Corp|Pvt\.?\s*Ltd|GmbH|S\.A\.|PLC))\b/g)) {
    const value = match[1]?.replace(/\s+/g, ' ').trim()
    if (value) values.add(value)
  }
  return [...values]
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
  if (/month|monthly|mo/.test(normalized)) return 'monthly'
  if (/year|yearly|annual/.test(normalized)) return 'yearly'
  return null
}

function inferPricePeriod(context: string): BillingPeriod | null {
  if (/\b(per year|billed per year|yearly|annual|annually|\/year)\b/.test(context)) return 'yearly'
  if (/\b(per month|monthly|\/mo|\/month|mo)\b/.test(context)) return 'monthly'
  if (/\b(per day|daily|\/day)\b/.test(context)) return 'daily'
  if (/\b(per week|weekly|\/week)\b/.test(context)) return 'weekly'
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
