import { NextResponse } from 'next/server'

import {
  getAiConversationControl,
  humanizeAiSkipReason,
  upsertAiConversationControl,
  type AiConversationStatus,
} from '@/lib/ai/conversation-controls'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

const STATUSES = new Set<AiConversationStatus>(['ai_active', 'ai_paused', 'needs_human'])

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'view_inbox')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }

  const { id } = await context.params
  const conversation = await findWorkspaceConversation(workspace.workspaceId, id)
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const control = await getAiConversationControl({
    workspaceId: workspace.workspaceId,
    conversationId: id,
  })

  return NextResponse.json({
    control: control ?? {
      workspace_id: workspace.workspaceId,
      conversation_id: id,
      status: 'ai_active',
      last_skipped_reason: null,
      last_skipped_at: null,
      handoff_reason: null,
    },
    lastSkippedMessage: humanizeAiSkipReason(control?.last_skipped_reason),
    canManage: hasWorkspacePermission(workspace, 'manage_ai_chatbot'),
  })
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage AI for conversations' }, { status: 403 })
  }

  const { id } = await context.params
  const conversation = await findWorkspaceConversation(workspace.workspaceId, id)
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const status = typeof body.status === 'string' && STATUSES.has(body.status as AiConversationStatus)
    ? (body.status as AiConversationStatus)
    : null
  if (!status) {
    return NextResponse.json({ error: 'Valid AI conversation status is required.' }, { status: 400 })
  }

  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null
  const control = await upsertAiConversationControl({
    workspaceId: workspace.workspaceId,
    conversationId: id,
    status,
    actorUserId: workspace.userId,
    handoffReason: reason,
    lastSkippedReason: status === 'needs_human' ? 'manual_handoff' : null,
  })

  if (!control) {
    return NextResponse.json({ error: 'Failed to update AI conversation status.' }, { status: 500 })
  }

  return NextResponse.json({
    control,
    lastSkippedMessage: humanizeAiSkipReason(control.last_skipped_reason),
  })
}

async function findWorkspaceConversation(workspaceId: string, conversationId: string) {
  const { data, error } = await supabaseAdmin()
    .from('conversations')
    .select('id, workspace_id')
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    console.error('[ai-chatbot] conversation control lookup failed:', error.message)
    return null
  }
  return data
}
