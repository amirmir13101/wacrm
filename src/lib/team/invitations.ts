import { createHash, randomBytes } from 'node:crypto'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { defaultPermissionsForRole, type VisibilityMode, type WorkspacePermissions } from './permissions'
import type { WorkspaceRole } from './assignment'

export interface WorkspaceInvitationSummary {
  id: string
  workspace_id: string
  workspace_name?: string | null
  invited_email: string
  invited_by_user_id: string
  invited_by_email?: string | null
  role: WorkspaceRole
  permissions: WorkspacePermissions
  contact_visibility: VisibilityMode
  conversation_visibility: VisibilityMode
  deal_visibility: VisibilityMode
  can_connect_own_whatsapp: boolean
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at: string
  accepted_at?: string | null
  accepted_by_user_id?: string | null
  revoked_at?: string | null
  created_at: string
  invite_url?: string
}

export interface InvitationValidation {
  ok: boolean
  error?: string
  invitation?: WorkspaceInvitationSummary
}

export function createInviteToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function inviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${baseUrl.replace(/\/$/, '')}/invite/accept?token=${encodeURIComponent(token)}`
}

export function inviteAcceptPath(token: string): string {
  return `/invite/accept?token=${encodeURIComponent(token)}`
}

export function inviteAuthPath(pathname: '/login' | '/signup', token: string, email?: string): string {
  const params = new URLSearchParams({
    invite_token: token,
    redirect: '/invite/accept',
  })
  if (email) params.set('email', email)
  return `${pathname}?${params.toString()}`
}

export function defaultInviteVisibility(role: string): {
  contact_visibility: VisibilityMode
  conversation_visibility: VisibilityMode
  deal_visibility: VisibilityMode
} {
  if (role === 'agent') {
    return {
      contact_visibility: 'assigned_only',
      conversation_visibility: 'unassigned_and_assigned',
      deal_visibility: 'assigned_only',
    }
  }
  return {
    contact_visibility: 'all',
    conversation_visibility: 'all',
    deal_visibility: 'all',
  }
}

export async function listWorkspaceInvitations(
  workspaceId: string,
): Promise<WorkspaceInvitationSummary[]> {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('workspace_invitations')
    .select('*, workspace:workspaces(name)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const inviterIds = rows.map((row) => row.invited_by_user_id).filter(Boolean) as string[]
  const { data: inviters } = inviterIds.length
    ? await admin.from('profiles').select('user_id, email').in('user_id', inviterIds)
    : { data: [] }
  const inviterEmailById = new Map(
    ((inviters ?? []) as Array<{ user_id: string; email: string | null }>).map((profile) => [
      profile.user_id,
      profile.email,
    ]),
  )

  return rows.map((row) => invitationRowToSummary(row, inviterEmailById))
}

export async function validateInvitationToken(token: string): Promise<InvitationValidation> {
  if (!token) return { ok: false, error: 'Invite token is required' }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('workspace_invitations')
    .select('*, workspace:workspaces(name)')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Invitation not found' }

  const invitation = invitationRowToSummary(data as Record<string, unknown>, new Map())
  if (invitation.status === 'revoked') return { ok: false, error: 'This invitation was revoked' }
  if (invitation.status === 'accepted') return { ok: false, error: 'This invitation was already accepted' }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    await admin
      .from('workspace_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id)
      .eq('status', 'pending')
    return { ok: false, error: 'This invitation has expired' }
  }

  return { ok: true, invitation }
}

export async function createWorkspaceInvitation(args: {
  workspaceId: string
  invitedByUserId: string
  email: string
  role: string
  permissions?: WorkspacePermissions
  contactVisibility?: VisibilityMode
  conversationVisibility?: VisibilityMode
  dealVisibility?: VisibilityMode
  canConnectOwnWhatsApp?: boolean
}): Promise<{ invitation: WorkspaceInvitationSummary; token: string; inviteUrl: string }> {
  const role = ['admin', 'manager', 'agent'].includes(args.role) ? args.role : 'agent'
  const token = createInviteToken()
  const visibility = defaultInviteVisibility(role)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('workspace_invitations')
    .insert({
      workspace_id: args.workspaceId,
      invited_email: args.email.trim().toLowerCase(),
      invited_by_user_id: args.invitedByUserId,
      role,
      permissions: args.permissions ?? defaultPermissionsForRole(role),
      contact_visibility: args.contactVisibility ?? visibility.contact_visibility,
      conversation_visibility: args.conversationVisibility ?? visibility.conversation_visibility,
      deal_visibility: args.dealVisibility ?? visibility.deal_visibility,
      can_connect_own_whatsapp: Boolean(args.canConnectOwnWhatsApp),
      token_hash: hashInviteToken(token),
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('*, workspace:workspaces(name)')
    .single()

  if (error) throw new Error(error.message)

  return {
    invitation: invitationRowToSummary(data as Record<string, unknown>, new Map()),
    token,
    inviteUrl: inviteUrl(token),
  }
}

export async function acceptInvitation(args: {
  token: string
  userId: string
  email: string
}): Promise<{ ok: true; workspaceId: string } | { ok: false; status: number; error: string; invitedEmail?: string }> {
  const validation = await validateInvitationToken(args.token)
  if (!validation.ok || !validation.invitation) {
    return { ok: false, status: 400, error: validation.error ?? 'Invalid invitation' }
  }

  const invitation = validation.invitation
  if (args.email.trim().toLowerCase() !== invitation.invited_email.trim().toLowerCase()) {
    return {
      ok: false,
      status: 403,
      error: `This invitation was sent to ${invitation.invited_email}. Please login or sign up with that email.`,
      invitedEmail: invitation.invited_email,
    }
  }

  const admin = supabaseAdmin()
  await admin
    .from('profiles')
    .update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .eq('user_id', args.userId)
    .neq('approval_status', 'approved')

  const { error: memberError } = await admin.from('workspace_members').upsert(
    {
      workspace_id: invitation.workspace_id,
      user_id: args.userId,
      role: invitation.role,
      status: 'active',
      permissions: invitation.permissions ?? {},
      can_connect_own_whatsapp: invitation.can_connect_own_whatsapp,
      contact_visibility: invitation.contact_visibility,
      conversation_visibility: invitation.conversation_visibility,
      deal_visibility: invitation.deal_visibility,
      joined_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,user_id' },
  )
  if (memberError) return { ok: false, status: 500, error: memberError.message }

  await admin.from('agent_status').upsert(
    {
      workspace_id: invitation.workspace_id,
      user_id: args.userId,
      availability: 'online',
    },
    { onConflict: 'workspace_id,user_id' },
  )

  const { error: inviteError } = await admin
    .from('workspace_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_user_id: args.userId,
    })
    .eq('id', invitation.id)
    .eq('status', 'pending')

  if (inviteError) return { ok: false, status: 500, error: inviteError.message }

  await admin
    .from('profiles')
    .update({ active_workspace_id: invitation.workspace_id })
    .eq('user_id', args.userId)

  return { ok: true, workspaceId: invitation.workspace_id }
}

function invitationRowToSummary(
  row: Record<string, unknown>,
  inviterEmailById: Map<string, string | null>,
): WorkspaceInvitationSummary {
  const workspace = row.workspace as { name?: string | null } | Array<{ name?: string | null }> | null
  const invitedBy = String(row.invited_by_user_id)
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    workspace_name: Array.isArray(workspace) ? workspace[0]?.name ?? null : workspace?.name ?? null,
    invited_email: String(row.invited_email),
    invited_by_user_id: invitedBy,
    invited_by_email: inviterEmailById.get(invitedBy) ?? null,
    role: row.role as WorkspaceRole,
    permissions: (row.permissions ?? {}) as WorkspacePermissions,
    contact_visibility: (row.contact_visibility ?? 'assigned_only') as VisibilityMode,
    conversation_visibility: (row.conversation_visibility ?? 'assigned_only') as VisibilityMode,
    deal_visibility: (row.deal_visibility ?? 'assigned_only') as VisibilityMode,
    can_connect_own_whatsapp: Boolean(row.can_connect_own_whatsapp),
    status: row.status as WorkspaceInvitationSummary['status'],
    expires_at: String(row.expires_at),
    accepted_at: row.accepted_at ? String(row.accepted_at) : null,
    accepted_by_user_id: row.accepted_by_user_id ? String(row.accepted_by_user_id) : null,
    revoked_at: row.revoked_at ? String(row.revoked_at) : null,
    created_at: String(row.created_at),
  }
}
