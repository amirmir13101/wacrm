import { supabaseAdmin } from '@/lib/automations/admin-client'

export type KnowledgeActivityStatus = 'answered' | 'fallback' | 'provider_error' | 'failed'
export type KnowledgeGapReason = 'missing_knowledge' | 'weak_context' | 'fallback' | 'provider_error' | 'failed'

const lowInformationMessages = new Set([
  'hello',
  'hi',
  'hey',
  'thanks',
  'thank you',
  'ok',
  'okay',
  'bye',
  'goodbye',
])

export function normalizeKnowledgeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function shouldCreateKnowledgeGap(args: {
  readonly question: string
  readonly status: KnowledgeActivityStatus
  readonly retrievedSourceCount: number
  readonly handoff: boolean
}): boolean {
  const normalized = normalizeKnowledgeQuestion(args.question).replace(/[!?.,]+$/g, '')
  if (!normalized || lowInformationMessages.has(normalized)) return false
  if (args.handoff) return false
  if (args.status === 'provider_error' || args.status === 'failed') return true
  return args.status === 'answered' && args.retrievedSourceCount === 0
}

export function knowledgeGapReason(args: {
  readonly status: KnowledgeActivityStatus
  readonly retrievedSourceCount: number
}): KnowledgeGapReason {
  if (args.status === 'provider_error') return 'provider_error'
  if (args.status === 'failed') return 'failed'
  if (args.status === 'fallback') return 'fallback'
  return args.retrievedSourceCount === 0 ? 'weak_context' : 'missing_knowledge'
}

export async function recordKnowledgeActivity(args: {
  readonly workspaceId: string
  readonly conversationId?: string | null
  readonly messageId?: string | null
  readonly channel: 'dashboard' | 'whatsapp'
  readonly question: string
  readonly answer?: string | null
  readonly status: KnowledgeActivityStatus
  readonly fallbackReason?: string | null
  readonly provider?: string | null
  readonly chatModel?: string | null
  readonly embeddingModel?: string | null
  readonly retrievedSourceCount: number
  readonly latencyMs?: number | null
  readonly handoff?: boolean
}): Promise<void> {
  const question = args.question.trim()
  if (!question) return

  const createGap = shouldCreateKnowledgeGap({
    question,
    status: args.status,
    retrievedSourceCount: args.retrievedSourceCount,
    handoff: args.handoff === true,
  })

  try {
    const { error } = await supabaseAdmin().rpc('record_knowledge_activity', {
      p_workspace_id: args.workspaceId,
      p_conversation_id: args.conversationId ?? null,
      p_message_id: args.messageId ?? null,
      p_channel: args.channel,
      p_user_question: question,
      p_answer: args.answer?.trim() || null,
      p_status: args.status,
      p_fallback_reason: args.fallbackReason ?? null,
      p_provider: args.provider ?? null,
      p_chat_model: args.chatModel ?? null,
      p_embedding_model: args.embeddingModel ?? null,
      p_retrieved_source_count: Math.max(0, Math.floor(args.retrievedSourceCount)),
      p_latency_ms: args.latencyMs ?? null,
      p_create_gap: createGap,
      p_gap_reason: createGap
        ? knowledgeGapReason({
          status: args.status,
          retrievedSourceCount: args.retrievedSourceCount,
        })
        : null,
    })

    if (error) console.error('[knowledge activity] record failed:', error)
  } catch (error) {
    console.error('[knowledge activity] record threw:', error)
  }
}
