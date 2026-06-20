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
  readonly offerScope: OfferQueryScope
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

export type OfferAnswerMode =
  | 'single_offer_exact'
  | 'category_pricing_list'
  | 'comparison'
  | 'policy_or_terms'
  | 'contact_location_hours'
  | 'missing_or_ambiguous'

export interface OfferQueryScope {
  readonly answerMode: OfferAnswerMode
  readonly requestedFamily: string | null
  readonly requestedEntity: string | null
  readonly requestedVariantSpecs: readonly string[]
  readonly requestedPeriod: BillingPeriod | null
  readonly weakPlanNames: readonly string[]
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
    readonly answerMode: OfferAnswerMode
    readonly requestedFamily: string | null
    readonly requestedEntity: string | null
    readonly requestedVariantSpecs: readonly string[]
    readonly requestedPeriod: BillingPeriod | null
    readonly selectedOffer: {
      readonly entity: string | null
      readonly productFamily: string | null
      readonly currentPrice: StructuredPriceValue | null
      readonly originalPrice: StructuredPriceValue | null
      readonly billingTotals: readonly StructuredBillingTotal[]
      readonly sourceOrigin: 'persisted' | 'runtime'
      readonly sourceChunkId: string
    } | null
    readonly fullContextFallback: FullContextFallbackDebug
  }
}

export interface MemoryRetrievalContext {
  readonly topicsDiscussed: readonly string[]
  readonly lastIntent: string | null
  readonly unresolvedQuestions: readonly string[]
}

export interface FullContextFallbackDebug {
  readonly attempted: boolean
  readonly outcome: 'not_needed' | 'succeeded' | 'still_fallback' | 'skipped_budget' | 'skipped_empty'
  readonly estimatedTokens: number
  readonly tokenBudget: number
  readonly sourceCount: number
  readonly sourceTitles: readonly string[]
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

interface KnowledgeSourceRow {
  readonly id: string
  readonly title: string
  readonly source_type?: string | null
  readonly status?: string | null
  readonly content: string
}

const MAX_EVIDENCE = 6
const RRF_K = 60
const MIN_EVIDENCE_SCORE = 0.015
const MIN_ROBUST_SCORE = 8
export const DEFAULT_FULL_CONTEXT_FALLBACK_TOKEN_BUDGET = 60000

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

const GENERIC_PLAN_NAMES = new Set([
  'basic',
  'starter',
  'standard',
  'pro',
  'plus',
  'premium',
  'business',
  'enterprise',
  'ultimate',
  'advanced',
  'growth',
  'lite',
  'free',
])

const PERIOD_WORDS = new Set([
  'daily',
  'day',
  'weekly',
  'week',
  'monthly',
  'month',
  'mo',
  'quarterly',
  'quarter',
  'yearly',
  'year',
  'annual',
  'annually',
])

const CATEGORY_LIST_SIGNALS = /\b(prices|pricing|plans|packages|menu|services|products|items|courses|treatments|fees|rates|list|available|options|catalog|catalogue)\b/i

const SPEC_CONTEXT_TERMS = new Set(['ram', 'memory', 'cpu', 'core', 'cores', 'storage', 'nvme', 'ssd', 'gb', 'tb', 'mb'])

const OFFER_FAMILY_STOP_TERMS = new Set([
  ...GENERIC_PLAN_NAMES,
  ...PERIOD_WORDS,
  ...SPEC_CONTEXT_TERMS,
  'plan',
  'plans',
  'package',
  'packages',
  'price',
  'pricing',
  'cost',
  'fee',
  'rate',
  'current',
  'original',
  'discount',
  'total',
  'billed',
  'knowledge',
])

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
  const calculationIntent = detectCalculationIntent(normalized)
  const offerScope = buildOfferQueryScope({
    question: normalized,
    terms,
    entityTerms: mergedEntityTerms,
    entityPhrases,
    intents,
    comparison,
    calculationIntent,
  })
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
    offerScope,
    comparison,
    calculationIntent,
  }
}

export async function hybridRetrieveKnowledge(args: {
  readonly workspaceId: string
  readonly question: string
  readonly contextualQuery?: string | null
  readonly memoryContext?: MemoryRetrievalContext | null
  readonly client?: SupabaseClient
  readonly limit?: number
  readonly fullContextTokenBudget?: number
}): Promise<HybridRetrievalResult> {
  const admin = args.client ?? supabaseAdmin()
  const queryForEmbedding = [args.contextualQuery, args.question].filter(Boolean).join('\n')
  const queryEmbedding = await generateEmbedding(queryForEmbedding || args.question, args.workspaceId).catch(() => null)
  const rpcRows = queryEmbedding
    ? await fetchRpcMatches(admin, args.workspaceId, queryForEmbedding || args.question, queryEmbedding.embedding)
    : []
  const [directRows, activeSources] = await Promise.all([
    fetchWorkspaceChunks(admin, args.workspaceId),
    fetchWorkspaceSources(admin, args.workspaceId),
  ])
  const mergedRows = mergeChunkRows([...rpcRows, ...directRows])
  const variants = expandQuery(args.question)
  const results = await Promise.all(
    variants.map(async (question) => retrieveSingleQueryFromRows({
      question,
      contextualQuery: args.contextualQuery,
      memoryContext: args.memoryContext,
      rows: mergedRows,
      limit: Math.max(args.limit ?? MAX_EVIDENCE, 12),
    })),
  )
  return mergeExpandedRetrievalResults({
    originalQuestion: args.question,
    contextualQuery: args.contextualQuery,
    memoryContext: args.memoryContext,
    rows: mergedRows,
    results,
    limit: args.limit,
    fullContextSources: activeSources,
    fullContextTokenBudget: args.fullContextTokenBudget,
    workspaceId: args.workspaceId,
  })
}

export function hybridRetrieveFromRows(args: {
  readonly question: string
  readonly contextualQuery?: string | null
  readonly memoryContext?: MemoryRetrievalContext | null
  readonly rows: readonly KnowledgeChunkRow[]
  readonly limit?: number
  readonly workspaceId?: string
  readonly fullContextTokenBudget?: number
}): HybridRetrievalResult {
  const rows = args.workspaceId
    ? args.rows.filter((row) => !row.workspace_id || row.workspace_id === args.workspaceId)
    : args.rows
  const variants = expandQuery(args.question)
  const results = variants.map((question) => retrieveSingleQueryFromRows({
    question,
    contextualQuery: args.contextualQuery,
    memoryContext: args.memoryContext,
    rows,
    limit: Math.max(args.limit ?? MAX_EVIDENCE, 12),
  }))
  return mergeExpandedRetrievalResults({
    originalQuestion: args.question,
    contextualQuery: args.contextualQuery,
    memoryContext: args.memoryContext,
    rows,
    results,
    limit: args.limit,
    fullContextSources: buildFullContextSourcesFromRows(rows),
    fullContextTokenBudget: args.fullContextTokenBudget,
    workspaceId: args.workspaceId,
  })
}

function retrieveSingleQueryFromRows(args: {
  readonly question: string
  readonly contextualQuery?: string | null
  readonly memoryContext?: MemoryRetrievalContext | null
  readonly rows: readonly KnowledgeChunkRow[]
  readonly limit?: number
}): HybridRetrievalResult {
  const analysis = analyzeRetrievalQuestion(args.question, args.contextualQuery)
  const activeRows = args.rows.filter((row) => row.chunk_text && row.source?.status !== 'archived')
  const baseScored = activeRows.map((row, index) => scoreCandidate(row, index, analysis, args.memoryContext))
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

  const fused = filterSingleEntityPricingEvidence(
    mergeComparisonEvidence(ranked, scored, analysis).slice(0, args.limit ?? MAX_EVIDENCE),
    analysis,
  )

  const calculation = analysis.calculationIntent.hasIntent ? calculateFromEvidence(analysis, fused) : null
  const ambiguousWeakOffer = hasAmbiguousWeakOfferRows(analysis, activeRows)
  const fallbackReason =
    fused.length === 0
      ? ambiguousWeakOffer ? 'ambiguous_offer' : 'no_relevant_knowledge'
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
      answerMode: analysis.offerScope.answerMode,
      requestedFamily: analysis.offerScope.requestedFamily,
      requestedEntity: analysis.offerScope.requestedEntity,
      requestedVariantSpecs: analysis.offerScope.requestedVariantSpecs,
      requestedPeriod: analysis.offerScope.requestedPeriod,
      selectedOffer: buildSelectedOfferDebug(analysis, fused),
      fullContextFallback: emptyFullContextFallbackDebug('not_needed'),
    },
  }
}

function mergeExpandedRetrievalResults(args: {
  readonly originalQuestion: string
  readonly contextualQuery?: string | null
  readonly memoryContext?: MemoryRetrievalContext | null
  readonly rows: readonly KnowledgeChunkRow[]
  readonly results: readonly HybridRetrievalResult[]
  readonly limit?: number
  readonly fullContextSources?: readonly KnowledgeSourceRow[]
  readonly fullContextTokenBudget?: number
  readonly workspaceId?: string
}): HybridRetrievalResult {
  const analysis = analyzeRetrievalQuestion(args.originalQuestion, args.contextualQuery)
  const byId = new Map<string, RetrievalCandidate>()
  for (const result of args.results) {
    for (const candidate of result.evidence) {
      const current = byId.get(candidate.id)
      if (!current || candidate.finalScore > current.finalScore) byId.set(candidate.id, candidate)
    }
  }
  const reranked = filterSingleEntityPricingEvidence(
    rerankCandidates(args.originalQuestion, [...byId.values()], args.limit ?? MAX_EVIDENCE),
    analysis,
  )
  const calculation = analysis.calculationIntent.hasIntent ? calculateFromEvidence(analysis, reranked) : null
  const ambiguousWeakOffer = hasAmbiguousWeakOfferRows(analysis, args.rows)
  const fallbackReason =
    reranked.length === 0
      ? ambiguousWeakOffer ? 'ambiguous_offer' : 'no_relevant_knowledge'
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
  const shouldTryFullContextFallback = shouldAttemptFullContextFallback(fallbackReason, analysis, reranked)
  const fullContextFallback = shouldTryFullContextFallback
    ? buildFullContextFallback({
        analysis,
        sources: args.fullContextSources ?? buildFullContextSourcesFromRows(args.rows),
        tokenBudget: readFullContextFallbackTokenBudget(args.fullContextTokenBudget),
      })
    : {
        ...emptyFullContextFallbackDebug('not_needed'),
        tokenBudget: readFullContextFallbackTokenBudget(args.fullContextTokenBudget),
      }
  const fullContextChunks = fullContextFallback.outcome === 'succeeded'
    ? [formatFullContextFallbackBlock(args.fullContextSources ?? buildFullContextSourcesFromRows(args.rows))]
    : []
  const fullContextCalculationCandidates =
    !calculation && analysis.calculationIntent.hasIntent && fullContextFallback.outcome === 'succeeded'
      ? buildFullContextCalculationCandidates(args.fullContextSources ?? buildFullContextSourcesFromRows(args.rows), analysis, args.limit ?? MAX_EVIDENCE)
      : []
  const effectiveCalculation =
    calculation ?? (fullContextCalculationCandidates.length > 0 ? calculateFromEvidence(analysis, fullContextCalculationCandidates) : null)
  const recoveredByFullContext = fullContextFallback.outcome === 'succeeded' &&
    (!analysis.calculationIntent.hasIntent || effectiveCalculation?.status === 'computed')
  const effectiveFallbackReason = recoveredByFullContext ? null : fallbackReason
  const effectiveCalculationBlock =
    effectiveCalculation?.status === 'computed'
      ? `Computed fact: ${formatCalculationValue(effectiveCalculation)}\nFormula: ${effectiveCalculation.formula}\nSource chunk IDs: ${effectiveCalculation.sourceChunkIds.join(', ')}`
      : calculationBlock
  const effectiveFactGuidanceBlock = factGuidanceBlock ?? (
    fullContextCalculationCandidates.length > 0 ? buildFactGuidanceBlock(analysis, fullContextCalculationCandidates) : null
  )
  if (args.workspaceId && fullContextFallback.attempted) {
    console.info('[ai-chatbot] full-context fallback', {
      workspaceId: args.workspaceId,
      outcome: fullContextFallback.outcome,
      estimatedTokens: fullContextFallback.estimatedTokens,
      sourceCount: fullContextFallback.sourceCount,
    })
  }

  return {
    analysis: {
      ...analysis,
      queryVariants: [...new Set([...analysis.queryVariants, ...expandQuery(args.originalQuestion)])],
    },
    evidence: reranked.length > 0 ? reranked : fullContextCalculationCandidates,
    chunks: [
      ...fullContextChunks,
      ...(fullContextChunks.length > 0 ? [] : reranked.map(formatEvidenceBlock)),
      ...(effectiveFactGuidanceBlock ? [effectiveFactGuidanceBlock] : []),
      ...(effectiveCalculationBlock ? [effectiveCalculationBlock] : []),
    ],
    calculation: effectiveCalculation,
    fallbackReason: effectiveFallbackReason,
    debug: {
      formula: 'rrf',
      activeChunkCount: primary?.debug.activeChunkCount ?? args.rows.length,
      exactCandidatesCount: Math.max(0, ...args.results.map((result) => result.debug.exactCandidatesCount)),
      keywordCandidatesCount: Math.max(0, ...args.results.map((result) => result.debug.keywordCandidatesCount)),
      vectorCandidatesCount: Math.max(0, ...args.results.map((result) => result.debug.vectorCandidatesCount)),
      answerBearingCandidatesCount: Math.max(0, ...args.results.map((result) => result.debug.answerBearingCandidatesCount)),
      selectedChunkIds: (reranked.length > 0 ? reranked : fullContextCalculationCandidates).map((candidate) => candidate.id),
      selectedEvidence: (reranked.length > 0 ? reranked : fullContextCalculationCandidates).map((candidate) => ({
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
      answerMode: analysis.offerScope.answerMode,
      requestedFamily: analysis.offerScope.requestedFamily,
      requestedEntity: analysis.offerScope.requestedEntity,
      requestedVariantSpecs: analysis.offerScope.requestedVariantSpecs,
      requestedPeriod: analysis.offerScope.requestedPeriod,
      selectedOffer: buildSelectedOfferDebug(analysis, reranked.length > 0 ? reranked : fullContextCalculationCandidates),
      fullContextFallback,
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
  readonly question?: string
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
  const phoneNumberFragments = extractPhoneNumberFragments(answer)
  for (const number of extractNumberStrings(answer)) {
    const normalizedNumber = normalizeNumberString(number)
    if (phoneNumberFragments.has(normalizedNumber)) continue
    if (!allowedNumbers.has(normalizedNumber) && !isTraceableDerivedNumber(Number(normalizedNumber), args.evidence.join('\n'))) {
      return { ok: false, reason: 'unsupported_numeric_fact', answer: args.fallback }
    }
  }

  const claims = extractExactClaimSignals(answer)
  const evidenceCanonicalFacts = extractCanonicalExactFacts(args.evidence.join('\n'))
  for (const claim of claims) {
    const canonicalClaims = extractCanonicalExactFacts(claim)
    const normalizedClaim = claim.toLowerCase()
    const hasCanonicalSupport = canonicalClaims.length > 0
      ? canonicalClaims.some((canonicalClaim) => evidenceCanonicalFacts.includes(canonicalClaim))
      : false
    const traceableMoney = isMoneyClaimTraceable(claim, args.evidence.join('\n'), args.calculation)
    if (!evidenceText.includes(normalizedClaim) && !hasCanonicalSupport && !traceableMoney) {
      return { ok: false, reason: 'unsupported_exact_fact', answer: args.fallback }
    }
  }
  const entityConsistency = args.question
    ? validateSingleEntityFactConsistency({
        question: args.question,
        answer,
        evidence: args.evidence,
        calculation: args.calculation,
      })
    : null
  if (entityConsistency) return { ok: false, reason: entityConsistency, answer: args.fallback }
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

async function fetchWorkspaceSources(client: SupabaseClient, workspaceId: string): Promise<KnowledgeSourceRow[]> {
  const { data, error } = await client
    .from('ai_knowledge_sources')
    .select('id, title, source_type, status, content')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((source) => typeof source.content === 'string' && source.content.trim())
    .map((source) => ({
      id: String(source.id),
      title: String(source.title ?? 'Knowledge source'),
      source_type: typeof source.source_type === 'string' ? source.source_type : null,
      status: typeof source.status === 'string' ? source.status : null,
      content: String(source.content),
    }))
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

function scoreCandidate(
  row: KnowledgeChunkRow,
  index: number,
  analysis: RetrievalQuestionAnalysis,
  memoryContext?: MemoryRetrievalContext | null,
): RetrievalCandidate {
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
  const memoryScore = scoreMemoryContext(haystack, analysis.question, memoryContext)
  const keywordScore = analysis.terms.reduce((score, term) => score + countOccurrences(haystack, term), 0) + memoryScore
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
  const enrichedReasons = memoryScore > 0 ? [...reasons, 'memory_context_weak_match'] : reasons
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
    reasons: enrichedReasons,
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

function scoreMemoryContext(
  haystack: string,
  question: string,
  memoryContext?: MemoryRetrievalContext | null,
): number {
  if (!memoryContext) return 0
  const currentTerms = new Set(tokenize(question))
  const topicTerms = memoryContext.topicsDiscussed.flatMap(tokenize).filter((term) => !currentTerms.has(term))
  const intentTerms = memoryContext.lastIntent ? tokenize(memoryContext.lastIntent).filter((term) => !currentTerms.has(term)) : []
  const unresolvedTerms = memoryContext.unresolvedQuestions.flatMap(tokenize)
  const weakTopicScore = topicTerms.reduce((score, term) => score + (haystack.includes(term) ? 0.3 : 0), 0)
  const weakIntentScore = intentTerms.reduce((score, term) => score + (haystack.includes(term) ? 0.2 : 0), 0)
  const unresolvedOverlap = unresolvedTerms.filter((term) => currentTerms.has(term) && haystack.includes(term)).length
  return Math.min(6, weakTopicScore + weakIntentScore + unresolvedOverlap * 1.5)
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
    'total', 'billed', 'billing', 'equivalent',
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

function buildOfferQueryScope(args: {
  readonly question: string
  readonly terms: readonly string[]
  readonly entityTerms: readonly string[]
  readonly entityPhrases: readonly string[]
  readonly intents: RetrievalIntents
  readonly comparison: { readonly enabled: boolean; readonly entities: readonly string[] }
  readonly calculationIntent: ReturnType<typeof detectCalculationIntent>
}): OfferQueryScope {
  const normalizedQuestion = args.question.toLowerCase()
  const weakPlanNames = args.entityTerms
    .map((term) => normalizeEntityKey(term))
    .filter((term) => GENERIC_PLAN_NAMES.has(term))
  const requestedVariantSpecs = [...extractSpecClaims(args.question)]
  const requestedPeriod = args.calculationIntent.targetPeriod ?? readRequestedPeriod(normalizedQuestion)
  const requestedFamily = inferRequestedFamily(args.entityTerms, weakPlanNames, requestedVariantSpecs)
  const explicitEntityPhrase = extractRequestedEntityPhrase(args.question)
  const specificEntityFromPhrase = explicitEntityPhrase && shouldTreatPhraseAsSpecificEntity(explicitEntityPhrase)
    ? explicitEntityPhrase
    : null
  const requestedEntity = specificEntityFromPhrase ??
    (weakPlanNames.length > 0 ? [weakPlanNames.join(' '), requestedFamily].filter(Boolean).join(' ') : null)

  let answerMode: OfferAnswerMode = 'missing_or_ambiguous'
  if (args.comparison.enabled) answerMode = 'comparison'
  else if ((args.intents.contact || args.intents.hours || args.intents.location || args.intents.company || args.intents.ownership || args.intents.date) && !args.intents.pricing) {
    answerMode = 'contact_location_hours'
  } else if (args.intents.policy && !args.intents.pricing) {
    answerMode = 'policy_or_terms'
  } else if (args.intents.pricing || args.intents.productOrService) {
    const hasSpecificOfferSignal =
      weakPlanNames.length > 0 ||
      requestedVariantSpecs.length > 0 ||
      Boolean(specificEntityFromPhrase)
    answerMode = hasSpecificOfferSignal || args.comparison.entities.length > 0
      ? 'single_offer_exact'
      : (CATEGORY_LIST_SIGNALS.test(args.question) || Boolean(requestedFamily))
        ? 'category_pricing_list'
        : 'missing_or_ambiguous'
  }

  return {
    answerMode,
    requestedFamily,
    requestedEntity: requestedEntity || null,
    requestedVariantSpecs,
    requestedPeriod,
    weakPlanNames: [...new Set(weakPlanNames)],
  }
}

function inferRequestedFamily(
  entityTerms: readonly string[],
  weakPlanNames: readonly string[],
  requestedVariantSpecs: readonly string[],
): string | null {
  const weak = new Set(weakPlanNames)
  const specs = new Set(requestedVariantSpecs.map((spec) => normalizeEntityKey(spec)))
  const familyTerms = entityTerms
    .map((term) => normalizeEntityKey(term))
    .filter((term) =>
      term &&
      !weak.has(term) &&
      !PERIOD_WORDS.has(term) &&
      !SPEC_CONTEXT_TERMS.has(term) &&
      !specs.has(term.replace(/\s+/g, '')) &&
      !isSpecEntityTerm(term) &&
      !/^\d+(?:\.\d+)?$/.test(term),
    )
  if (familyTerms.length === 0) return null
  return [...new Set(familyTerms)].join(' ')
}

function extractRequestedEntityPhrase(question: string): string | null {
  const normalized = question
    .toLowerCase()
    .replace(/[?!.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const patterns = [
    /\b(?:price|pricing|cost|fee|rate|charges?)\s+(?:of|for)\s+(.+)$/,
    /\b(?:how much(?: does| is)?|what(?: is|'s)?(?: the)?)\s+(.+?)\s+(?:cost|price|fee|rate)\b/,
    /^(.+?)\s+(?:yearly|annual|monthly|weekly|daily)?\s*(?:price|pricing|cost|fee|rate)\b/,
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const value = cleanRequestedEntityPhrase(match?.[1] ?? '')
    if (value) return value
  }
  return null
}

function cleanRequestedEntityPhrase(value: string): string | null {
  const cleaned = value
    .replace(/\b(?:the|a|an|of|for|plan|package|service|product|item|course|menu|treatment|appointment|price|pricing|cost|fee|rate|yearly|annual|monthly|weekly|daily|discounted|original|regular|current|total|billed|billing|what|is|are|should|be|if)\b/g, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:usd|pkr|eur|gbp|\$|rs\.?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length >= 2 ? cleaned : null
}

function shouldTreatPhraseAsSpecificEntity(phrase: string): boolean {
  const terms = tokenize(phrase)
  if (terms.length === 0) return false
  if (terms.some((term) => GENERIC_PLAN_NAMES.has(term))) return true
  if (terms.some((term) => isSpecEntityTerm(term))) return true
  return terms.length >= 3
}

function readRequestedPeriod(value: string): BillingPeriod | null {
  if (/\b(daily|per day|\/day|day)\b/.test(value)) return 'daily'
  if (/\b(weekly|per week|\/week|week)\b/.test(value)) return 'weekly'
  if (/\b(monthly|per month|\/mo|\/month|month|mo)\b/.test(value)) return 'monthly'
  if (/\b(quarterly|per quarter|quarter)\b/.test(value)) return 'quarterly'
  if (/\b(yearly|annual|annually|per year|\/year|year)\b/.test(value)) return 'yearly'
  return null
}

function isSpecEntityTerm(term: string): boolean {
  return /\b\d+(?:[.,]\d+)?\s*(?:gb|tb|mb|kb|cores?|core|cpu|ram|storage|nvme|ssd|kg|g|mg|ml|l|hours?|days?|weeks?|months?|years?|sessions?|users?|seats?|people|servings?)\b/i.test(term.replace(/(\d)([a-z])/gi, '$1 $2'))
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

function filterSingleEntityPricingEvidence(
  candidates: readonly RetrievalCandidate[],
  analysis: RetrievalQuestionAnalysis,
): RetrievalCandidate[] {
  if (candidates.length <= 1 || analysis.comparison.enabled || analysis.entityTerms.length === 0) return [...candidates]
  if (!analysis.intents.pricing && !analysis.intents.productOrService) return [...candidates]
  if (analysis.offerScope.answerMode === 'category_pricing_list' || analysis.offerScope.answerMode === 'comparison') return [...candidates]
  const offers = candidates.flatMap((candidate) => extractStructuredPricingOffersFromCandidate(candidate))
  const target = selectStructuredPricingOffer(analysis, offers) ?? selectScopedStructuredPricingOfferFallback(analysis, offers)
  if (!target) return [...candidates]
  const filtered = candidates.filter((candidate) => {
    if (candidate.id === target.sourceChunkId) return true
    const offers = extractStructuredPricingOffersFromCandidate(candidate)
    return offers.length === 0
  })
  return filtered.length > 0 ? filtered : [...candidates]
}

function hasAmbiguousWeakOfferRows(
  analysis: RetrievalQuestionAnalysis,
  rows: readonly KnowledgeChunkRow[],
): boolean {
  if (
    analysis.offerScope.weakPlanNames.length === 0 ||
    analysis.offerScope.requestedFamily ||
    analysis.offerScope.requestedVariantSpecs.length > 0 ||
    analysis.offerScope.answerMode !== 'single_offer_exact'
  ) {
    return false
  }
  const offers = rows
    .filter((row) => row.chunk_text && row.source?.status !== 'archived')
    .flatMap((row) => extractStructuredPricingOffers(row.chunk_text, row.id ?? row.source_id ?? 'row'))
    .filter((offer) => {
      const haystack = normalizeEntityKey(structuredOfferSearchText(offer))
      return analysis.offerScope.weakPlanNames.some((name) => entityContainsTerm(haystack, name))
    })
  if (offers.length <= 1) return false
  const families = new Set(offers.map((offer) => normalizeEntityKey(offer.product_family ?? '')).filter(Boolean))
  return families.size > 1
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

function readFullContextFallbackTokenBudget(override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) return Math.floor(override)
  const configured = Number(process.env.AI_FULL_CONTEXT_FALLBACK_TOKEN_BUDGET ?? '')
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_FULL_CONTEXT_FALLBACK_TOKEN_BUDGET
}

function emptyFullContextFallbackDebug(outcome: FullContextFallbackDebug['outcome']): FullContextFallbackDebug {
  return {
    attempted: false,
    outcome,
    estimatedTokens: 0,
    tokenBudget: DEFAULT_FULL_CONTEXT_FALLBACK_TOKEN_BUDGET,
    sourceCount: 0,
    sourceTitles: [],
  }
}

function shouldAttemptFullContextFallback(
  fallbackReason: string | null,
  analysis: RetrievalQuestionAnalysis,
  candidates: readonly RetrievalCandidate[],
): boolean {
  if (
    fallbackReason &&
    analysis.offerScope.weakPlanNames.length > 0 &&
    !analysis.offerScope.requestedFamily &&
    analysis.offerScope.requestedVariantSpecs.length === 0
  ) {
    return false
  }
  if (fallbackReason && new Set(['no_relevant_knowledge', 'cannot_compute', 'ambiguous_offer', 'weak_selected_evidence', 'family_mismatch', 'conflicting_facts']).has(fallbackReason)) {
    return true
  }
  if (!fallbackReason && analysis.offerScope.requestedFamily && candidates.length > 0 && analysis.offerScope.answerMode === 'single_offer_exact') {
    return !candidates.some((candidate) =>
      extractStructuredPricingOffersFromCandidate(candidate).some((offer) => scoreOfferFamilyMatch(analysis.offerScope.requestedFamily, offer) > 0),
    )
  }
  return false
}

function buildFullContextFallback(args: {
  readonly analysis: RetrievalQuestionAnalysis
  readonly sources: readonly KnowledgeSourceRow[]
  readonly tokenBudget: number
}): FullContextFallbackDebug {
  const sources = args.sources
    .filter((source) => source.status !== 'archived' && source.content.trim())
    .map((source) => ({ ...source, content: normalizeKnowledgeForFullContext(source.content) }))
    .filter((source) => source.content)
  const sourceTitles = sources.map((source) => source.title).slice(0, 20)
  const estimatedTokens = estimateTokenCount(formatFullContextFallbackBlock(sources))
  if (sources.length === 0) {
    return {
      attempted: true,
      outcome: 'skipped_empty',
      estimatedTokens: 0,
      tokenBudget: args.tokenBudget,
      sourceCount: 0,
      sourceTitles: [],
    }
  }
  if (estimatedTokens > args.tokenBudget) {
    return {
      attempted: true,
      outcome: 'skipped_budget',
      estimatedTokens,
      tokenBudget: args.tokenBudget,
      sourceCount: sources.length,
      sourceTitles,
    }
  }
  const combined = sources.map((source) => `${source.title}\n${source.content}`).join('\n\n')
  return {
    attempted: true,
    outcome: fullContextLikelyContainsAnswer(args.analysis, combined) ? 'succeeded' : 'still_fallback',
    estimatedTokens,
    tokenBudget: args.tokenBudget,
    sourceCount: sources.length,
    sourceTitles,
  }
}

function buildFullContextSourcesFromRows(rows: readonly KnowledgeChunkRow[]): KnowledgeSourceRow[] {
  const bySource = new Map<string, KnowledgeSourceRow>()
  rows
    .filter((row) => row.chunk_text && row.source?.status !== 'archived')
    .forEach((row, index) => {
      const sourceId = row.source_id ?? row.source?.id ?? `source-${index}`
      const existing = bySource.get(sourceId)
      const title = row.source?.title ?? readMetadataString(row.metadata, 'title') ?? 'Knowledge source'
      const content = existing ? `${existing.content}\n\n${row.chunk_text}` : row.chunk_text
      bySource.set(sourceId, {
        id: sourceId,
        title,
        source_type: row.source?.source_type ?? null,
        status: row.source?.status ?? 'active',
        content,
      })
    })
  return [...bySource.values()]
}

function buildFullContextCalculationCandidates(
  sources: readonly KnowledgeSourceRow[],
  analysis: RetrievalQuestionAnalysis,
  limit: number,
): RetrievalCandidate[] {
  const rows: KnowledgeChunkRow[] = sources.map((source, index) => ({
    id: `full-context:${source.id}:${index}`,
    source_id: source.id,
    chunk_text: source.content,
    search_text: source.content,
    chunk_index: index,
    structured_facts: buildChunkSearchMetadata(source.content, index).structured_facts as Record<string, unknown>,
    source: {
      id: source.id,
      title: source.title,
      source_type: source.source_type,
      status: source.status,
    },
  }))
  const candidates = rows
    .map((row, index) => scoreCandidate(row, index, analysis))
    .map((candidate) => ({ ...candidate, finalScore: candidate.answerScore + candidate.entityScore + candidate.keywordScore + candidate.phraseScore + candidate.vectorScore }))
    .filter((candidate) => candidate.finalScore > 0)
  return filterSingleEntityPricingEvidence(rerankCandidates(analysis.question, candidates, limit), analysis)
}

function formatFullContextFallbackBlock(sources: readonly KnowledgeSourceRow[]): string {
  return [
    'Full active workspace knowledge fallback context.',
    'Use only the facts present below. If the requested fact is not present, return the configured fallback message exactly.',
    ...sources.map((source, index) => [
      `\n[Full source ${index + 1}] ${source.title}`,
      `Source type: ${source.source_type ?? 'knowledge'}`,
      normalizeKnowledgeForFullContext(source.content),
    ].join('\n')),
  ].join('\n')
}

function normalizeKnowledgeForFullContext(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

function fullContextLikelyContainsAnswer(analysis: RetrievalQuestionAnalysis, text: string): boolean {
  const normalized = text.toLowerCase()
  const entityMatched =
    analysis.entityTerms.length === 0 ||
    analysis.entityTerms.some((term) => normalized.includes(term.toLowerCase()) || normalized.replace(/\s+/g, '').includes(term.toLowerCase().replace(/\s+/g, '')))
  if (analysis.intents.contact) {
    return /(?:https?:\/\/)?wa\.me\/\d+|whatsapp:\S+|tel:\s*\+?\d|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{7,}\d/i.test(text)
  }
  if (analysis.intents.pricing) return entityMatched && containsPriceFact(text) && !hasTextualSameLabelPriceConflict(text)
  if (analysis.intents.policy) return entityMatched && /\b(policy|refund|return|exchange|cancel|cancellation|delivery|shipping|terms)\b/i.test(text)
  if (analysis.intents.hours) return /\b(hours?|open|closed?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm)\b/i.test(text)
  if (analysis.intents.location) return /\b(address|location|branch|street|road|city|country|office)\b/i.test(text)
  if (analysis.intents.company || analysis.intents.ownership) {
    return /\b(company number|registration number|registered number|legal entity|operated by|owned by|founder|owner|behind)\b/i.test(text) || extractLegalEntityNames(text).length > 0
  }
  if (analysis.intents.date) return /\b(founded|launched|established|created|built|published|updated|modified|lastmod|sitemap date|page date|20\d{2}-\d{2}-\d{2})\b/i.test(text)
  if (analysis.intents.productOrService) return entityMatched && /\b(product|service|package|plan|menu|course|treatment|appointment|booking|available|offer)\b/i.test(text)
  const matchedTerms = analysis.terms.filter((term) => normalized.includes(term)).length
  return analysis.terms.length > 0 && matchedTerms >= Math.min(2, analysis.terms.length)
}

function containsPriceFact(text: string): boolean {
  return /(?:\$|rs\.?|pkr|usd|eur|gbp)\s*\d+(?:[.,]\d+)?|\bprice\s*:\s*\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s*\/\s*(?:mo|month|monthly|year|yearly|annual)\b|\b\d+(?:[.,]\d+)?\s*(?:mo|month|monthly|year|yearly|annual)\b/i.test(text)
}

function calculateFromEvidence(
  analysis: RetrievalQuestionAnalysis,
  candidates: readonly RetrievalCandidate[],
): CalculationResult | null {
  const structuredResult = calculateFromStructuredPricingOffers(analysis, candidates)
  if (structuredResult) return structuredResult

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

function calculateFromStructuredPricingOffers(
  analysis: RetrievalQuestionAnalysis,
  candidates: readonly RetrievalCandidate[],
): CalculationResult | null {
  const offers = candidates.flatMap((candidate) => extractStructuredPricingOffersFromCandidate(candidate))
  const offer = selectStructuredPricingOffer(analysis, offers) ?? selectScopedStructuredPricingOfferFallback(analysis, offers)
  if (!offer) return null
  const sourceIds = [offer.sourceChunkId]
  const targetPeriod = analysis.calculationIntent.targetPeriod
  const wantsOriginal = asksForOriginalPrice(analysis.question)
  const rawBasePrice = wantsOriginal ? offer.original_price ?? offer.current_price : offer.current_price
  const basePrice = rawBasePrice ? withInferredStructuredPricePeriod(rawBasePrice, offer) : null

  if (analysis.calculationIntent.periodConversion && targetPeriod) {
    const stored = offer.stored_period_totals[targetPeriod]
    if (stored && !wantsOriginal) {
      return storedBillingTotal(stored.amount, targetPeriod, sourceIds, stored.currency)
    }
    const durationTotal = !wantsOriginal ? selectBillingTotalForTarget(offer.billing_totals, targetPeriod) : null
    if (durationTotal) {
      return convertStructuredBillingTotal(durationTotal, targetPeriod, sourceIds)
    }
    const storedSource = !wantsOriginal ? selectStoredPeriodSource(offer.stored_period_totals, targetPeriod) : null
    if (storedSource?.period) {
      return convertBillingTotal(storedSource.amount, storedSource.period, targetPeriod, sourceIds, storedSource.currency)
    }
    const originalPrice = offer.original_price ? withInferredStructuredPricePeriod(offer.original_price, offer) : null
    if (!basePrice && !wantsOriginal && originalPrice?.period && offer.discount_percent !== null) {
      const discounted = applyPercentage(originalPrice.amount, offer.discount_percent, 'discount', sourceIds, originalPrice.currency)
      if (discounted.status !== 'computed' || discounted.value === null) return discounted
      return convertBillingTotal(discounted.value, originalPrice.period, targetPeriod, sourceIds, originalPrice.currency)
    }
    if (!basePrice?.period) return null
    return convertBillingTotal(basePrice.amount, basePrice.period, targetPeriod, sourceIds, basePrice.currency)
  }

  if (analysis.calculationIntent.percentage) {
    const percent = offer.discount_percent
    const priceForPercent = wantsOriginal ? offer.original_price ?? offer.current_price : offer.original_price ?? offer.current_price
    if (!priceForPercent || percent === null) return null
    return applyPercentage(priceForPercent.amount, percent, /markup/i.test(analysis.question) ? 'markup' : 'discount', sourceIds, priceForPercent.currency)
  }

  if (analysis.calculationIntent.bulk && analysis.calculationIntent.quantity && basePrice) {
    return bulkOrTieredPrice(basePrice.amount, analysis.calculationIntent.quantity, sourceIds, [], basePrice.currency)
  }

  if (analysis.calculationIntent.tax && basePrice) {
    const percent = offer.discount_percent
    if (percent === null) return null
    return applyTax(basePrice.amount, percent, /\b(inclusive|including)\b/i.test(analysis.question) ? 'inclusive' : 'exclusive', sourceIds, basePrice.currency)
  }

  return null
}

function withInferredStructuredPricePeriod(
  value: StructuredPriceValue,
  offer: StructuredPricingOffer,
): StructuredPriceValue {
  if (value.period) return value
  const period = inferStructuredPricePeriod(value, offer)
  return period ? { ...value, period } : value
}

function inferStructuredPricePeriod(
  value: StructuredPriceValue,
  offer: StructuredPricingOffer,
): BillingPeriod | null {
  const evidence = [offer.source_text, offer.source_excerpt, offer.context_text].filter(Boolean).join('\n')
  const amount = roundCalculationNumber(value.amount)
  const currency = value.currency
  const matchingMoney = extractMoneyMatches(evidence)
    .filter((match) =>
      roundCalculationNumber(match.amount) === amount &&
      (!currency || !match.currency || match.currency === currency) &&
      Boolean(match.period),
    )
    .sort((left, right) => {
      const leftTextMatch = value.text && left.text.includes(value.text) ? 1 : 0
      const rightTextMatch = value.text && right.text.includes(value.text) ? 1 : 0
      return rightTextMatch - leftTextMatch
    })[0]
  if (matchingMoney?.period) return matchingMoney.period

  const amountPattern = escapeRegex(String(value.amount)).replace(/\\\./g, '[.,]')
  const amountWithOptionalTrailingZero = amountPattern.includes('[.,]')
    ? amountPattern.replace(/0+$/, '\\d*')
    : `${amountPattern}(?:[.,]0+)?`
  const contextPattern = new RegExp(`(?:[$€£]|USD|PKR|EUR|GBP|AED|SAR|Rs\\.?)?\\s*${amountWithOptionalTrailingZero}\\s*(?:/|per\\s+)?\\s*(mo|month|monthly|year|yearly|annual|annually|week|weekly|day|daily|quarter|quarterly)`, 'i')
  const contextMatch = evidence.match(contextPattern)
  return normalizePeriod(contextMatch?.[1] ?? '') ?? inferDominantStructuredPricePeriod(evidence)
}

function inferDominantStructuredPricePeriod(evidence: string): BillingPeriod | null {
  const periods = new Set(
    extractMoneyMatches(evidence)
      .map((match) => match.period)
      .filter((period): period is BillingPeriod => Boolean(period)),
  )
  return periods.size === 1 ? [...periods][0] ?? null : null
}

function selectBillingTotalForTarget(
  totals: readonly StructuredBillingTotal[],
  targetPeriod: BillingPeriod,
): StructuredBillingTotal | null {
  const convertible = totals.filter((total) => billingTotalCanConvertToPeriod(total, targetPeriod))
  if (convertible.length === 0) return null
  return [...convertible].sort((left, right) => {
    const leftExact = left.duration_count === 1 && left.period === targetPeriod ? 1 : 0
    const rightExact = right.duration_count === 1 && right.period === targetPeriod ? 1 : 0
    return rightExact - leftExact || left.duration_count - right.duration_count
  })[0] ?? null
}

function billingTotalCanConvertToPeriod(total: StructuredBillingTotal, targetPeriod: BillingPeriod): boolean {
  if (!total.period) return false
  if (total.duration_unit === 'session') return false
  return Boolean(periodsPerDurationUnit(total.duration_unit) && periodsPerTarget(targetPeriod))
}

function convertStructuredBillingTotal(
  total: StructuredBillingTotal,
  targetPeriod: BillingPeriod,
  sourceChunkIds: readonly string[],
): CalculationResult {
  const sourcePeriodsPerYear = periodsPerDurationUnit(total.duration_unit)
  const targetPeriodsPerYear = periodsPerTarget(targetPeriod)
  if (!sourcePeriodsPerYear || !targetPeriodsPerYear || total.duration_count <= 0) {
    return {
      status: 'cannot_compute',
      value: null,
      formula: '',
      unit: `${total.currency}/${targetPeriod}`.trim(),
      sourceChunkIds,
      reason: 'Unsupported billing duration.',
    }
  }
  const coveredYears = total.duration_count / sourcePeriodsPerYear
  const yearlyTotal = total.amount / coveredYears
  const value = yearlyTotal / targetPeriodsPerYear
  const formula = `${total.amount} ${total.currency} billed per ${formatDurationCount(total.duration_count, total.duration_unit)} = ${roundCalculationNumber(value)} ${total.currency}/${targetPeriod}`
  return {
    status: 'computed',
    value: roundCalculationNumber(value),
    formula,
    unit: `${total.currency}/${targetPeriod}`.trim(),
    sourceChunkIds,
  }
}

function periodsPerDurationUnit(unit: BillingDurationUnit): number | null {
  if (unit === 'day') return 365
  if (unit === 'week') return 52
  if (unit === 'month') return 12
  if (unit === 'quarter') return 4
  if (unit === 'year') return 1
  return null
}

function periodsPerTarget(period: BillingPeriod): number {
  if (period === 'daily') return 365
  if (period === 'weekly') return 52
  if (period === 'monthly') return 12
  if (period === 'quarterly') return 4
  return 1
}

function formatDurationCount(count: number, unit: BillingDurationUnit): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

function selectStoredPeriodSource(
  totals: Partial<Record<BillingPeriod, StructuredPriceValue>>,
  targetPeriod: BillingPeriod,
): StructuredPriceValue | null {
  const preference: BillingPeriod[] = targetPeriod === 'monthly'
    ? ['yearly', 'quarterly', 'weekly', 'daily']
    : targetPeriod === 'yearly'
      ? ['monthly', 'quarterly', 'weekly', 'daily']
      : ['yearly', 'monthly', 'quarterly', 'weekly', 'daily']
  for (const period of preference) {
    const value = totals[period]
    if (value?.period) return value
  }
  return null
}

function selectStructuredPricingOffer(
  analysis: RetrievalQuestionAnalysis,
  offers: readonly StructuredPricingOffer[],
): StructuredPricingOffer | null {
  if (offers.length === 0) return null
  const scope = analysis.offerScope
  const scored = offers
    .map((offer, index) => {
      const entityHaystack = normalizeEntityKey(offer.entity ?? '')
      const sourceHaystack = normalizeEntityKey(structuredOfferSearchText(offer))
      let score = offers.length - index
      let entityLabelMatches = 0
      const familyMatchScore = scoreOfferFamilyMatch(scope.requestedFamily, offer)
      const specMatchScore = scoreOfferSpecMatch(scope.requestedVariantSpecs, offer)
      if (scope.requestedFamily) {
        if (familyMatchScore > 0) score += familyMatchScore
        else score -= scope.answerMode === 'single_offer_exact' ? 90 : 30
      }
      if (scope.requestedVariantSpecs.length > 0) {
        if (specMatchScore > 0) {
          score += specMatchScore
          entityLabelMatches += specMatchScore >= 40 ? 1 : 0
        } else {
          score -= 80
        }
      }
      if (scope.answerMode === 'single_offer_exact' && scope.weakPlanNames.length > 0) {
        const weakNameMatched = scope.weakPlanNames.some((name) =>
          entityContainsTerm(entityHaystack, name) || entityContainsTerm(sourceHaystack, name),
        )
        if (!weakNameMatched) score -= 120
      }
      if (scope.requestedEntity) {
        const normalizedRequestedEntity = normalizeEntityKey(scope.requestedEntity)
        if (entityContainsTerm(entityHaystack, normalizedRequestedEntity)) {
          score += 95
          entityLabelMatches += 1
        } else if (entityContainsTerm(sourceHaystack, normalizedRequestedEntity)) {
          score += 18
        }
      }
      for (const weakName of scope.weakPlanNames) {
        if (entityContainsTerm(entityHaystack, weakName)) {
          score += scope.requestedFamily ? 45 : 18
          entityLabelMatches += 1
        } else if (entityContainsTerm(sourceHaystack, weakName)) {
          score += 6
        }
      }
      for (const phrase of analysis.entityPhrases) {
        const normalizedPhrase = normalizeEntityKey(phrase)
        if (entityContainsTerm(entityHaystack, normalizedPhrase)) {
          score += 90
          entityLabelMatches += 1
        } else if (entityContainsTerm(sourceHaystack, normalizedPhrase)) score += 10
      }
      for (const term of analysis.entityTerms) {
        const normalizedTerm = normalizeEntityKey(term)
        if (!normalizedTerm) continue
        if (entityContainsTerm(entityHaystack, normalizedTerm)) {
          score += /\d/.test(term) ? 55 : 25
          entityLabelMatches += 1
        }
        else if (entityContainsTerm(sourceHaystack, normalizedTerm)) score += /\d/.test(term) ? 12 : 5
      }
      for (const number of analysis.numbers) {
        if (entityContainsTerm(entityHaystack, String(number))) {
          score += 25
          entityLabelMatches += 1
        }
      }
      if (analysis.calculationIntent.targetPeriod && offerHasBillingForTarget(offer, analysis.calculationIntent.targetPeriod)) score += 40
      if (offer.current_price) score += 10
      if (offer.original_price && offer.discount_percent !== null) score += 10
      if (scope.answerMode === 'single_offer_exact' && analysis.entityTerms.length > 0 && entityLabelMatches === 0) score -= 45
      return { offer, score }
    })
    .sort((left, right) => right.score - left.score)
  if (scope.weakPlanNames.length > 0 && !scope.requestedFamily && scope.requestedVariantSpecs.length === 0) {
    const weakMatches = scored.filter((item) => {
      const haystack = normalizeEntityKey(structuredOfferSearchText(item.offer))
      return scope.weakPlanNames.some((name) => entityContainsTerm(haystack, name))
    })
    const families = new Set(weakMatches.map((item) => normalizeEntityKey(item.offer.product_family ?? '')).filter(Boolean))
    if (weakMatches.length > 1 && families.size > 1) return null
  }
  const best = scored[0]
  if (scope.requestedVariantSpecs.length > 0) {
    const specMatchedRaw = scored.filter((item) => scoreOfferSpecMatch(scope.requestedVariantSpecs, item.offer) > 0)
    const specMatched = scope.requestedFamily
      ? specMatchedRaw.filter((item) => scoreOfferFamilyMatch(scope.requestedFamily, item.offer) > 0)
      : specMatchedRaw
    if (specMatched.length === 1 || (specMatched[0] && specMatched[1] && specMatched[0].score - specMatched[1].score >= 10)) {
      return specMatched[0]?.offer ?? null
    }
  }
  if (!best || best.score < 15) return null
  const second = scored[1]
  if (
    scope.answerMode === 'single_offer_exact' &&
    second &&
    best.score - second.score < 5 &&
    !offerMatchesRequestedScope(best.offer, scope)
  ) {
    return null
  }
  return best.offer
}

function selectScopedStructuredPricingOfferFallback(
  analysis: RetrievalQuestionAnalysis,
  offers: readonly StructuredPricingOffer[],
): StructuredPricingOffer | null {
  const scope = analysis.offerScope
  if (!scope.requestedFamily && scope.requestedVariantSpecs.length === 0) return null
  const scoped = offers
    .map((offer) => {
      const familyScore = scoreOfferFamilyMatch(scope.requestedFamily, offer)
      const specScore = scoreOfferSpecMatch(scope.requestedVariantSpecs, offer)
      const haystack = normalizeEntityKey(structuredOfferSearchText(offer))
      const weakNameMatched = scope.weakPlanNames.length === 0 || scope.weakPlanNames.some((name) => entityContainsTerm(haystack, name))
      if (scope.requestedFamily && familyScore <= 0) return null
      if (scope.requestedVariantSpecs.length > 0 && specScore <= 0) return null
      if (!weakNameMatched) return null
      const requestedEntityScore = scope.requestedEntity && entityContainsTerm(haystack, normalizeEntityKey(scope.requestedEntity)) ? 30 : 0
      const periodScore = analysis.calculationIntent.targetPeriod && offerHasBillingForTarget(offer, analysis.calculationIntent.targetPeriod) ? 30 : 0
      const priceScore = offer.current_price ? 12 : 0
      const billingScore = Object.keys(offer.stored_period_totals).length * 8 + offer.billing_totals.length * 8
      return { offer, score: familyScore + specScore + requestedEntityScore + periodScore + priceScore + billingScore + offerCompletenessScore(offer) }
    })
    .filter((item): item is { readonly offer: StructuredPricingOffer; readonly score: number } => Boolean(item))
    .sort((left, right) => right.score - left.score)
  return scoped[0]?.offer ?? null
}

function structuredOfferSearchText(offer: StructuredPricingOffer): string {
  return [
    offer.entity,
    offer.entity_name,
    offer.product_family,
    offer.category_path.join(' '),
    Object.values(offer.variant_specs).join(' '),
    offer.heading_path.join(' '),
    offer.source_url,
    offer.source_text,
  ].filter(Boolean).join('\n')
}

function scoreOfferFamilyMatch(requestedFamily: string | null, offer: StructuredPricingOffer): number {
  if (!requestedFamily) return 0
  const familyTerms = tokenize(requestedFamily)
  if (familyTerms.length === 0) return 0
  const haystack = normalizeEntityKey(structuredOfferSearchText(offer))
  const matched = familyTerms.filter((term) => entityContainsTerm(haystack, term)).length
  if (matched === 0) return 0
  const ratio = matched / familyTerms.length
  const exactFamily = offer.product_family && entityContainsTerm(normalizeEntityKey(offer.product_family), normalizeEntityKey(requestedFamily))
  return Math.round((exactFamily ? 35 : 18) + ratio * 45)
}

function scoreOfferSpecMatch(requestedSpecs: readonly string[], offer: StructuredPricingOffer): number {
  if (requestedSpecs.length === 0) return 0
  const offerSpecs = extractSpecClaims(structuredOfferSpecText(offer))
  let matched = 0
  for (const spec of requestedSpecs) {
    if ([...offerSpecs].some((offerSpec) => specsAreCompatible(spec, offerSpec))) matched += 1
  }
  if (matched === 0) return 0
  return Math.round((matched / requestedSpecs.length) * 80)
}

function structuredOfferSpecText(offer: StructuredPricingOffer): string {
  return [
    offer.entity,
    offer.entity_name,
    offer.product_family,
    offer.category_path.join(' '),
    Object.values(offer.variant_specs).join(' '),
    offer.heading_path.join(' '),
  ].filter(Boolean).join('\n')
}

function specsAreCompatible(requestedSpec: string, offerSpec: string): boolean {
  if (requestedSpec === offerSpec) return true
  const requested = requestedSpec.toLowerCase()
  const offered = offerSpec.toLowerCase()
  return requested.length >= 3 && offered.startsWith(requested) && /\d/.test(requested)
}

function offerHasBillingForTarget(offer: StructuredPricingOffer, targetPeriod: BillingPeriod): boolean {
  if (offer.stored_period_totals[targetPeriod]) return true
  const currentPrice = offer.current_price ? withInferredStructuredPricePeriod(offer.current_price, offer) : null
  const originalPrice = offer.original_price ? withInferredStructuredPricePeriod(offer.original_price, offer) : null
  return offer.billing_totals.some((total) => billingTotalCanConvertToPeriod(total, targetPeriod))
    || Boolean(currentPrice?.period && periodsPerTarget(currentPrice.period) && periodsPerTarget(targetPeriod))
    || Boolean(originalPrice?.period && periodsPerTarget(originalPrice.period) && periodsPerTarget(targetPeriod))
}

function offerMatchesRequestedScope(offer: StructuredPricingOffer, scope: OfferQueryScope): boolean {
  if (scope.requestedFamily && scoreOfferFamilyMatch(scope.requestedFamily, offer) <= 0) return false
  if (scope.requestedVariantSpecs.length > 0 && scoreOfferSpecMatch(scope.requestedVariantSpecs, offer) <= 0) return false
  if (!scope.requestedEntity && scope.weakPlanNames.length === 0) return true
  const haystack = normalizeEntityKey(structuredOfferSearchText(offer))
  if (scope.requestedEntity && entityContainsTerm(haystack, normalizeEntityKey(scope.requestedEntity))) return true
  return scope.weakPlanNames.some((name) => entityContainsTerm(haystack, name))
}

function entityContainsTerm(haystack: string, term: string): boolean {
  if (!haystack || !term) return false
  const normalizedHaystack = normalizeEntityKey(haystack)
  const normalizedTerm = normalizeEntityKey(term)
  if (!normalizedHaystack || !normalizedTerm) return false
  if (normalizedTerm.length <= 3 && !/\d/.test(normalizedTerm)) {
    return normalizedHaystack.split(/\s+/).includes(normalizedTerm)
  }
  return normalizedHaystack.includes(normalizedTerm) || normalizedHaystack.replace(/\s+/g, '').includes(normalizedTerm.replace(/\s+/g, ''))
}

function storedBillingTotal(
  amount: number,
  period: BillingPeriod,
  sourceChunkIds: readonly string[],
  currency = '',
): CalculationResult {
  return {
    status: 'computed',
    value: roundCalculationNumber(amount),
    formula: `Stored ${period} total from source = ${roundCalculationNumber(amount)} ${currency}/${period}`,
    unit: `${currency}/${period}`.trim(),
    sourceChunkIds,
  }
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
      if (asksForOriginalPrice(analysis.question)) {
        if (isOriginalPriceFact(fact)) score += 70
        if (isCurrentPriceFact(fact)) score -= 20
      } else {
        if (isCurrentPriceFact(fact)) score += 70
        if (isOriginalPriceFact(fact)) score -= analysis.calculationIntent.percentage ? 0 : 25
      }
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

function asksForOriginalPrice(question: string): boolean {
  return /\b(original|regular|before discount|before sale|list price|base price|standard price|undiscounted)\b/i.test(question)
}

function isOriginalPriceFact(fact: ExtractedPriceFact): boolean {
  return isOriginalPriceContext(fact.localContext)
}

function isCurrentPriceFact(fact: ExtractedPriceFact): boolean {
  return isCurrentPriceContext(fact.localContext)
    || (fact.isTotal && /\b(discount|billed|total)\b/i.test(fact.localContext))
}

function isOriginalPriceContext(value: string): boolean {
  return /\b(original|regular|before discount|before sale|list price|base price|standard price|was|undiscounted|struck|strikethrough)\b|~~\s*(?:\$|rs\.?|pkr|usd|eur|gbp)?\s*\d/i.test(value)
}

function isCurrentPriceContext(value: string): boolean {
  return /\b(current|discounted|sale|now|today|effective|after discount|special|offer|promo|save|deal|starting at|starts at)\b/i.test(value)
}

function hasTextualSameLabelPriceConflict(text: string): boolean {
  const byLabel = new Map<string, Set<number>>()
  for (const match of text.matchAll(/\b([a-z0-9][a-z0-9 -]{1,60}?)\s+price\s+is\s+(?:\$|usd|gbp|eur|pkr|rs\.?)?\s*(\d+(?:[.,]\d+)?)/gi)) {
    const label = normalizeConflictLabel(match[1] ?? '')
    if (!label) continue
    const values = byLabel.get(label) ?? new Set<number>()
    values.add(roundCalculationNumber(Number((match[2] ?? '').replace(',', '.'))))
    byLabel.set(label, values)
  }
  return [...byLabel.values()].some((values) => values.size > 1)
}

interface ExtractedPriceFact {
  readonly kind: 'price'
  readonly amount: number
  readonly currency: string
  readonly period: BillingPeriod | null
  readonly label: string | null
  readonly context: string
  readonly localContext: string
  readonly isTotal: boolean
  readonly sourceChunkId: string
}

interface StructuredPriceValue {
  readonly amount: number
  readonly currency: string
  readonly period: BillingPeriod | null
  readonly text: string
}

type StructuredOfferEntityType =
  | 'product'
  | 'service'
  | 'plan'
  | 'package'
  | 'menu_item'
  | 'course'
  | 'treatment'
  | 'appointment'
  | 'subscription'
  | 'membership'
  | 'fee'
  | 'unknown'

type BillingDurationUnit = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'session'

interface StructuredBillingTotal {
  readonly amount: number
  readonly currency: string
  readonly duration_count: number
  readonly duration_unit: BillingDurationUnit
  readonly label: string
  readonly source_text: string
  readonly period: BillingPeriod | null
}

interface StructuredPricingOffer {
  readonly kind: 'pricing_offer'
  readonly entity: string | null
  readonly entity_name: string | null
  readonly entity_type: StructuredOfferEntityType
  readonly product_family: string | null
  readonly category_path: readonly string[]
  readonly variant_specs: Record<string, string>
  readonly current_price: StructuredPriceValue | null
  readonly original_price: StructuredPriceValue | null
  readonly discount_percent: number | null
  readonly stored_period_totals: Partial<Record<BillingPeriod, StructuredPriceValue>>
  readonly billing_totals: readonly StructuredBillingTotal[]
  readonly source_url: string | null
  readonly heading_path: readonly string[]
  readonly source_excerpt: string
  readonly confidence: 'high' | 'medium' | 'low'
  readonly source_origin: 'persisted' | 'runtime'
  readonly source_text: string
  readonly context_text: string
  readonly sourceChunkId: string
}

interface MoneyMatch {
  readonly amount: number
  readonly currency: string
  readonly period: BillingPeriod | null
  readonly text: string
  readonly index: number
  readonly localContext: string
  readonly isTotal: boolean
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
    const before = text.slice(Math.max(0, (match.index ?? 0) - 45), match.index ?? 0)
    const after = text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 55)
    if (!(match[1] || match[3]) && isBillingDurationCountMatch(before, match[0], after)) continue
    if (!(match[1] || match[3]) && isSpecQuantityMatch(before, match[0], after)) continue
    if (!(match[1] || match[3]) && !hasExplicitNonCurrencyPriceContext(before, match[0], after)) continue
    const context = text.slice(Math.max(0, match.index - 80), (match.index ?? 0) + match[0].length + 80).toLowerCase()
    const localContext = text.slice(Math.max(0, match.index - 45), (match.index ?? 0) + match[0].length + 35).toLowerCase()
    if (!/(price|cost|fee|rate|plan|package|per|\/|month|year|week|day|\$|rs|pkr|usd|eur|gbp)/i.test(context)) continue
    const period = normalizePeriod(match[4] ?? '') ?? inferPricePeriod(context)
    facts.push({
      kind: 'price',
      amount: Number(match[2]?.replace(',', '.')),
      currency: normalizeCurrency(match[1] ?? match[3] ?? '$'),
      period,
      label: extractNearbyLabel(text, match.index ?? 0),
      context,
      localContext,
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

function extractStructuredPricingOffersFromCandidate(candidate: RetrievalCandidate): StructuredPricingOffer[] {
  const persisted = readStructuredPricingOffers(candidate.structuredFacts, candidate.id).map((offer) => enrichOfferWithCandidateMetadata(offer, candidate))
  const derived = extractStructuredPricingOffers(candidate.chunkText, candidate.id).map((offer) => enrichOfferWithCandidateMetadata(offer, candidate))
  const bySignature = new Map<string, StructuredPricingOffer>()
  for (const offer of [...persisted, ...derived]) {
    const signature = [
      normalizeEntityKey(offer.entity ?? offer.source_text.slice(0, 80)),
      offer.current_price ? `${offer.current_price.currency}:${roundCalculationNumber(offer.current_price.amount)}:${offer.current_price.period ?? ''}` : '',
      offer.original_price ? `${offer.original_price.currency}:${roundCalculationNumber(offer.original_price.amount)}:${offer.original_price.period ?? ''}` : '',
      Object.entries(offer.stored_period_totals).map(([period, value]) => `${period}:${value.currency}:${roundCalculationNumber(value.amount)}`).join('|'),
      offer.billing_totals.map((total) => `${total.currency}:${total.amount}:${total.duration_count}:${total.duration_unit}`).join('|'),
    ].join('|')
    const current = bySignature.get(signature)
    if (!current || offerCompletenessScore(offer) > offerCompletenessScore(current)) bySignature.set(signature, offer)
  }
  return [...bySignature.values()]
}

function enrichOfferWithCandidateMetadata(
  offer: StructuredPricingOffer,
  candidate: Pick<RetrievalCandidate, 'sourceUrl' | 'headingPath' | 'sourceTitle' | 'chunkText'>,
): StructuredPricingOffer {
  const headingPath = candidate.headingPath
    ? candidate.headingPath.split(/\s*>\s*/).map((part) => part.trim()).filter(Boolean)
    : offer.heading_path
  const categoryPath = headingPath.length > 0 ? headingPath : offer.category_path
  const metadataFamily = inferFamilyFromMetadata(categoryPath, candidate.sourceUrl, candidate.sourceTitle)
  const productFamily = metadataFamily && (!offer.product_family || entityContainsTerm(normalizeEntityKey(metadataFamily), normalizeEntityKey(offer.product_family)))
    ? metadataFamily
    : offer.product_family ?? metadataFamily
  return {
    ...offer,
    source_url: offer.source_url ?? candidate.sourceUrl,
    heading_path: headingPath,
    category_path: categoryPath,
    product_family: productFamily,
    source_text: [
      categoryPath.length > 0 ? `Heading path: ${categoryPath.join(' > ')}` : '',
      candidate.sourceUrl ? `URL: ${candidate.sourceUrl}` : '',
      offer.source_text,
    ].filter(Boolean).join('\n').slice(0, 1400),
    context_text: candidate.chunkText.slice(0, 2500),
  }
}

function inferFamilyFromMetadata(
  headingPath: readonly string[],
  sourceUrl: string | null,
  sourceTitle: string | null,
): string | null {
  const text = [headingPath.join(' '), sourceTitle, sourceUrl?.replace(/https?:\/\//i, '').replace(/[/?#].*$/, '')].filter(Boolean).join(' ')
  const terms = tokenize(text)
    .filter((term) => !OFFER_FAMILY_STOP_TERMS.has(term) && !isSpecEntityTerm(term))
  return terms.length > 0 ? [...new Set(terms)].slice(0, 6).join(' ') : null
}

function offerCompletenessScore(offer: StructuredPricingOffer): number {
  return [
    offer.current_price ? 10 : 0,
    offer.original_price ? 8 : 0,
    offer.discount_percent !== null ? 5 : 0,
    Object.keys(offer.stored_period_totals).length * 4,
    offer.billing_totals.length * 6,
    offer.product_family ? 3 : 0,
    Object.keys(offer.variant_specs).length * 2,
    offer.source_origin === 'persisted' ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0)
}

function readStructuredPricingOffers(facts: Record<string, unknown> | null, sourceChunkId: string): StructuredPricingOffer[] {
  const offers = Array.isArray(facts?.pricing_offers) ? facts.pricing_offers : []
  return offers
    .map((offer): StructuredPricingOffer | null => {
      if (!isRecord(offer)) return null
      const current = readStructuredPriceValue(offer.current_price)
      const original = readStructuredPriceValue(offer.original_price)
      const billingTotals = readStructuredBillingTotals(offer.billing_totals)
      const stored: Partial<Record<BillingPeriod, StructuredPriceValue>> = {}
      if (isRecord(offer.stored_period_totals)) {
        for (const period of ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const) {
          const value = readStructuredPriceValue(offer.stored_period_totals[period])
          if (value) stored[period] = value
        }
      }
      for (const total of billingTotals) {
        if (total.period && total.duration_count === 1 && !stored[total.period]) {
          stored[total.period] = {
            amount: total.amount,
            currency: total.currency,
            period: total.period,
            text: total.source_text,
          }
        }
      }
      if (!current && !original && Object.keys(stored).length === 0 && billingTotals.length === 0) return null
      const entity = typeof offer.entity === 'string' && offer.entity.trim()
        ? offer.entity.trim()
        : typeof offer.entity_name === 'string' && offer.entity_name.trim()
          ? offer.entity_name.trim()
          : null
      return {
        kind: 'pricing_offer',
        entity,
        entity_name: typeof offer.entity_name === 'string' && offer.entity_name.trim() ? offer.entity_name.trim() : entity,
        entity_type: readStructuredOfferEntityType(offer.entity_type),
        product_family: typeof offer.product_family === 'string' && offer.product_family.trim() ? offer.product_family.trim() : inferProductFamilyFromOffer(entity, typeof offer.source_text === 'string' ? offer.source_text : ''),
        category_path: Array.isArray(offer.category_path) ? offer.category_path.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).map((value) => value.trim()) : [],
        variant_specs: isRecord(offer.variant_specs) ? readStringRecord(offer.variant_specs) : {},
        current_price: current,
        original_price: original,
        discount_percent: typeof offer.discount_percent === 'number' && Number.isFinite(offer.discount_percent) ? offer.discount_percent : null,
        stored_period_totals: stored,
        billing_totals: billingTotals,
        source_url: typeof offer.source_url === 'string' && offer.source_url.trim() ? offer.source_url.trim() : null,
        heading_path: Array.isArray(offer.heading_path) ? offer.heading_path.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).map((value) => value.trim()) : [],
        source_excerpt: typeof offer.source_excerpt === 'string' ? offer.source_excerpt : typeof offer.source_text === 'string' ? offer.source_text.slice(0, 400) : '',
        confidence: readOfferConfidence(offer.confidence),
        source_origin: 'persisted',
        source_text: typeof offer.source_text === 'string' ? offer.source_text : '',
        context_text: typeof offer.source_text === 'string' ? offer.source_text : '',
        sourceChunkId,
      }
    })
    .filter((offer): offer is StructuredPricingOffer => Boolean(offer))
}

function readStructuredPriceValue(value: unknown): StructuredPriceValue | null {
  if (!isRecord(value)) return null
  const amount = typeof value.amount === 'number' ? value.amount : Number.NaN
  const currency = typeof value.currency === 'string' ? value.currency : ''
  const period = typeof value.period === 'string' ? normalizePeriod(value.period) : null
  const text = typeof value.text === 'string' ? value.text : ''
  if (period && isStandaloneDurationText(text)) return null
  return Number.isFinite(amount) ? { amount, currency, period, text } : null
}

function readStructuredBillingTotals(value: unknown): StructuredBillingTotal[] {
  if (!Array.isArray(value)) return []
  return value
    .map((total): StructuredBillingTotal | null => {
      if (!isRecord(total)) return null
      const amount = typeof total.amount === 'number' ? total.amount : Number.NaN
      const durationCount = typeof total.duration_count === 'number' ? total.duration_count : 1
      const durationUnit = readBillingDurationUnit(total.duration_unit)
      const currency = typeof total.currency === 'string' ? total.currency : ''
      if (!Number.isFinite(amount) || !Number.isFinite(durationCount) || durationCount <= 0 || !durationUnit) return null
      return {
        amount: roundCalculationNumber(amount),
        currency,
        duration_count: roundCalculationNumber(durationCount),
        duration_unit: durationUnit,
        label: typeof total.label === 'string' ? total.label : 'billing total',
        source_text: typeof total.source_text === 'string' ? total.source_text : '',
        period: durationUnitToBillingPeriod(durationUnit),
      }
    })
    .filter((total): total is StructuredBillingTotal => Boolean(total))
}

function readStructuredOfferEntityType(value: unknown): StructuredOfferEntityType {
  const allowed = new Set<StructuredOfferEntityType>(['product', 'service', 'plan', 'package', 'menu_item', 'course', 'treatment', 'appointment', 'subscription', 'membership', 'fee', 'unknown'])
  return typeof value === 'string' && allowed.has(value as StructuredOfferEntityType) ? value as StructuredOfferEntityType : 'unknown'
}

function readBillingDurationUnit(value: unknown): BillingDurationUnit | null {
  const normalized = typeof value === 'string' ? value.toLowerCase().replace(/s$/, '') : ''
  if (normalized === 'day' || normalized === 'week' || normalized === 'month' || normalized === 'quarter' || normalized === 'year' || normalized === 'session') return normalized
  return null
}

function readOfferConfidence(value: unknown): 'high' | 'medium' | 'low' {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'medium'
}

function readStringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && Boolean(entry[1].trim()))
      .map(([key, entryValue]) => [key, entryValue.trim()]),
  )
}

function extractStructuredPricingOffers(text: string, sourceChunkId = 'chunk'): StructuredPricingOffer[] {
  return splitPricingBlocks(text)
    .map((block) => buildStructuredPricingOffer(block, sourceChunkId))
    .filter((offer): offer is StructuredPricingOffer => Boolean(offer))
}

function splitPricingBlocks(text: string): string[] {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/(?!^)\s*(#{2,4}\s+)/g, '\n$1')
    .replace(/(\n\s*[-*]\s+Price:\s*)/gi, '\n$1')
  const headingBlocks = normalized
    .split(/\n(?=#{2,4}\s+)/)
    .map((block) => block.trim())
    .filter(Boolean)
  const blocks = headingBlocks.length > 1 ? headingBlocks : normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  return blocks.flatMap((block) => {
    const inlineOffers = splitInlinePricingOffers(block)
    if (inlineOffers.length > 1) return inlineOffers
    if (block.length <= 2200) return [block]
    return block
      .split(/(?=#{2,4}\s+)|(?=\b[A-Z][A-Za-z0-9&+().,\- ]{2,80}\b.{0,120}?(?:\$|USD|GBP|EUR|PKR|Rs\.?))/g)
      .map((part) => part.trim())
      .filter((part) => part.length >= 20)
  })
}

function splitInlinePricingOffers(block: string): string[] {
  const moneyCount = extractMoneyMatches(block).length
  if (moneyCount < 3 || block.length < 180) return [block]
  const rawParts = block
    .split(/(?=\b(?!Total\b|Price\b|Starting\b|From\b|Year\b|Monthly\b|Annual\b|Weekly\b|Daily\b|Quarterly\b|OFF\b|Discount\b|Save\b|CPU\b|Core\b|Cores\b|RAM\b|NVME\b|SSD\b|Storage\b|Traffic\b|Bandwidth\b|Backup\b|Guarantee\b)[A-Z][A-Za-z0-9&+().,'’\- ]{2,90}?\b(?:\s+[-–]\s+|\s+).{0,140}?(?:\$|USD|GBP|EUR|PKR|Rs\.?)\s*\d)/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8)
  const parts: string[] = []
  let prefix = ''
  for (const part of rawParts) {
    const combined = [prefix, part].filter(Boolean).join(' ').trim()
    if (containsPriceFact(part)) {
      parts.push(combined)
      prefix = ''
    } else {
      prefix = combined
    }
  }
  if (parts.length <= 1) return [block]
  return parts
}

function buildStructuredPricingOffer(block: string, sourceChunkId: string): StructuredPricingOffer | null {
  if (!containsPriceFact(block)) return null
  const money = extractMoneyMatches(block)
  const billingTotals = extractBillingTotals(block)
  if (money.length === 0 && billingTotals.length === 0) return null
  const discountPercent = extractDiscountPercent(block)
  const entity = extractPricingEntityName(block)
  const productFamily = inferProductFamilyFromOffer(entity, block)
  const headingPath = extractHeadingPathFromBlock(block)
  const stored: Partial<Record<BillingPeriod, StructuredPriceValue>> = {}
  for (const total of billingTotals) {
    if (total.period && total.duration_count === 1) {
      stored[total.period] = {
        amount: total.amount,
        currency: total.currency,
        period: total.period,
        text: total.source_text,
      }
    }
  }
  for (const match of money) {
    const period = match.period ?? inferPricePeriod(match.localContext)
    const billingTotal = findBillingTotalForMoney(match, billingTotals)
    if (billingTotal?.duration_count && billingTotal.duration_count > 1) continue
    if (match.isTotal && period && !billingTotal) {
      stored[period] = toStructuredPriceValue({ ...match, period })
    }
  }

  const nonTotals = money.filter((match) => !match.isTotal && !findBillingTotalForMoney(match, billingTotals))
  const pair = findDiscountPricePair(nonTotals, discountPercent)
  const roleBasedCurrent = nonTotals.find((match) => isCurrentPriceContext(match.localContext))
  const roleBasedOriginal = nonTotals.find((match) => isOriginalPriceContext(match.localContext))
  const fallbackCurrent = discountPercent !== null && roleBasedOriginal ? null : nonTotals.find((match) => match.period) ?? nonTotals[0] ?? null
  const current = pair?.current ?? roleBasedCurrent ?? fallbackCurrent
  const original = pair?.original ?? roleBasedOriginal ?? null
  const currentValue = current ? toStructuredPriceValue(current) : null
  const originalValue = original && (!current || roundCalculationNumber(original.amount) !== roundCalculationNumber(current.amount))
    ? toStructuredPriceValue(original)
    : null
  if (!currentValue && !originalValue && Object.keys(stored).length === 0 && billingTotals.length === 0) return null
  return {
    kind: 'pricing_offer',
    entity,
    entity_name: entity,
    entity_type: inferOfferEntityType(entity, block),
    product_family: productFamily,
    category_path: headingPath,
    variant_specs: extractVariantSpecs(block),
    current_price: currentValue,
    original_price: originalValue,
    discount_percent: discountPercent,
    stored_period_totals: stored,
    billing_totals: billingTotals,
    source_url: extractSourceUrlFromBlock(block),
    heading_path: headingPath,
    source_excerpt: block.slice(0, 400),
    confidence: currentValue || Object.keys(stored).length > 0 || billingTotals.length > 0 ? 'high' : 'low',
    source_origin: 'runtime',
    source_text: block.slice(0, 1200),
    context_text: block.slice(0, 1200),
    sourceChunkId,
  }
}

function extractBillingTotals(text: string): StructuredBillingTotal[] {
  const totals: StructuredBillingTotal[] = []
  const currencyAmount = String.raw`(?:(USD|PKR|EUR|GBP|AED|SAR|Rs\.?|₹|\$|€|£)\s*)?(\d+(?:[.,]\d+)?)(?:\s*(USD|PKR|EUR|GBP|AED|SAR))?`
  const duration = String.raw`(?:(\d+(?:[.,]\d+)?)\s*)?(days?|weeks?|months?|quarters?|years?|sessions?)`
  const patterns = [
    new RegExp(`${currencyAmount}\\s*(?:billed|charged|invoiced|paid)\\s*(?:per|every|for)\\s*${duration}`, 'gi'),
    new RegExp(`(?:total|billing total|package total|fee|price)\\s*:?\\s*${currencyAmount}\\s*(?:per|every|for|billed\\s*(?:per|every|for))\\s*${duration}`, 'gi'),
    new RegExp(`${currencyAmount}\\s*for\\s*${duration}`, 'gi'),
  ]

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const currency = normalizeCurrency(match[1] ?? match[3] ?? '$')
      const amount = Number((match[2] ?? '').replace(',', '.'))
      const durationCount = Number((match[4] ?? '1').replace(',', '.'))
      const unit = readBillingDurationUnit(match[5])
      if (!Number.isFinite(amount) || !Number.isFinite(durationCount) || durationCount <= 0 || !unit) continue
      const sourceText = (match[0] ?? '').replace(/\s+/g, ' ').trim()
      totals.push({
        amount: roundCalculationNumber(amount),
        currency,
        duration_count: roundCalculationNumber(durationCount),
        duration_unit: unit,
        label: buildBillingTotalLabel(unit, durationCount),
        source_text: sourceText,
        period: durationUnitToBillingPeriod(unit),
      })
    }
  }

  const bySignature = new Map<string, StructuredBillingTotal>()
  for (const total of totals) {
    const signature = `${total.currency}:${total.amount}:${total.duration_count}:${total.duration_unit}`
    if (!bySignature.has(signature)) bySignature.set(signature, total)
  }
  return [...bySignature.values()]
}

function buildBillingTotalLabel(unit: BillingDurationUnit, count: number): string {
  return `${count === 1 ? '' : `${count} `}${unit}${count === 1 ? '' : 's'} billing total`.trim()
}

function durationUnitToBillingPeriod(unit: BillingDurationUnit): BillingPeriod | null {
  if (unit === 'day') return 'daily'
  if (unit === 'week') return 'weekly'
  if (unit === 'month') return 'monthly'
  if (unit === 'quarter') return 'quarterly'
  if (unit === 'year') return 'yearly'
  return null
}

function findBillingTotalForMoney(match: MoneyMatch, totals: readonly StructuredBillingTotal[]): StructuredBillingTotal | null {
  const normalizedAmount = roundCalculationNumber(match.amount)
  return totals.find((total) =>
    total.currency === match.currency &&
    roundCalculationNumber(total.amount) === normalizedAmount &&
    total.source_text.toLowerCase().includes(match.text.toLowerCase().replace(/\s+/g, ' ').trim()),
  ) ?? null
}

function inferOfferEntityType(entity: string | null, block: string): StructuredOfferEntityType {
  const text = `${entity ?? ''}\n${block}`.toLowerCase()
  if (/\b(menu|dish|meal|combo|drink|pizza|burger|pasta)\b/.test(text)) return 'menu_item'
  if (/\b(course|class|program|lesson|training|bootcamp)\b/.test(text)) return 'course'
  if (/\b(treatment|therapy|procedure|doctor|clinic)\b/.test(text)) return 'treatment'
  if (/\b(appointment|booking|consultation)\b/.test(text)) return 'appointment'
  if (/\b(subscription|membership)\b/.test(text)) return text.includes('membership') ? 'membership' : 'subscription'
  if (/\b(plan|tier)\b/.test(text) || (entity && tokenize(entity).some((term) => GENERIC_PLAN_NAMES.has(term)))) return 'plan'
  if (/\b(package|bundle)\b/.test(text)) return 'package'
  if (/\b(service|setup|installation|audit)\b/.test(text)) return 'service'
  if (/\b(fee|charge|rate)\b/.test(text)) return 'fee'
  if (/\b(product|sku|variant|shipping|delivery)\b/.test(text)) return 'product'
  return 'unknown'
}

function inferProductFamilyFromOffer(entity: string | null, block: string): string | null {
  const entityTerms = tokenize(entity ?? '')
    .filter((term) => !OFFER_FAMILY_STOP_TERMS.has(term) && !isSpecEntityTerm(term) && !/^x?\d+$/.test(term))
  if (entityTerms.length > 0) return entityTerms.join(' ')

  const heading = block
    .split(/\n+/)
    .map((line) => line.replace(/^#{2,4}\s+/, '').trim())
    .find((line) => line && !containsPriceFact(line))
  const headingTerms = tokenize(heading ?? '')
    .filter((term) => !OFFER_FAMILY_STOP_TERMS.has(term) && !isSpecEntityTerm(term))
  if (headingTerms.length > 0) return headingTerms.slice(0, 6).join(' ')
  const contentTerms = tokenize(block)
    .filter((term) => !OFFER_FAMILY_STOP_TERMS.has(term) && !isSpecEntityTerm(term) && !/^\d+(?:\.\d+)?$/.test(term))
  return contentTerms.length > 0 ? [...new Set(contentTerms)].slice(0, 4).join(' ') : null
}

function extractVariantSpecs(block: string): Record<string, string> {
  const specs: Record<string, string> = {}
  for (const spec of extractSpecClaims(block)) {
    if (/\bgb|tb|mb\b/i.test(spec)) specs.memory_or_storage = spec
    else if (/\bcore|cpu\b/i.test(spec)) specs.cpu = spec
    else specs[normalizeEntityKey(spec).replace(/\s+/g, '_') || `spec_${Object.keys(specs).length + 1}`] = spec
  }
  return specs
}

function extractHeadingPathFromBlock(block: string): string[] {
  return block
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^#{2,4}\s+/.test(line))
    .map((line) => line.replace(/^#{2,4}\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 6)
}

function extractSourceUrlFromBlock(block: string): string | null {
  const match = block.match(/\b(?:URL|Source URL|Page URL)\s*:\s*(https?:\/\/[^\s)]+)|\bhttps?:\/\/[^\s)]+/i)
  return (match?.[1] ?? match?.[0] ?? '').replace(/^URL\s*:\s*/i, '').trim() || null
}

function extractMoneyMatches(text: string): MoneyMatch[] {
  const matches: MoneyMatch[] = []
  const pattern = /(?:(USD|PKR|EUR|GBP|AED|SAR|Rs\.?|₹|\$|€|£)\s*)?(\d+(?:[.,]\d+)?)(?:\s*(USD|PKR|EUR|GBP|AED|SAR))?(?:\s*\/?\s*(monthly|month|mo|yearly|year|annual|annually|weekly|week|daily|day|quarterly|quarter))?/gi
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    const before = text.slice(Math.max(0, index - 45), index)
    const after = text.slice(index + match[0].length, index + match[0].length + 55)
    const localContext = `${before}${match[0]}${after}`.toLowerCase()
    const hasCurrency = Boolean(match[1] || match[3])
    const hasPeriod = Boolean(match[4])
    if (!hasCurrency && !hasPeriod) continue
    if (!hasCurrency && isBillingDurationCountMatch(before, match[0], after)) continue
    if (!hasCurrency && isSpecQuantityMatch(before, match[0], after)) continue
    if (!hasCurrency && !hasExplicitNonCurrencyPriceContext(before, match[0], after)) continue
    const amount = Number(match[2]?.replace(',', '.'))
    if (!Number.isFinite(amount)) continue
    matches.push({
      amount,
      currency: normalizeCurrency(match[1] ?? match[3] ?? '$'),
      period: normalizePeriod(match[4] ?? '') ?? inferPricePeriod(localContext),
      text: match[0],
      index,
      localContext,
      isTotal: /\b(total|billed|invoice|charged|due)\b/i.test(before),
    })
  }
  return matches
}

function isStandaloneDurationText(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return /^\d+(?:[.,]\d+)?\s*(?:days?|weeks?|months?|quarters?|years?|sessions?)$/.test(normalized)
}

function hasExplicitNonCurrencyPriceContext(before: string, value: string, after: string): boolean {
  if (/[/$€£]/.test(value)) return true
  const context = `${before.slice(-80)}${value}${after.slice(0, 80)}`.toLowerCase()
  if (isStandaloneDurationText(value) && !/\b(price|cost|fee|rate|starting|from|now|was|regular|original|current|total|billed|charged|invoice|per)\b/.test(context)) {
    return false
  }
  return /\b(price|cost|fee|rate|starting\s+at|starts?\s+at|from|now|was|regular|original|current|total|billed|charged|invoice|per)\b/.test(context)
}

function isSpecQuantityMatch(before: string, value: string, after: string): boolean {
  const amount = value.match(/\d+(?:[.,]\d+)?/)?.[0]
  if (!amount) return false
  const compactContext = `${before}${value}${after}`.toLowerCase().replace(/\s+/g, '')
  const escaped = escapeRegex(amount.replace(',', '.')).replace(/\\\./g, '[.,]')
  return new RegExp(`${escaped}(?:gb|tb|mb|kb|gbram|ram|memory|nvme|ssd|storage|core|cores|cpu|users?|seats?|sessions?|hours?|days?|weeks?|months?|years?)`).test(compactContext)
}

function isBillingDurationCountMatch(before: string, value: string, after: string): boolean {
  const context = `${before}${value}${after}`.toLowerCase()
  return /\b(?:billed|charged|invoiced|paid|per|every|for)\s+\d+(?:[.,]\d+)?\s*(?:days?|weeks?|months?|quarters?|years?|sessions?)\b/.test(context) &&
    /(?:\$|rs\.?|pkr|usd|eur|gbp|aed|sar|₹|€|£)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:usd|pkr|eur|gbp|aed|sar)/i.test(before)
}

function extractDiscountPercent(text: string): number | null {
  for (const match of text.matchAll(/(\d+(?:[.,]\d+)?)\s*%\s*(?:off|discount|save|saving|promo|offer)?|(?:off|discount|save|saving)\s*(\d+(?:[.,]\d+)?)\s*%/gi)) {
    const value = Number((match[1] ?? match[2] ?? '').replace(',', '.'))
    if (Number.isFinite(value) && value > 0 && value < 100) return value
  }
  return null
}

function findDiscountPricePair(matches: readonly MoneyMatch[], discountPercent: number | null): { readonly current: MoneyMatch; readonly original: MoneyMatch } | null {
  if (matches.length < 2) return null
  const candidates: Array<{ readonly current: MoneyMatch; readonly original: MoneyMatch; readonly score: number }> = []
  for (let index = 0; index < matches.length - 1; index += 1) {
    for (let nextIndex = index + 1; nextIndex < matches.length; nextIndex += 1) {
      const left = matches[index]
      const right = matches[nextIndex]
      if (!left || !right) continue
      if (left.currency && right.currency && left.currency !== right.currency) continue
      if (Math.abs(left.index - right.index) > 120) continue
      const combined = `${left.localContext} ${right.localContext}`
      const hasDiscountSignal = discountPercent !== null || /\b(discount|off|save|saving|promo|offer|deal|sale|was|now|regular|original)\b/i.test(combined)
      if (!hasDiscountSignal) continue
      if (roundCalculationNumber(left.amount) === roundCalculationNumber(right.amount)) continue
      const current = left.amount < right.amount ? left : right
      const original = left.amount > right.amount ? left : right
      let score = 0
      if (discountPercent !== null) score += 50
      if (isCurrentPriceContext(current.localContext)) score += 30
      if (isOriginalPriceContext(original.localContext)) score += 30
      if (current.index < original.index) score += 5
      candidates.push({ current, original, score })
    }
  }
  return candidates.sort((left, right) => right.score - left.score)[0] ?? null
}

function toStructuredPriceValue(match: MoneyMatch): StructuredPriceValue {
  return {
    amount: roundCalculationNumber(match.amount),
    currency: match.currency,
    period: match.period,
    text: match.text,
  }
}

function extractPricingEntityName(block: string): string | null {
  const lines = block.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const heading = lines.find((line) => /^#{2,4}\s+/.test(line))
  const raw = (heading ?? lines[0] ?? '')
    .replace(/^#{2,4}\s+/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  const withoutPriceOnly = raw.replace(/^(?:\$|USD|GBP|EUR|PKR|Rs\.?)\s*\d+(?:[.,]\d+)?(?:\s*[-–]\s*)?/i, '').trim()
  const beforeFirstMoney = withoutPriceOnly
    .split(/(?:\$|USD|GBP|EUR|PKR|Rs\.?)\s*\d+(?:[.,]\d+)?/i)[0]
    ?.replace(/\b(?:price|cost|fee|rate)\s*:?\s*$/i, '')
    .trim()
  const candidate = (beforeFirstMoney && beforeFirstMoney.length >= 3 ? beforeFirstMoney : withoutPriceOnly || raw)
    .slice(0, 160)
    .trim()
  if (!candidate || !/[A-Za-z]/.test(candidate)) return null
  return candidate
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
  const structuredConflictIds = detectStructuredOfferConflicts(candidates)
  const candidatesWithoutDiscountOffers = candidates.filter((candidate) =>
    !extractStructuredPricingOffersFromCandidate(candidate).some((offer) => offer.original_price || offer.discount_percent !== null),
  )
  const prices = candidatesWithoutDiscountOffers.flatMap((candidate) => extractNumericFactsFromCandidate(candidate).filter((fact): fact is ExtractedPriceFact => fact.kind === 'price'))
  const byLabel = new Map<string, ExtractedPriceFact[]>()
  for (const price of prices) {
    const label = normalizeConflictLabel(price.label)
    if (!label) continue
    const key = `${label}:${price.currency}:${price.period ?? ''}`.toLowerCase()
    byLabel.set(key, [...(byLabel.get(key) ?? []), price])
  }
  const conflicting = new Set<string>()
  structuredConflictIds.forEach((id) => conflicting.add(id))
  for (const group of byLabel.values()) {
    if (new Set(group.map((fact) => fact.amount)).size > 1) {
      group.forEach((fact) => conflicting.add(fact.sourceChunkId))
    }
  }
  return conflicting
}

function detectStructuredOfferConflicts(candidates: readonly RetrievalCandidate[]): Set<string> {
  const byEntity = new Map<string, StructuredPricingOffer[]>()
  for (const candidate of candidates) {
    for (const offer of extractStructuredPricingOffersFromCandidate(candidate)) {
      if (!offer.current_price || offer.original_price || offer.discount_percent !== null) continue
      const entity = normalizeConflictLabel(offer.entity)
      if (!entity) continue
      const key = `${entity}:${offer.current_price.currency}:${offer.current_price.period ?? ''}`.toLowerCase()
      byEntity.set(key, [...(byEntity.get(key) ?? []), offer])
    }
  }
  const conflicts = new Set<string>()
  for (const offers of byEntity.values()) {
    if (new Set(offers.map((offer) => roundCalculationNumber(offer.current_price?.amount ?? 0))).size > 1) {
      offers.forEach((offer) => conflicts.add(offer.sourceChunkId))
    }
  }
  return conflicts
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

function normalizeEntityKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/(?:\$|rs\.?|pkr|usd|eur|gbp)\s*\d+(?:[.,]\d+)?/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

  if (analysis.intents.pricing || analysis.intents.productOrService) {
    const offers = candidates.flatMap((candidate) => extractStructuredPricingOffersFromCandidate(candidate))
    if (analysis.offerScope.answerMode === 'category_pricing_list') {
      const matchingOffers = selectCategoryPricingOffers(analysis, offers).slice(0, 10)
      if (matchingOffers.length > 0) {
        lines.push(`Answer mode: broad category/listing. Keep every price attached to its own offer; do not merge prices across offers.`)
        lines.push(`Requested family/category: ${analysis.offerScope.requestedFamily ?? 'general pricing'}`)
        lines.push(`Matching offers found: ${matchingOffers.map(formatOfferGuidanceSummary).join(' | ')}`)
      }
    }
    const offer = analysis.offerScope.answerMode === 'category_pricing_list'
      ? null
      : selectStructuredPricingOffer(analysis, offers) ?? selectScopedStructuredPricingOfferFallback(analysis, offers)
    if (offer) {
      const currentPrice = offer.current_price ? withInferredStructuredPricePeriod(offer.current_price, offer) : null
      const originalPrice = offer.original_price ? withInferredStructuredPricePeriod(offer.original_price, offer) : null
      lines.push(`Selected requested offer/entity: ${offer.entity ?? 'matched offer'}`)
      if (offer.product_family) lines.push(`Selected offer family/category: ${offer.product_family}`)
      if (currentPrice) lines.push(`Selected offer current/effective price: ${formatStructuredPriceValue(currentPrice)}`)
      if (originalPrice) lines.push(`Selected offer original/regular price: ${formatStructuredPriceValue(originalPrice)}`)
      if (offer.discount_percent !== null) lines.push(`Selected offer discount percent: ${offer.discount_percent}%`)
      const totals = Object.entries(offer.stored_period_totals)
        .map(([period, value]) => `${period}: ${formatStructuredPriceValue(value)}`)
        .join(', ')
      if (totals) lines.push(`Selected offer stored billing totals: ${totals}`)
      if (offer.billing_totals.length > 0) {
        lines.push(`Selected offer billing duration totals: ${offer.billing_totals.map((total) => `${formatStructuredBillingTotal(total)} (${total.source_text})`).join(', ')}`)
      }
      lines.push('For a single requested item, answer only from the selected offer/entity facts above and do not mix prices, specs, or totals from neighboring offers.')
    }
  }

  return lines.length > 0
    ? `Derived fact guidance from selected source evidence:\n${lines.map((line) => `- ${line}`).join('\n')}`
    : null
}

function formatStructuredPriceValue(value: StructuredPriceValue): string {
  return `${value.currency ? `${value.currency} ` : ''}${value.amount}${value.period ? `/${value.period}` : ''}`
}

function formatStructuredBillingTotal(total: StructuredBillingTotal): string {
  return `${total.currency ? `${total.currency} ` : ''}${total.amount} per ${formatDurationCount(total.duration_count, total.duration_unit)}`
}

function selectCategoryPricingOffers(
  analysis: RetrievalQuestionAnalysis,
  offers: readonly StructuredPricingOffer[],
): StructuredPricingOffer[] {
  const scoped = analysis.offerScope.requestedFamily
    ? offers.filter((offer) => scoreOfferFamilyMatch(analysis.offerScope.requestedFamily, offer) > 0)
    : [...offers]
  const withPrice = scoped.filter((offer) => offer.current_price || offer.original_price || Object.keys(offer.stored_period_totals).length > 0 || offer.billing_totals.length > 0)
  const byName = new Map<string, StructuredPricingOffer>()
  for (const offer of withPrice) {
    const key = normalizeEntityKey(offer.entity ?? offer.entity_name ?? offer.source_text.slice(0, 80))
    if (!key) continue
    const current = byName.get(key)
    if (!current || offerCompletenessScore(offer) > offerCompletenessScore(current)) byName.set(key, offer)
  }
  return [...byName.values()]
}

function formatOfferGuidanceSummary(offer: StructuredPricingOffer): string {
  const currentPrice = offer.current_price ? withInferredStructuredPricePeriod(offer.current_price, offer) : null
  const originalPrice = offer.original_price ? withInferredStructuredPricePeriod(offer.original_price, offer) : null
  const parts = [
    offer.entity ?? offer.entity_name ?? offer.product_family ?? 'Offer',
    currentPrice ? `current ${formatStructuredPriceValue(currentPrice)}` : null,
    originalPrice ? `original ${formatStructuredPriceValue(originalPrice)}` : null,
    offer.discount_percent !== null ? `${offer.discount_percent}% off` : null,
    offer.billing_totals.length > 0 ? `billing ${offer.billing_totals.map(formatStructuredBillingTotal).join(', ')}` : null,
  ].filter(Boolean)
  return parts.join(' - ')
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

function buildSelectedOfferDebug(
  analysis: RetrievalQuestionAnalysis,
  candidates: readonly RetrievalCandidate[],
): HybridRetrievalResult['debug']['selectedOffer'] {
  const offers = candidates.flatMap((candidate) => extractStructuredPricingOffersFromCandidate(candidate))
  const offer = selectStructuredPricingOffer(analysis, offers) ?? selectScopedStructuredPricingOfferFallback(analysis, offers)
  if (!offer) return null
  const currentPrice = offer.current_price ? withInferredStructuredPricePeriod(offer.current_price, offer) : null
  const originalPrice = offer.original_price ? withInferredStructuredPricePeriod(offer.original_price, offer) : null
  return {
    entity: offer.entity,
    productFamily: offer.product_family,
    currentPrice,
    originalPrice,
    billingTotals: offer.billing_totals,
    sourceOrigin: offer.source_origin,
    sourceChunkId: offer.sourceChunkId,
  }
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
    pricing_offers: extractStructuredPricingOffers(text).map((offer) => ({
      kind: offer.kind,
      entity: offer.entity,
      entity_name: offer.entity_name,
      entity_type: offer.entity_type,
      product_family: offer.product_family,
      category_path: offer.category_path,
      variant_specs: offer.variant_specs,
      current_price: offer.current_price,
      original_price: offer.original_price,
      discount_percent: offer.discount_percent,
      stored_period_totals: offer.stored_period_totals,
      billing_totals: offer.billing_totals,
      source_url: offer.source_url,
      heading_path: offer.heading_path,
      source_excerpt: offer.source_excerpt,
      confidence: offer.confidence,
      source_text: offer.source_text,
    })),
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
  const ignoredAcronyms = new Set(['USD', 'PKR', 'EUR', 'GBP', 'AED', 'SAR'])
  return [
    ...answer.matchAll(/\b[A-Z]{2,}[A-Z0-9-]*\b/g),
    ...answer.matchAll(/\+?\d[\d\s().-]{7,}\d/g),
    ...answer.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
    ...answer.matchAll(/https?:\/\/[^\s)]+/gi),
    ...answer.matchAll(/(?:\$|Rs\.?|PKR|USD|EUR|GBP)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:USD|PKR|EUR|GBP)/gi),
    ...answer.matchAll(/\b(?:\d{4}-\d{2}-\d{2}|[A-Z][a-z]{2,9}\s+\d{1,2},?\s+\d{4})\b/g),
  ].map((match) => match[0]).filter((claim) => !ignoredAcronyms.has(claim))
}

function extractCanonicalExactFacts(value: string): string[] {
  const facts = new Set<string>()
  for (const match of value.matchAll(/(?:https?:\/\/)?wa\.me\/(\d+)|tel:\s*(\+?\d[\d\s().-]{7,}\d)|\+?\d[\d\s().-]{7,}\d/gi)) {
    const raw = match[1] ?? match[2] ?? match[0]
    const digits = raw.replace(/\D/g, '')
    if (digits.length >= 8) facts.add(`phone:${digits}`)
  }
  for (const match of value.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    facts.add(`email:${match[0].toLowerCase()}`)
  }
  for (const match of value.matchAll(/https?:\/\/[^\s)]+|(?:https?:\/\/)?wa\.me\/\d+/gi)) {
    facts.add(`url:${canonicalUrl(match[0])}`)
  }
  for (const match of value.matchAll(/(?:(USD|PKR|EUR|GBP|AED|SAR|Rs\.?|₹|\$|€|£)\s*)?(\d+(?:[.,]\d+)?)(?:\s*(USD|PKR|EUR|GBP|AED|SAR))?/gi)) {
    const hasCurrency = Boolean(match[1] || match[3])
    if (!hasCurrency) continue
    const amount = Number((match[2] ?? '').replace(',', '.'))
    if (Number.isFinite(amount)) facts.add(`money:${normalizeCurrency(match[1] ?? match[3] ?? '$')}:${roundCalculationNumber(amount)}`)
  }
  for (const match of value.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    facts.add(`date:${match[1]}-${match[2]}-${match[3]}`)
  }
  for (const match of value.matchAll(/\b([A-Z][a-z]{2,9})\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
    const month = monthNumber(match[1] ?? '')
    const day = String(match[2] ?? '').padStart(2, '0')
    if (month) facts.add(`date:${match[3]}-${month}-${day}`)
  }
  return [...facts]
}

function extractPhoneNumberFragments(value: string): Set<string> {
  const fragments = new Set<string>()
  for (const match of value.matchAll(/(?:https?:\/\/)?wa\.me\/(\d+)|tel:\s*(\+?\d[\d\s().-]{7,}\d)|\+?\d[\d\s().-]{7,}\d/gi)) {
    const raw = match[1] ?? match[2] ?? match[0]
    const digits = raw.replace(/\D/g, '')
    if (digits.length < 8) continue
    fragments.add(normalizeNumberString(digits))
    for (const part of raw.matchAll(/\d+(?:[.,]\d+)?/g)) fragments.add(normalizeNumberString(part[0]))
  }
  return fragments
}

function isMoneyClaimTraceable(claim: string, evidence: string, calculation?: CalculationResult | null): boolean {
  const match = claim.match(/(?:(USD|PKR|EUR|GBP|AED|SAR|Rs\.?|₹|\$|€|£)\s*)?(\d+(?:[.,]\d+)?)(?:\s*(USD|PKR|EUR|GBP|AED|SAR))?/i)
  if (!match || !(match[1] || match[3])) return false
  const amount = Number((match[2] ?? '').replace(',', '.'))
  if (!Number.isFinite(amount)) return false
  if (calculation?.status === 'computed' && calculation.value !== null && roundCalculationNumber(calculation.value) === roundCalculationNumber(amount)) return true
  return isTraceableDerivedNumber(amount, evidence)
}

function validateSingleEntityFactConsistency(args: {
  readonly question: string
  readonly answer: string
  readonly evidence: readonly string[]
  readonly calculation?: CalculationResult | null
}): string | null {
  const analysis = analyzeRetrievalQuestion(args.question)
  if ((!analysis.intents.pricing && !analysis.intents.productOrService) || analysis.entityTerms.length === 0) return null
  if (analysis.offerScope.answerMode === 'category_pricing_list' || analysis.offerScope.answerMode === 'comparison') return null
  if (analysis.offerScope.answerMode === 'contact_location_hours' || analysis.offerScope.answerMode === 'policy_or_terms') {
    if (!extractMoneyMatches(args.answer).length) return null
  }
  const evidenceText = args.evidence.join('\n')
  const offers = extractStructuredPricingOffers(evidenceText, 'answer-evidence')
  if (offers.length === 0) return null
  const targetOffer = selectStructuredPricingOffer(analysis, offers) ?? selectScopedStructuredPricingOfferFallback(analysis, offers)
  if (!targetOffer) return null
  const targetText = [targetOffer.entity, targetOffer.source_text].filter(Boolean).join('\n')
  const allowedMoney = new Set<number>()
  if (targetOffer.current_price) allowedMoney.add(roundCalculationNumber(targetOffer.current_price.amount))
  if (targetOffer.original_price) allowedMoney.add(roundCalculationNumber(targetOffer.original_price.amount))
  for (const value of Object.values(targetOffer.stored_period_totals)) allowedMoney.add(roundCalculationNumber(value.amount))
  for (const value of targetOffer.billing_totals) allowedMoney.add(roundCalculationNumber(value.amount))
  if (args.calculation?.status === 'computed' && args.calculation.value !== null) allowedMoney.add(roundCalculationNumber(args.calculation.value))

  for (const money of extractMoneyMatches(args.answer)) {
    const amount = roundCalculationNumber(money.amount)
    if (allowedMoney.has(amount)) continue
    if (args.calculation?.status === 'computed' && args.calculation.value !== null && amount === roundCalculationNumber(args.calculation.value)) continue
    if (isTraceableFromStructuredOffer(amount, targetOffer)) continue
    return 'cross_entity_fact_mix'
  }

  const targetSpecs = extractSpecClaims(targetText)
  const questionSpecs = extractSpecClaims(args.question)
  const compactTargetText = targetText.replace(/\s+/g, '').toLowerCase()
  const compactEvidenceText = evidenceText.replace(/\s+/g, '').toLowerCase()
  for (const spec of extractSpecClaims(args.answer)) {
    if (targetSpecs.has(spec)) continue
    if (compactTargetText.includes(spec.replace(/\s+/g, '').toLowerCase())) continue
    if (targetContainsSpecNumberAndEvidenceContainsUnit(compactTargetText, compactEvidenceText, spec)) continue
    if (questionSpecs.has(spec) && compactTargetText.includes(spec.replace(/\s+/g, '').toLowerCase())) continue
    return 'cross_entity_fact_mix'
  }
  return null
}

function targetContainsSpecNumberAndEvidenceContainsUnit(
  compactTargetText: string,
  compactEvidenceText: string,
  spec: string,
): boolean {
  const number = spec.match(/^\d+(?:\.\d+)?/)?.[0]
  const unit = spec.replace(/^\d+(?:\.\d+)?/, '')
  if (!number || !unit) return false
  return compactTargetText.includes(number) && compactEvidenceText.includes(unit)
}

function isTraceableFromStructuredOffer(amount: number, offer: StructuredPricingOffer): boolean {
  const seedNumbers = [
    offer.current_price?.amount,
    offer.original_price?.amount,
    offer.discount_percent ?? undefined,
    ...Object.values(offer.stored_period_totals).map((value) => value.amount),
    ...offer.billing_totals.map((value) => value.amount),
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const target = roundCalculationNumber(amount)
  for (const seed of seedNumbers) {
    for (const factor of [2, 3, 4, 7, 12, 30, 52, 365]) {
      if (roundCalculationNumber(seed * factor) === target || roundCalculationNumber(seed / factor) === target) return true
    }
  }
  if (offer.original_price && offer.discount_percent !== null) {
    const discounted = offer.original_price.amount * (1 - offer.discount_percent / 100)
    if (roundCalculationNumber(discounted) === target) return true
    if (roundCalculationNumber(discounted * 12) === target) return true
  }
  return false
}

function extractSpecClaims(value: string): Set<string> {
  const specs = new Set<string>()
  for (const match of value.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:gb|tb|mb)\s*(?:ram|memory|nvme|ssd|storage)?\b|\b\d+(?:[.,]\d+)?\s*(?:core|cores|cpu)\b/gi)) {
    const normalized = match[0]
      .toLowerCase()
      .replace(',', '.')
      .replace(/\s+/g, '')
      .replace(/memory/g, 'ram')
      .replace(/cores/g, 'core')
      .replace(/cpu/g, 'core')
      .trim()
    if (normalized) specs.add(normalized)
  }
  return specs
}

function canonicalUrl(value: string): string {
  const cleaned = value.trim().replace(/[),.;!?]+$/g, '')
  const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`
  try {
    const parsed = new URL(withProtocol)
    parsed.hash = ''
    const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/'
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${normalizedPath}${parsed.search}`.replace(/\/$/, '')
  } catch {
    return value.toLowerCase().replace(/\/+$/, '')
  }
}

function monthNumber(value: string): string | null {
  const months: Record<string, string> = {
    jan: '01',
    january: '01',
    feb: '02',
    february: '02',
    mar: '03',
    march: '03',
    apr: '04',
    april: '04',
    may: '05',
    jun: '06',
    june: '06',
    jul: '07',
    july: '07',
    aug: '08',
    august: '08',
    sep: '09',
    sept: '09',
    september: '09',
    oct: '10',
    october: '10',
    nov: '11',
    november: '11',
    dec: '12',
    december: '12',
  }
  return months[value.toLowerCase()] ?? null
}

function extractNumberStrings(value: string): string[] {
  return [...value.matchAll(/\b\d+(?:[.,]\d+)?\b/g)].map((match) => match[0])
}

function isTraceableDerivedNumber(target: number, evidence: string): boolean {
  if (!Number.isFinite(target)) return false
  const numbers = extractNumberStrings(evidence)
    .map((value) => Number(normalizeNumberString(value)))
    .filter((value) => Number.isFinite(value))
    .slice(0, 80)
  const roundedTarget = roundCalculationNumber(target)
  const derived = new Set<number>()
  const add = (value: number) => {
    if (Number.isFinite(value) && value >= 0 && value < 1_000_000_000) derived.add(roundCalculationNumber(value))
  }
  for (const number of numbers) {
    for (const factor of [2, 3, 4, 7, 12, 30, 52, 365]) {
      add(number * factor)
      add(number / factor)
    }
  }
  for (const left of numbers) {
    for (const right of numbers) {
      if (left === right) continue
      add(left + right)
      add(Math.abs(left - right))
      add(left * right)
      if (right !== 0) add(left / right)
      if (left !== 0) add(right / left)
      if (right >= 0 && right <= 100) {
        const discounted = left * (1 - right / 100)
        const markedUp = left * (1 + right / 100)
        add(discounted)
        add(markedUp)
        for (const factor of [4, 12, 52, 365]) {
          add(discounted * factor)
          add(discounted / factor)
          add(markedUp * factor)
          add(markedUp / factor)
        }
      }
    }
  }
  return derived.has(roundedTarget)
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
