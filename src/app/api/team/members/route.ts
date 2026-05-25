import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { listWorkspaceInvitations } from '@/lib/team/invitations'
import {
  listCurrentUserWorkspaces,
  requireCurrentWorkspace,
  listWorkspaceMembers,
} from '@/lib/team/server'
import { canManageTeamWithPermissions, defaultPermissionsForRole } from '@/lib/team/permissions'

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    )
  }

  const [members, workspaces, invitations] = await Promise.all([
    listWorkspaceMembers(workspaceResult.workspace.workspaceId),
    listCurrentUserWorkspaces(workspaceResult.workspace.userId),
    canManageTeamWithPermissions({
      role: workspaceResult.workspace.role,
      permissions: workspaceResult.workspace.permissions,
    })
      ? listWorkspaceInvitations(workspaceResult.workspace.workspaceId)
      : Promise.resolve([]),
  ])
  return NextResponse.json({
    workspace_id: workspaceResult.workspace.workspaceId,
    workspace_name: workspaceResult.workspace.workspaceName,
    current_user_id: workspaceResult.workspace.userId,
    current_role: workspaceResult.workspace.role,
    current_permissions: workspaceResult.workspace.permissions,
    current_can_connect_own_whatsapp: workspaceResult.workspace.canConnectOwnWhatsApp,
    current_contact_visibility: workspaceResult.workspace.contactVisibility,
    current_conversation_visibility: workspaceResult.workspace.conversationVisibility,
    current_deal_visibility: workspaceResult.workspace.dealVisibility,
    can_manage_team: canManageTeamWithPermissions({
      role: workspaceResult.workspace.role,
      permissions: workspaceResult.workspace.permissions,
    }),
    members,
    invitations,
    workspaces,
  })
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = typeof body.role === 'string' ? body.role : 'agent'
  const permissions =
    body.permissions && typeof body.permissions === 'object'
      ? body.permissions
      : defaultPermissionsForRole(role)
  const canConnectOwnWhatsApp = Boolean(body.can_connect_own_whatsapp)
  const contactVisibility = typeof body.contact_visibility === 'string' ? body.contact_visibility : role === 'agent' ? 'assigned_only' : 'all'
  const conversationVisibility = typeof body.conversation_visibility === 'string' ? body.conversation_visibility : role === 'agent' ? 'unassigned_and_assigned' : 'all'
  const dealVisibility = typeof body.deal_visibility === 'string' ? body.deal_visibility : role === 'agent' ? 'assigned_only' : 'all'

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }
  if (!['admin', 'manager', 'agent'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('user_id, approval_status')
    .ilike('email', email)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }
  if (!profile) {
    return NextResponse.json(
      { error: 'No approved CRM user found with that email.' },
      { status: 404 },
    )
  }
  if (profile.approval_status !== 'approved') {
    return NextResponse.json(
      { error: 'User must be approved before joining a workspace.' },
      { status: 400 },
    )
  }

  const { error } = await admin.from('workspace_members').upsert(
    {
      workspace_id: workspaceResult.workspace.workspaceId,
      user_id: profile.user_id,
      role,
      status: 'active',
      permissions,
      can_connect_own_whatsapp: canConnectOwnWhatsApp,
      contact_visibility: contactVisibility,
      conversation_visibility: conversationVisibility,
      deal_visibility: dealVisibility,
      joined_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,user_id' },
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await admin.from('agent_status').upsert(
    {
      workspace_id: workspaceResult.workspace.workspaceId,
      user_id: profile.user_id,
      availability: 'online',
    },
    { onConflict: 'workspace_id,user_id' },
  )

  return NextResponse.json({ success: true })
}
