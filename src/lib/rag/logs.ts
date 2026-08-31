import { supabaseAdmin } from '@/lib/automations/admin-client'

export type RagLogChannelFilter = 'all' | 'dashboard' | 'whatsapp'
export type RagLogStatusFilter = 'all' | 'answered' | 'fallback' | 'provider_error' | 'failed'

export interface RagChatLogItem {
  readonly id: string
  readonly createdAt: string
  readonly channel: 'dashboard' | 'whatsapp'
  readonly userQuestion: string
  readonly answer: string | null
  readonly status: 'answered' | 'fallback' | 'provider_error' | 'failed'
  readonly fallbackReason: string | null
  readonly latencyMs: number | null
  readonly retrievedSourceCount: number
  readonly retrievalConfidence: number | null
  readonly conversationId: string | null
}

interface RagChatLogRow {
  readonly id: string
  readonly created_at: string
  readonly channel: string
  readonly user_question: string
  readonly answer: string | null
  readonly status: string
  readonly fallback_reason: string | null
  readonly latency_ms: number | null
  readonly retrieved_chunk_ids: string[] | null
  readonly retrieved_source_count: number | null
  readonly retrieval_scores: unknown
  readonly conversation_id: string | null
}

function retrievalConfidence(value: unknown): number | null {
  if (!Array.isArray(value)) return null
  const scores = value
    .map((item) => {
      if (typeof item === 'number') return item
      if (!item || typeof item !== 'object') return null
      const score = (item as { score?: unknown }).score
      return typeof score === 'number' ? score : null
    })
    .filter((score): score is number => score !== null && Number.isFinite(score))
  if (scores.length === 0) return null
  return Math.max(...scores)
}

function safeChannel(value: string): RagChatLogItem['channel'] {
  return value === 'whatsapp' ? 'whatsapp' : 'dashboard'
}

function safeStatus(value: string): RagChatLogItem['status'] {
  if (value === 'fallback' || value === 'provider_error' || value === 'failed') return value
  return 'answered'
}

function toLogItem(row: RagChatLogRow): RagChatLogItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    channel: safeChannel(row.channel),
    userQuestion: row.user_question,
    answer: row.answer,
    status: safeStatus(row.status),
    fallbackReason: row.fallback_reason,
    latencyMs: row.latency_ms,
    retrievedSourceCount: Array.isArray(row.retrieved_chunk_ids)
      ? Math.max(row.retrieved_chunk_ids.length, row.retrieved_source_count ?? 0)
      : row.retrieved_source_count ?? 0,
    retrievalConfidence: retrievalConfidence(row.retrieval_scores),
    conversationId: row.conversation_id,
  }
}

export async function listRagChatLogs(args: {
  readonly workspaceId: string
  readonly channel?: RagLogChannelFilter
  readonly status?: RagLogStatusFilter
  readonly limit?: number
}): Promise<ReadonlyArray<RagChatLogItem>> {
  const limit = Math.max(1, Math.min(args.limit ?? 25, 100))
  let query = supabaseAdmin()
    .from('rag_chat_logs')
    .select('id, created_at, channel, user_question, answer, status, fallback_reason, latency_ms, retrieved_chunk_ids, retrieved_source_count, retrieval_scores, conversation_id')
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (args.channel && args.channel !== 'all') query = query.eq('channel', args.channel)
  if (args.status && args.status !== 'all') query = query.eq('status', args.status)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as RagChatLogRow[]).map(toLogItem)
}
