import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { canManageTeamWithPermissions, defaultPermissionsForRole } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    )
  }
  if (!canManageTeamWithPermissions({
    role: workspaceResult.workspace.role,
    permissions: workspaceResult.workspace.permissions,
  })) {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const update: Record<string, unknown> = {}

  if (typeof body.role === 'string') {
    if (!['owner', 'admin', 'manager', 'agent'].includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (body.role === 'owner') {
      return NextResponse.json({ error: 'Owner role cannot be assigned here' }, { status: 400 })
    }
    update.role = body.role
    if (!body.permissions) update.permissions = defaultPermissionsForRole(body.role)
  }

  if (typeof body.status === 'string') {
    if (!['active', 'invited', 'suspended'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    update.status = body.status
  }

  if (body.permissions && typeof body.permissions === 'object') {
    update.permissions = body.permissions
  }

  if (typeof body.can_connect_own_whatsapp === 'boolean') {
    update.can_connect_own_whatsapp = body.can_connect_own_whatsapp
  }

  for (const key of ['contact_visibility', 'conversation_visibility', 'deal_visibility']) {
    if (typeof body[key] === 'string') update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin()
    .from('workspace_members')
    .select('role, user_id')
    .eq('id', id)
    .eq('workspace_id', workspaceResult.workspace.workspaceId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (existing.role === 'owner') {
    return NextResponse.json({ error: 'Workspace owner cannot be changed here' }, { status: 400 })
  }

  const { error } = await supabaseAdmin()
    .from('workspace_members')
    .update(update)
    .eq('id', id)
    .eq('workspace_id', workspaceResult.workspace.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    )
  }
  if (!canManageTeamWithPermissions({
    role: workspaceResult.workspace.role,
    permissions: workspaceResult.workspace.permissions,
  })) {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
  }

  const { id } = await params
  const admin = supabaseAdmin()
  const { data: existing, error: lookupError } = await admin
    .from('workspace_members')
    .select('id, role, user_id')
    .eq('id', id)
    .eq('workspace_id', workspaceResult.workspace.workspaceId)
    .maybeSingle()

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (existing.role === 'owner') {
    return NextResponse.json({ error: 'Workspace owner cannot be deleted here' }, { status: 400 })
  }
  if (existing.user_id === workspaceResult.workspace.userId) {
    return NextResponse.json({ error: 'You cannot delete your own account from Team' }, { status: 400 })
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, account_type')
    .eq('user_id', existing.user_id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (profile?.account_type !== 'team_member') {
    return NextResponse.json(
      { error: 'Only owner-created team member accounts can be permanently deleted here.' },
      { status: 400 },
    )
  }

  const [conversationCleanup, dealCleanup] = await Promise.all([
    admin
      .from('conversations')
      .update({ assigned_agent_id: null })
      .eq('workspace_id', workspaceResult.workspace.workspaceId)
      .eq('assigned_agent_id', existing.user_id),
    profile?.id
      ? admin
          .from('deals')
          .update({ assigned_to: null })
          .eq('workspace_id', workspaceResult.workspace.workspaceId)
          .eq('assigned_to', profile.id)
      : Promise.resolve({ error: null }),
  ])

  if (conversationCleanup.error) {
    return NextResponse.json({ error: conversationCleanup.error.message }, { status: 500 })
  }
  if (dealCleanup.error) {
    return NextResponse.json({ error: dealCleanup.error.message }, { status: 500 })
  }

  const { error: memberDeleteError } = await admin
    .from('workspace_members')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceResult.workspace.workspaceId)

  if (memberDeleteError) {
    return NextResponse.json({ error: memberDeleteError.message }, { status: 500 })
  }

  await admin
    .from('agent_status')
    .delete()
    .eq('workspace_id', workspaceResult.workspace.workspaceId)
    .eq('user_id', existing.user_id)

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(existing.user_id)
  if (authDeleteError) {
    return NextResponse.json(
      { error: 'Workspace access was removed, but auth user deletion failed.' },
      { status: 500 },
    )
  }

  await admin.from('profiles').delete().eq('user_id', existing.user_id)

  return NextResponse.json({ success: true })
}
