import type { SupabaseClient } from '@supabase/supabase-js'

import { supabaseAdmin } from '@/lib/automations/admin-client'

export type AiConversationStatus = 'ai_active' | 'ai_paused' | 'needs_human'

export interface AiConversationControl {
  readonly id?: string
  readonly workspace_id: string
  readonly conversation_id: string
  readonly status: AiConversationStatus
  readonly paused_at?: string | null
  readonly paused_by?: string | null
  readonly handoff_reason?: string | null
  readonly last_skipped_reason?: string | null
  readonly last_skipped_at?: string | null
  readonly last_ai_reply_at?: string | null
  readonly last_ai_response?: string | null
  readonly created_at?: string
  readonly updated_at?: string
}

export const AI_COOLDOWN_SECONDS = Number(process.env.AI_CHATBOT_COOLDOWN_SECONDS ?? 45)
export const AI_DAILY_REPLY_LIMIT = Number(process.env.AI_CHATBOT_DAILY_REPLY_LIMIT ?? 200)
export const AI_HUMAN_REPLY_PAUSE_SECONDS = Number(
  process.env.AI_CHATBOT_HUMAN_REPLY_PAUSE_SECONDS ?? 300,
)

export function humanizeAiSkipReason(reason?: string | null): string {
  const reasons: Record<string, string> = {
    ai_provider_error: 'AI did not reply because the provider returned an error.',
    ai_provider_exception: 'AI did not reply because the provider request failed.',
    ai_provider_missing: 'AI did not reply because no AI provider API key is configured.',
    answer_not_found: 'AI replied with the fallback because it could not find a safe answer in your knowledge base.',
    chatbot_disabled: 'AI did not reply because the chatbot is disabled.',
    conversation_ai_paused: 'AI did not reply because AI is paused for this conversation.',
    conversation_assigned_to_human: 'AI did not reply because this conversation is assigned to a human agent.',
    conversation_needs_human: 'AI did not reply because this conversation is waiting for a human agent.',
    conversation_closed: 'AI did not reply because this conversation is closed.',
    daily_reply_limit_reached: 'AI did not reply because the workspace daily auto-reply limit was reached.',
    duplicate_inbound_message: 'AI did not reply because this inbound message was already processed.',
    human_reply_lookup_failed: 'AI did not reply because it could not verify recent human replies safely.',
    human_replied_recently: 'AI did not reply because a human agent replied recently.',
    human_handoff_requested: 'Customer asked to speak with a human.',
    knowledge_empty: 'AI did not reply because no active knowledge has been added yet.',
    no_relevant_knowledge: 'AI replied with the fallback because no matching knowledge was found.',
    opt_out_message: 'AI did not reply because the customer sent an opt-out message.',
    plan_not_active_pro: 'AI did not reply because this workspace does not have active hosted Pro AI access.',
    provider_not_configured: 'AI did not reply because the AI provider is not configured.',
    rapid_reply_cooldown: 'AI cooldown blocking is disabled; this reason is kept only for older logs.',
    same_response_repeated: 'AI is ready to answer repeated customer questions again.',
    settings_missing: 'AI did not reply because chatbot settings are missing.',
    whatsapp_config_missing: 'AI did not reply because WhatsApp configuration is missing.',
    whatsapp_send_failed: 'AI generated a response but WhatsApp sending failed.',
  }
  if (!reason) return 'No AI skip reason has been recorded yet.'
  return reasons[reason] ?? `AI did not reply: ${reason.replace(/_/g, ' ')}.`
}

export async function getAiConversationControl(args: {
  readonly workspaceId: string
  readonly conversationId: string
  readonly client?: SupabaseClient
}): Promise<AiConversationControl | null> {
  const admin = args.client ?? supabaseAdmin()
  const { data, error } = await admin
    .from('ai_conversation_controls')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .eq('conversation_id', args.conversationId)
    .maybeSingle()

  if (error) {
    console.error('[ai-chatbot] control lookup failed:', error.message)
    return null
  }
  return (data as AiConversationControl | null) ?? null
}

export async function upsertAiConversationControl(args: {
  readonly workspaceId: string
  readonly conversationId: string
  readonly status: AiConversationStatus
  readonly actorUserId?: string | null
  readonly handoffReason?: string | null
  readonly lastSkippedReason?: string | null
  readonly lastAiReplyAt?: string | null
  readonly lastAiResponse?: string | null
  readonly client?: SupabaseClient
}): Promise<AiConversationControl | null> {
  const now = new Date().toISOString()
  const admin = args.client ?? supabaseAdmin()
  const existing = await getAiConversationControl({
    workspaceId: args.workspaceId,
    conversationId: args.conversationId,
    client: admin,
  })
  const row = {
    workspace_id: args.workspaceId,
    conversation_id: args.conversationId,
    status: args.status,
    paused_at: args.status === 'ai_active' ? null : now,
    paused_by: args.status === 'ai_active' ? null : (args.actorUserId ?? null),
    handoff_reason: args.status === 'needs_human' ? (args.handoffReason ?? args.lastSkippedReason ?? null) : null,
    last_skipped_reason: args.lastSkippedReason ?? existing?.last_skipped_reason ?? null,
    last_skipped_at: args.lastSkippedReason ? now : existing?.last_skipped_at ?? null,
    last_ai_reply_at: args.lastAiReplyAt ?? existing?.last_ai_reply_at ?? null,
    last_ai_response: args.lastAiResponse ?? existing?.last_ai_response ?? null,
  }

  const { data, error } = await admin
    .from('ai_conversation_controls')
    .upsert(row, { onConflict: 'workspace_id,conversation_id' })
    .select('*')
    .single()

  if (error) {
    console.error('[ai-chatbot] control upsert failed:', error.message)
    return null
  }
  return data as AiConversationControl
}

export async function recordAiSkippedReason(args: {
  readonly workspaceId: string
  readonly conversationId: string
  readonly reason: string
  readonly status?: AiConversationStatus
  readonly client?: SupabaseClient
}): Promise<void> {
  await upsertAiConversationControl({
    workspaceId: args.workspaceId,
    conversationId: args.conversationId,
    status: args.status ?? 'ai_active',
    lastSkippedReason: args.reason,
    handoffReason: args.reason,
    client: args.client,
  })
}

export async function recordAiReply(args: {
  readonly workspaceId: string
  readonly conversationId: string
  readonly response: string
  readonly client?: SupabaseClient
}): Promise<void> {
  const existing = await getAiConversationControl(args)
  await upsertAiConversationControl({
    workspaceId: args.workspaceId,
    conversationId: args.conversationId,
    status: existing?.status ?? 'ai_active',
    lastAiReplyAt: new Date().toISOString(),
    lastAiResponse: args.response,
    client: args.client,
  })
}

export function isInCooldown(lastReplyAt?: string | null, seconds = AI_COOLDOWN_SECONDS): boolean {
  if (!lastReplyAt) return false
  const last = new Date(lastReplyAt).getTime()
  if (!Number.isFinite(last)) return false
  return Date.now() - last < seconds * 1000
}

export function isSimilarAiResponse(previous?: string | null, next?: string | null): boolean {
  if (!previous || !next) return false
  return normalizeResponse(previous) === normalizeResponse(next)
}

function normalizeResponse(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}
