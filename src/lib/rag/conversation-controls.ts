import { supabaseAdmin } from '@/lib/automations/admin-client'

export type RagHumanRequestStatus = 'none' | 'requested' | 'accepted' | 'rejected'
export type RagConversationControlAction =
  | 'request_human'
  | 'accept_human'
  | 'reject_human'
  | 'ai_active'
  | 'ai_pause'
  | 'await_human_confirmation'
  | 'clear_human_confirmation'

export interface RagConversationControl {
  readonly workspaceId: string
  readonly conversationId: string
  readonly humanRequestStatus: RagHumanRequestStatus
  readonly waitingForHumanConfirmation: boolean
  readonly aiPaused: boolean
  readonly lastReason: string | null
}

interface RagConversationControlRow {
  readonly workspace_id: string
  readonly conversation_id: string
  readonly human_request_status: RagHumanRequestStatus
  readonly waiting_for_human_confirmation: boolean
  readonly ai_paused: boolean
  readonly last_reason: string | null
}

function mapControl(row: RagConversationControlRow): RagConversationControl {
  return {
    workspaceId: row.workspace_id,
    conversationId: row.conversation_id,
    humanRequestStatus: row.human_request_status,
    waitingForHumanConfirmation: row.waiting_for_human_confirmation,
    aiPaused: row.ai_paused,
    lastReason: row.last_reason,
  }
}

async function assertConversationInWorkspace(args: {
  readonly workspaceId: string
  readonly conversationId: string
}): Promise<void> {
  const { data, error } = await supabaseAdmin()
    .from('conversations')
    .select('id')
    .eq('id', args.conversationId)
    .eq('workspace_id', args.workspaceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.id) throw new Error('Conversation not found for workspace.')
}

export async function getRagConversationControl(args: {
  readonly workspaceId: string
  readonly conversationId: string
}): Promise<RagConversationControl | null> {
  const { data, error } = await supabaseAdmin()
    .from('rag_conversation_controls')
    .select('workspace_id, conversation_id, human_request_status, waiting_for_human_confirmation, ai_paused, last_reason')
    .eq('workspace_id', args.workspaceId)
    .eq('conversation_id', args.conversationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapControl(data as RagConversationControlRow) : null
}

export async function upsertRagConversationControl(args: {
  readonly workspaceId: string
  readonly conversationId: string
  readonly action: RagConversationControlAction
  readonly reason?: string | null
}): Promise<RagConversationControl> {
  await assertConversationInWorkspace(args)

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    workspace_id: args.workspaceId,
    conversation_id: args.conversationId,
    updated_at: now,
    last_reason: args.reason ?? null,
  }

  if (args.action === 'request_human') {
    patch.human_request_status = 'requested'
    patch.waiting_for_human_confirmation = false
    patch.ai_paused = false
    patch.requested_at = now
    patch.accepted_at = null
    patch.rejected_at = null
  } else if (args.action === 'accept_human') {
    patch.human_request_status = 'accepted'
    patch.waiting_for_human_confirmation = false
    patch.ai_paused = true
    patch.accepted_at = now
  } else if (args.action === 'reject_human') {
    patch.human_request_status = 'rejected'
    patch.waiting_for_human_confirmation = false
    patch.ai_paused = false
    patch.rejected_at = now
  } else if (args.action === 'ai_active') {
    patch.human_request_status = 'none'
    patch.waiting_for_human_confirmation = false
    patch.ai_paused = false
    patch.ai_resumed_at = now
  } else if (args.action === 'ai_pause') {
    patch.waiting_for_human_confirmation = false
    patch.ai_paused = true
  } else if (args.action === 'await_human_confirmation') {
    patch.waiting_for_human_confirmation = true
    patch.ai_paused = false
  } else if (args.action === 'clear_human_confirmation') {
    patch.waiting_for_human_confirmation = false
    patch.ai_paused = false
  }

  const { data, error } = await supabaseAdmin()
    .from('rag_conversation_controls')
    .upsert(patch, { onConflict: 'workspace_id,conversation_id' })
    .select('workspace_id, conversation_id, human_request_status, waiting_for_human_confirmation, ai_paused, last_reason')
    .single()

  if (error) throw new Error(error.message)
  return mapControl(data as RagConversationControlRow)
}

export async function isRagConversationAiPaused(args: {
  readonly workspaceId: string
  readonly conversationId: string
}): Promise<boolean> {
  const control = await getRagConversationControl(args)
  return control?.aiPaused === true || control?.humanRequestStatus === 'accepted'
}
