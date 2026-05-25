import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { canAssignConversation } from '@/lib/team/assignment'
import { listWorkspaceMembers, requireCurrentWorkspace } from '@/lib/team/server'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { hasWorkspacePermission } from '@/lib/team/permissions'

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    )
  }

  const body = await request.json().catch(() => ({}))
  const targetType = body.target_type
  const targetId = typeof body.target_id === 'string' ? body.target_id : ''
  const assignedToUserId =
    typeof body.assigned_to_user_id === 'string' && body.assigned_to_user_id
      ? body.assigned_to_user_id
      : null
  const assignedToProfileId =
    typeof body.assigned_to_profile_id === 'string' && body.assigned_to_profile_id
      ? body.assigned_to_profile_id
      : null
  const note = typeof body.note === 'string' ? body.note : null
  const reason = typeof body.reason === 'string' ? body.reason : 'manual'

  if (!targetId || !['conversation', 'deal'].includes(targetType)) {
    return NextResponse.json({ error: 'Invalid assignment target' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const workspace = workspaceResult.workspace
  const permissionSubject = {
    role: workspace.role,
    permissions: workspace.permissions,
    can_connect_own_whatsapp: workspace.canConnectOwnWhatsApp,
  }
  const members = await listWorkspaceMembers(workspace.workspaceId)
  const activeUserIds = new Set(
    members.filter((member) => member.status === 'active').map((member) => member.user_id),
  )

  if (assignedToUserId && !activeUserIds.has(assignedToUserId)) {
    return NextResponse.json({ error: 'Assignee is not an active workspace member' }, { status: 400 })
  }

  if (targetType === 'conversation') {
    const { data: conversation, error: fetchError } = await admin
      .from('conversations')
      .select('id, user_id, contact_id, assigned_agent_id, workspace_id')
      .eq('id', targetId)
      .eq('workspace_id', workspace.workspaceId)
      .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

    if (
      !canAssignConversation({
        role: workspace.role,
        permissions: workspace.permissions,
        actorUserId: workspace.userId,
        currentAssignedUserId: conversation.assigned_agent_id,
        nextAssignedUserId: assignedToUserId,
      })
    ) {
      return NextResponse.json({ error: 'You cannot assign this conversation' }, { status: 403 })
    }

    const { error } = await admin
      .from('conversations')
      .update({ assigned_agent_id: assignedToUserId, updated_at: new Date().toISOString() })
      .eq('id', targetId)
      .eq('workspace_id', workspace.workspaceId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await admin.from('assignment_history').insert({
      workspace_id: workspace.workspaceId,
      conversation_id: targetId,
      assigned_from_user_id: conversation.assigned_agent_id,
      assigned_to_user_id: assignedToUserId,
      assigned_by_user_id: workspace.userId,
      reason,
      note,
    })

    if (assignedToUserId) {
      runAutomationsForTrigger({
        userId: conversation.user_id,
        triggerType: 'conversation_assigned',
        contactId: conversation.contact_id,
        context: {
          conversation_id: targetId,
          agent_id: assignedToUserId,
        },
      }).catch((err) => console.error('[team/assign] automation dispatch failed:', err))
    }

    return NextResponse.json({ success: true, assigned_to_user_id: assignedToUserId })
  }

  const { data: deal, error: dealError } = await admin
    .from('deals')
    .select('id, assigned_to, workspace_id')
    .eq('id', targetId)
    .eq('workspace_id', workspace.workspaceId)
    .maybeSingle()

  if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  if (
    !hasWorkspacePermission(permissionSubject, 'assign_deals') &&
    assignedToProfileId !== null
  ) {
    return NextResponse.json({ error: 'Only managers can assign deals' }, { status: 403 })
  }

  const nextProfileId = assignedToProfileId
  let nextUserId = assignedToUserId
  if (nextProfileId) {
    const member = members.find((item) => item.profile_id === nextProfileId)
    if (!member || member.status !== 'active') {
      return NextResponse.json({ error: 'Assignee is not an active workspace member' }, { status: 400 })
    }
    nextUserId = member.user_id
  }

  const { data: previousProfile } = deal.assigned_to
    ? await admin
        .from('profiles')
        .select('user_id')
        .eq('id', deal.assigned_to)
        .maybeSingle()
    : { data: null }

  const { error } = await admin
    .from('deals')
    .update({ assigned_to: nextProfileId, updated_at: new Date().toISOString() })
    .eq('id', targetId)
    .eq('workspace_id', workspace.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('assignment_history').insert({
    workspace_id: workspace.workspaceId,
    deal_id: targetId,
    assigned_from_user_id: previousProfile?.user_id ?? null,
    assigned_to_user_id: nextUserId,
    assigned_by_user_id: workspace.userId,
    reason,
    note,
  })

  return NextResponse.json({
    success: true,
    assigned_to_profile_id: nextProfileId,
    assigned_to_user_id: nextUserId,
  })
}
