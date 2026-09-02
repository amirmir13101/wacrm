import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { canSeeConversation } from '@/lib/team/assignment'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const workspaceResult = await requireCurrentWorkspace()
    if (!workspaceResult.ok) {
      return NextResponse.json(
        { error: workspaceResult.error },
        { status: workspaceResult.status },
      )
    }

    const workspace = workspaceResult.workspace
    if (
      !hasWorkspacePermission(
        { role: workspace.role, permissions: workspace.permissions },
        'reply_to_conversations',
      )
    ) {
      return NextResponse.json(
        { error: 'You cannot delete messages in this workspace' },
        { status: 403 },
      )
    }

    const { id: messageId } = await context.params
    const admin = supabaseAdmin()
    const { data: message, error: messageError } = await admin
      .from('messages')
      .select('id, conversation_id')
      .eq('id', messageId)
      .maybeSingle()

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 })
    }
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const { data: conversation, error: conversationError } = await admin
      .from('conversations')
      .select('id, workspace_id, assigned_agent_id')
      .eq('id', message.conversation_id)
      .maybeSingle()

    if (conversationError) {
      return NextResponse.json({ error: conversationError.message }, { status: 500 })
    }
    if (!conversation || conversation.workspace_id !== workspace.workspaceId) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    if (
      !canSeeConversation({
        role: workspace.role,
        permissions: workspace.permissions,
        actorUserId: workspace.userId,
        assignedAgentId: conversation.assigned_agent_id,
      })
    ) {
      return NextResponse.json(
        { error: 'You cannot delete messages from this conversation' },
        { status: 403 },
      )
    }

    const { data, error } = await admin.rpc('delete_inbox_message', {
      p_workspace_id: workspace.workspaceId,
      p_message_id: messageId,
    })

    if (error) {
      console.error('[message-delete] database operation failed:', error.message)
      return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      deleted_message_id: result.deleted_message_id,
      conversation: {
        id: result.conversation_id,
        last_message_text: result.updated_last_message_text,
        last_message_at: result.updated_last_message_at,
      },
      whatsapp_recalled: false,
    })
  } catch (error) {
    console.error('[message-delete] unexpected error:', error)
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
  }
}
