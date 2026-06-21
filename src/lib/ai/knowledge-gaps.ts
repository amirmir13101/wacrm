import type { SupabaseClient } from '@supabase/supabase-js'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import {
  failureCategoryFromReason,
  suggestedActionForFailure,
  type AiFailureCategory,
  type SafeProviderError,
} from '@/lib/ai/provider-errors'

export interface KnowledgeGapLog {
  readonly workspaceId: string
  readonly question: string
  readonly originalQuestion?: string | null
  readonly detectedLanguage?: string | null
  readonly fallbackReason: string
  readonly retrievalScore?: number | null
  readonly chunkCountRetrieved?: number
  readonly embeddingUsed?: boolean
  readonly channel?: string | null
  readonly conversationId?: string | null
  readonly contactId?: string | null
  readonly failureCategory?: AiFailureCategory | null
  readonly technicalReason?: string | null
  readonly providerError?: SafeProviderError | null
  readonly selectedChunkIds?: readonly string[]
  readonly selectedSourceIds?: readonly string[]
  readonly selectedSourceTitles?: readonly string[]
  readonly retrievalDebug?: Record<string, unknown> | null
  readonly guardrailReason?: string | null
  readonly handoffTriggered?: boolean
  readonly suggestedAction?: string | null
}

export interface KnowledgeGapRow {
  readonly question: string
  readonly fallback_reason: string
  readonly retrieval_score: number | string | null
  readonly created_at: string
  readonly detected_language?: string | null
  readonly channel?: string | null
  readonly failure_category?: string | null
  readonly technical_reason?: string | null
  readonly provider_status?: number | null
  readonly provider_error_code?: string | null
  readonly provider_error_type?: string | null
  readonly provider_error_message?: string | null
  readonly selected_source_titles?: string[] | null
  readonly guardrail_reason?: string | null
  readonly handoff_triggered?: boolean | null
  readonly suggested_action?: string | null
  readonly resolved_at?: string | null
}

export interface GroupedKnowledgeGap {
  readonly question: string
  readonly count: number
  readonly fallback_reason: string
  readonly last_asked: string
  readonly retrieval_score: number | null
  readonly channel: string | null
  readonly failure_category: string
  readonly technical_reason: string | null
  readonly provider_status: number | null
  readonly provider_error_code: string | null
  readonly provider_error_type: string | null
  readonly provider_error_message: string | null
  readonly selected_source_titles: readonly string[]
  readonly guardrail_reason: string | null
  readonly handoff_triggered: boolean
  readonly suggested_action: string
  readonly resolved_at: string | null
  readonly is_stale: boolean
}

export function sanitizeKnowledgeGapQuestion(question: string): string {
  return question
    .trim()
    .slice(0, 1_000)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[phone removed]')
}

export async function logKnowledgeGap(
  args: KnowledgeGapLog,
  client?: SupabaseClient,
): Promise<void> {
  const question = sanitizeKnowledgeGapQuestion(args.question)
  if (!question) return
  const providerError = args.providerError ?? null
  const failureCategory = args.failureCategory ?? providerError?.category ?? failureCategoryFromReason(args.fallbackReason)
  const suggestedAction = args.suggestedAction ?? suggestedActionForFailure(failureCategory)
  const { error } = await (client ?? supabaseAdmin())
    .from('ai_knowledge_gaps')
    .insert({
      workspace_id: args.workspaceId,
      question,
      original_question: args.originalQuestion ? sanitizeKnowledgeGapQuestion(args.originalQuestion) : null,
      detected_language: normalizeLanguageCode(args.detectedLanguage),
      fallback_reason: args.fallbackReason.slice(0, 160),
      retrieval_score: Number.isFinite(args.retrievalScore) ? args.retrievalScore : null,
      chunk_count_retrieved: Math.max(0, Math.floor(args.chunkCountRetrieved ?? 0)),
      embedding_used: Boolean(args.embeddingUsed),
      channel: normalizeText(args.channel, 40),
      conversation_id: normalizeUuid(args.conversationId),
      contact_id: normalizeUuid(args.contactId),
      failure_category: failureCategory,
      technical_reason: normalizeText(args.technicalReason ?? args.fallbackReason, 200),
      provider_name: normalizeText(providerError?.provider, 80),
      provider_model: normalizeText(providerError?.model, 160),
      provider_status: providerError?.status ?? null,
      provider_error_code: normalizeText(providerError?.errorCode, 120),
      provider_error_type: normalizeText(providerError?.errorType, 120),
      provider_error_message: normalizeText(providerError?.errorMessage ?? providerError?.adminMessage, 500),
      selected_chunk_ids: normalizeUuidArray(args.selectedChunkIds),
      selected_source_ids: normalizeUuidArray(args.selectedSourceIds),
      selected_source_titles: normalizeTextArray(args.selectedSourceTitles, 120, 10),
      retrieval_debug: args.retrievalDebug ?? {},
      guardrail_reason: normalizeText(args.guardrailReason, 200),
      handoff_triggered: Boolean(args.handoffTriggered),
      suggested_action: normalizeText(suggestedAction, 240),
    })
  if (error && error.code !== '42P01') {
    console.warn('[ai-chatbot] failed to log knowledge gap', {
      workspaceId: args.workspaceId,
      reason: error.code ?? 'unknown_error',
    })
  }
}

export function buildLanguageBreakdown(rows: readonly KnowledgeGapRow[]): Array<{ readonly code: string; readonly name: string; readonly count: number }> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const code = normalizeLanguageCode(row.detected_language)
    if (!code) continue
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, name: languageName(code), count }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code))
}

export function groupKnowledgeGaps(rows: readonly KnowledgeGapRow[]): GroupedKnowledgeGap[] {
  const grouped = new Map<string, GroupedKnowledgeGap>()
  for (const row of rows) {
    const failureCategory = normalizeFailureCategory(row.failure_category, row.fallback_reason)
    const key = `${row.question}::${failureCategory}::${row.channel ?? 'unknown'}`
    const current = grouped.get(key)
    if (current) {
      grouped.set(key, { ...current, count: current.count + 1 })
      continue
    }
    const score = row.retrieval_score === null ? null : Number(row.retrieval_score)
    grouped.set(key, {
      question: row.question,
      count: 1,
      fallback_reason: row.fallback_reason,
      last_asked: row.created_at,
      retrieval_score: Number.isFinite(score) ? score : null,
      channel: row.channel ?? null,
      failure_category: failureCategory,
      technical_reason: row.technical_reason ?? null,
      provider_status: row.provider_status ?? null,
      provider_error_code: row.provider_error_code ?? null,
      provider_error_type: row.provider_error_type ?? null,
      provider_error_message: row.provider_error_message ?? null,
      selected_source_titles: Array.isArray(row.selected_source_titles) ? row.selected_source_titles : [],
      guardrail_reason: row.guardrail_reason ?? null,
      handoff_triggered: Boolean(row.handoff_triggered),
      suggested_action: row.suggested_action ?? suggestedActionForFailure(failureCategory),
      resolved_at: row.resolved_at ?? null,
      is_stale: Boolean(row.resolved_at),
    })
  }
  return [...grouped.values()]
}

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
  return normalized || null
}

function normalizeTextArray(value: readonly string[] | undefined, maxLength: number, maxItems: number): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => normalizeText(item, maxLength)).filter((item): item is string => Boolean(item)).slice(0, maxItems)
}

function normalizeUuid(value: string | null | undefined): string | null {
  if (!value) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null
}

function normalizeUuidArray(value: readonly string[] | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => normalizeUuid(item)).slice(0, 20)
}

function normalizeLanguageCode(value: string | null | undefined): string | null {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[^a-z-]/g, '')
  return normalized || null
}

function normalizeFailureCategory(value: string | null | undefined, fallbackReason: string): AiFailureCategory {
  const allowed: readonly AiFailureCategory[] = [
    'provider_error',
    'provider_rate_limited',
    'provider_quota_or_billing',
    'provider_invalid_key',
    'provider_invalid_model',
    'missing_knowledge',
    'weak_retrieval',
    'guardrail_blocked',
    'cross_entity_fact_mix',
    'calculation_unsupported',
    'cooldown',
    'human_requested',
    'ai_disabled',
    'unsupported_message_type',
    'webhook_or_send_failure',
    'unknown_error',
  ]
  return allowed.includes(value as AiFailureCategory) ? value as AiFailureCategory : failureCategoryFromReason(fallbackReason)
}

function languageName(code: string): string {
  const names: Record<string, string> = {
    ar: 'Arabic',
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    ur: 'Urdu',
  }
  return names[code] ?? code.toUpperCase()
}
