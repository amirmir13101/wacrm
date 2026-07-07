import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import {
  createWorkspaceInvitation,
  listWorkspaceInvitations,
} from '@/lib/team/invitations'
import {
  canDelegatePermissions,
  canManageTeamWithPermissions,
  canManageWorkspaceRole,
  defaultPermissionsForRole,
  hasWorkspacePermission,
} from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'
import { getWorkspaceTeamLimitStatus } from '@/lib/team/limits'

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  if (!canManageTeamWithPermissions({
    role: workspaceResult.workspace.role,
    permissions: workspaceResult.workspace.permissions,
  })) {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
  }

  const invitations = await listWorkspaceInvitations(workspaceResult.workspace.workspaceId)
  return NextResponse.json({ invitations })
}

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
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
  const permissions = body.permissions ?? defaultPermissionsForRole(role)

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
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
    Boolean(body.can_connect_own_whatsapp) &&
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

  const created = await createWorkspaceInvitation({
    workspaceId: workspaceResult.workspace.workspaceId,
    invitedByUserId: workspaceResult.workspace.userId,
    email,
    role,
    permissions,
    contactVisibility: body.contact_visibility,
    conversationVisibility: body.conversation_visibility,
    dealVisibility: body.deal_visibility,
    canConnectOwnWhatsApp: Boolean(body.can_connect_own_whatsapp),
  })

  return NextResponse.json({
    success: true,
    invitation: {
      ...created.invitation,
      invite_url: created.inviteUrl,
    },
    email_sending_configured: false,
    message: 'Email sending is not configured. Copy this invite link and send it manually.',
  })
}

export async function PATCH(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  if (!canManageTeamWithPermissions({
    role: workspaceResult.workspace.role,
    permissions: workspaceResult.workspace.permissions,
  })) {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const action = typeof body.action === 'string' ? body.action : ''
  if (!id || action !== 'revoke') {
    return NextResponse.json({ error: 'Unsupported invitation update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin()
    .from('workspace_invitations')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('workspace_id', workspaceResult.workspace.workspaceId)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  if (!canManageTeamWithPermissions({
    role: workspaceResult.workspace.role,
    permissions: workspaceResult.workspace.permissions,
  })) {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const body = await request.json().catch(() => ({}))
  const id =
    typeof body.id === 'string'
      ? body.id
      : searchParams.get('id') ?? ''

  if (!id) {
    return NextResponse.json({ error: 'Invitation is required' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: invitation, error: lookupError } = await admin
    .from('workspace_invitations')
    .select('id, status')
    .eq('id', id)
    .eq('workspace_id', workspaceResult.workspace.workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }
  if (invitation.status === 'accepted') {
    return NextResponse.json(
      { error: 'Accepted invitations are kept for audit history.' },
      { status: 400 },
    )
  }

  const deletedAt = new Date().toISOString()
  const update: Record<string, string> = {
    deleted_at: deletedAt,
    deleted_by: workspaceResult.workspace.userId,
  }
  if (invitation.status === 'pending') {
    update.status = 'revoked'
    update.revoked_at = deletedAt
  }

  const { error } = await admin
    .from('workspace_invitations')
    .update(update)
    .eq('id', id)
    .eq('workspace_id', workspaceResult.workspace.workspaceId)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
