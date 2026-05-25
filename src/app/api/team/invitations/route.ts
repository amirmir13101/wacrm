import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import {
  createWorkspaceInvitation,
  listWorkspaceInvitations,
} from '@/lib/team/invitations'
import { canManageTeamWithPermissions, defaultPermissionsForRole } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

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
  const permissions =
    body.permissions && typeof body.permissions === 'object'
      ? body.permissions
      : defaultPermissionsForRole(role)

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }
  if (!['admin', 'manager', 'agent'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
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
