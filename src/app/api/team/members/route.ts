import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { getSiteUrl } from '@/lib/site-url'
import { listWorkspaceInvitations } from '@/lib/team/invitations'
import {
  listCurrentUserWorkspaces,
  requireCurrentWorkspace,
  listWorkspaceMembers,
} from '@/lib/team/server'
import {
  canDelegatePermissions,
  canManageTeamWithPermissions,
  canManageWorkspaceRole,
  defaultPermissionsForRole,
  hasWorkspacePermission,
} from '@/lib/team/permissions'
import { getWorkspaceTeamLimitStatus } from '@/lib/team/limits'

function passwordValidationError(password: string) {
  if (password.length < 8) return 'Temporary password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Temporary password needs at least one uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Temporary password needs at least one lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Temporary password needs at least one number.'
  return null
}

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    )
  }

  const canManageTeam = canManageTeamWithPermissions({
    role: workspaceResult.workspace.role,
    permissions: workspaceResult.workspace.permissions,
  })
  const [members, workspaces, invitations, teamLimit] = await Promise.all([
    listWorkspaceMembers(workspaceResult.workspace.workspaceId),
    listCurrentUserWorkspaces(workspaceResult.workspace.userId),
    canManageTeam
      ? listWorkspaceInvitations(workspaceResult.workspace.workspaceId)
      : Promise.resolve([]),
    canManageTeam
      ? getWorkspaceTeamLimitStatus(workspaceResult.workspace.workspaceId)
      : Promise.resolve(null),
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
    can_manage_team: canManageTeam,
    team_limit: teamLimit,
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
  const temporaryPassword =
    typeof body.temporary_password === 'string' ? body.temporary_password : ''
  const confirmTemporaryPassword =
    typeof body.confirm_temporary_password === 'string'
      ? body.confirm_temporary_password
      : ''
  const role = typeof body.role === 'string' ? body.role : 'agent'
  const permissions = body.permissions ?? defaultPermissionsForRole(role)
  const canConnectOwnWhatsApp = Boolean(body.can_connect_own_whatsapp)
  const contactVisibility = typeof body.contact_visibility === 'string' ? body.contact_visibility : role === 'agent' ? 'assigned_only' : 'all'
  const conversationVisibility = typeof body.conversation_visibility === 'string' ? body.conversation_visibility : role === 'agent' ? 'unassigned_and_assigned' : 'all'
  const dealVisibility = typeof body.deal_visibility === 'string' ? body.deal_visibility : role === 'agent' ? 'assigned_only' : 'all'

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }
  if (temporaryPassword !== confirmTemporaryPassword) {
    return NextResponse.json({ error: 'Temporary passwords do not match' }, { status: 400 })
  }
  const passwordError = passwordValidationError(temporaryPassword)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }
  if (!['admin', 'manager', 'agent'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  const actor = {
    role: workspaceResult.workspace.role,
    permissions: workspaceResult.workspace.permissions,
    can_connect_own_whatsapp: workspaceResult.workspace.canConnectOwnWhatsApp,
  }
  if (!canManageWorkspaceRole(actor.role, role)) {
    return NextResponse.json({ error: 'You cannot assign this role' }, { status: 403 })
  }
  if (!canDelegatePermissions(actor, permissions)) {
    return NextResponse.json(
      { error: 'You cannot grant permissions that you do not have' },
      { status: 403 },
    )
  }
  if (
    canConnectOwnWhatsApp &&
    !hasWorkspacePermission(actor, 'connect_own_whatsapp_config') &&
    actor.role !== 'owner'
  ) {
    return NextResponse.json(
      { error: 'You cannot grant personal WhatsApp connection access' },
      { status: 403 },
    )
  }

  const teamLimit = await getWorkspaceTeamLimitStatus(workspaceResult.workspace.workspaceId)
  if (!teamLimit.canInviteMore) {
    return NextResponse.json({ error: teamLimit.message, team_limit: teamLimit }, { status: 402 })
  }

  const admin = supabaseAdmin()
  const { data: existingProfile, error: profileError } = await admin
    .from('profiles')
    .select('user_id, approval_status, account_type')
    .ilike('email', email)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }
  if (existingProfile) {
    return NextResponse.json(
      { error: 'An account already exists with this email. Delete it first or use a different email.' },
      { status: 409 },
    )
  }

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: email.split('@')[0],
      account_type: 'team_member',
    },
  })

  if (createUserError || !createdUser.user) {
    return NextResponse.json(
      { error: createUserError?.message ?? 'Failed to create team member account' },
      { status: 400 },
    )
  }

  const userId = createdUser.user.id
  const now = new Date().toISOString()

  const { error: profileUpsertError } = await admin.from('profiles').upsert(
    {
      user_id: userId,
      full_name: email.split('@')[0],
      email,
      role: 'user',
      approval_status: 'approved',
      account_type: 'team_member',
      must_change_password: true,
      temporary_password_set_at: now,
      active_workspace_id: workspaceResult.workspace.workspaceId,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  )

  if (profileUpsertError) {
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: profileUpsertError.message }, { status: 500 })
  }

  const { error } = await admin.from('workspace_members').upsert(
    {
      workspace_id: workspaceResult.workspace.workspaceId,
      user_id: userId,
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
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await admin.from('agent_status').upsert(
    {
      workspace_id: workspaceResult.workspace.workspaceId,
      user_id: userId,
      availability: 'online',
    },
    { onConflict: 'workspace_id,user_id' },
  )

  return NextResponse.json({
    success: true,
    login_url: `${getSiteUrl()}/login`,
    email,
    temporary_password: temporaryPassword,
  })
}
