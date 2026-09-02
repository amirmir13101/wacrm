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
        { error: 'You cannot delete conversations in this workspace' },
        { status: 403 },
      )
    }

    const { id: conversationId } = await context.params
    const admin = supabaseAdmin()
    const { data: conversation, error: conversationError } = await admin
      .from('conversations')
      .select('id, workspace_id, assigned_agent_id')
      .eq('id', conversationId)
      .maybeSingle()

    if (conversationError) {
      return NextResponse.json({ error: conversationError.message }, { status: 500 })
    }
    if (!conversation || conversation.workspace_id !== workspace.workspaceId) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
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
        { error: 'You cannot delete this conversation' },
        { status: 403 },
      )
    }

    const { data, error } = await admin.rpc('delete_inbox_conversation', {
      p_workspace_id: workspace.workspaceId,
      p_conversation_id: conversationId,
    })

    if (error) {
      console.error('[conversation-delete] database operation failed:', error.message)
      return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      deleted_conversation_id: result.deleted_conversation_id,
      preserved_contact_id: result.preserved_contact_id,
      contact_deleted: false,
      whatsapp_recalled: false,
    })
  } catch (error) {
    console.error('[conversation-delete] unexpected error:', error)
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }
}
