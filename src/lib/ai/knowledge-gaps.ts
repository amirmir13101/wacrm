import type { SupabaseClient } from '@supabase/supabase-js'

import { supabaseAdmin } from '@/lib/automations/admin-client'

export interface KnowledgeGapLog {
  readonly workspaceId: string
  readonly question: string
  readonly originalQuestion?: string | null
  readonly detectedLanguage?: string | null
  readonly fallbackReason: string
  readonly retrievalScore?: number | null
  readonly chunkCountRetrieved?: number
  readonly embeddingUsed?: boolean
}

export interface KnowledgeGapRow {
  readonly question: string
  readonly fallback_reason: string
  readonly retrieval_score: number | string | null
  readonly created_at: string
  readonly detected_language?: string | null
}

export interface GroupedKnowledgeGap {
  readonly question: string
  readonly count: number
  readonly fallback_reason: string
  readonly last_asked: string
  readonly retrieval_score: number | null
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
    const current = grouped.get(row.question)
    if (current) {
      grouped.set(row.question, { ...current, count: current.count + 1 })
      continue
    }
    const score = row.retrieval_score === null ? null : Number(row.retrieval_score)
    grouped.set(row.question, {
      question: row.question,
      count: 1,
      fallback_reason: row.fallback_reason,
      last_asked: row.created_at,
      retrieval_score: Number.isFinite(score) ? score : null,
    })
  }
  return [...grouped.values()]
}

function normalizeLanguageCode(value: string | null | undefined): string | null {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[^a-z-]/g, '')
  return normalized || null
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
