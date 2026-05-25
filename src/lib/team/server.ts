import { supabaseAdmin } from '@/lib/automations/admin-client'
import { createClient } from '@/lib/supabase/server'
import { canManageTeam, type WorkspaceMemberOption, type WorkspaceRole } from './assignment'
import {
  hasWorkspacePermission,
  type VisibilityMode,
  type WorkspacePermissions,
  type WorkspacePermission,
} from './permissions'

export interface CurrentWorkspace {
  workspaceId: string
  userId: string
  role: WorkspaceRole
  permissions: WorkspacePermissions
  canConnectOwnWhatsApp: boolean
  contactVisibility: VisibilityMode
  conversationVisibility: VisibilityMode
  dealVisibility: VisibilityMode
}

export async function requireCurrentWorkspace(): Promise<
  | { ok: true; workspace: CurrentWorkspace }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, status: 401, error: 'Unauthorized' }

  const admin = supabaseAdmin()
  const { data: member, error } = await admin
    .from('workspace_members')
    .select('workspace_id, role, status, permissions, can_connect_own_whatsapp, contact_visibility, conversation_visibility, deal_visibility')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, error: `Workspace lookup failed: ${error.message}` }
  }
  if (!member) {
    return { ok: false, status: 403, error: 'Active workspace membership required' }
  }

  return {
    ok: true,
    workspace: {
      workspaceId: member.workspace_id as string,
      userId: user.id,
      role: member.role as WorkspaceRole,
      permissions: (member.permissions ?? {}) as WorkspacePermissions,
      canConnectOwnWhatsApp: Boolean(member.can_connect_own_whatsapp),
      contactVisibility: (member.contact_visibility ?? 'assigned_only') as VisibilityMode,
      conversationVisibility: (member.conversation_visibility ?? 'assigned_only') as VisibilityMode,
      dealVisibility: (member.deal_visibility ?? 'assigned_only') as VisibilityMode,
    },
  }
}

export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMemberOption[]> {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, status, permissions, can_connect_own_whatsapp, contact_visibility, conversation_visibility, deal_visibility')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{
    id: string
    workspace_id: string
    user_id: string
    role: WorkspaceRole
    status: 'active' | 'invited' | 'suspended'
    permissions?: WorkspacePermissions
    can_connect_own_whatsapp?: boolean
    contact_visibility?: string
    conversation_visibility?: string
    deal_visibility?: string
  }>

  const userIds = rows.map((row) => row.user_id)
  const { data: profiles } = userIds.length
    ? await admin
        .from('profiles')
        .select('id, user_id, full_name, email, avatar_url')
        .in('user_id', userIds)
    : { data: [] }

  const profileByUserId = new Map(
    ((profiles ?? []) as Array<{
      id: string
      user_id: string
      full_name: string | null
      email: string | null
      avatar_url?: string | null
    }>).map((profile) => [profile.user_id, profile]),
  )

  const [conversationCounts, dealCounts] = await Promise.all([
    openConversationCounts(workspaceId),
    assignedDealCounts(workspaceId),
  ])

  return rows.map((row) => {
    const profile = profileByUserId.get(row.user_id)
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      user_id: row.user_id,
      role: row.role,
      status: row.status,
      permissions: row.permissions ?? {},
      can_connect_own_whatsapp: Boolean(row.can_connect_own_whatsapp),
      contact_visibility: row.contact_visibility ?? 'assigned_only',
      conversation_visibility: row.conversation_visibility ?? 'assigned_only',
      deal_visibility: row.deal_visibility ?? 'assigned_only',
      profile_id: profile?.id ?? null,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      avatar_url: profile?.avatar_url ?? null,
      open_conversations: conversationCounts.get(row.user_id) ?? 0,
      assigned_deals: profile?.id ? dealCounts.get(profile.id) ?? 0 : 0,
    }
  })
}

export async function requireWorkspaceManager(): Promise<
  | { ok: true; workspace: CurrentWorkspace }
  | { ok: false; status: number; error: string }
> {
  const result = await requireCurrentWorkspace()
  if (!result.ok) return result
  if (!canManageTeam(result.workspace.role)) {
    return { ok: false, status: 403, error: 'Manager access required' }
  }
  return result
}

export async function requireWorkspacePermission(
  permission: WorkspacePermission,
): Promise<
  | { ok: true; workspace: CurrentWorkspace }
  | { ok: false; status: number; error: string }
> {
  const result = await requireCurrentWorkspace()
  if (!result.ok) return result
  if (!hasWorkspacePermission(
    {
      role: result.workspace.role,
      permissions: result.workspace.permissions,
      can_connect_own_whatsapp: result.workspace.canConnectOwnWhatsApp,
    },
    permission,
  )) {
    return { ok: false, status: 403, error: 'Permission required' }
  }
  return result
}

async function openConversationCounts(workspaceId: string): Promise<Map<string, number>> {
  const { data } = await supabaseAdmin()
    .from('conversations')
    .select('assigned_agent_id')
    .eq('workspace_id', workspaceId)
    .in('status', ['open', 'pending'])
    .not('assigned_agent_id', 'is', null)

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ assigned_agent_id: string | null }>) {
    if (!row.assigned_agent_id) continue
    counts.set(row.assigned_agent_id, (counts.get(row.assigned_agent_id) ?? 0) + 1)
  }
  return counts
}

async function assignedDealCounts(workspaceId: string): Promise<Map<string, number>> {
  const { data } = await supabaseAdmin()
    .from('deals')
    .select('assigned_to')
    .eq('workspace_id', workspaceId)
    .eq('status', 'open')
    .not('assigned_to', 'is', null)

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ assigned_to: string | null }>) {
    if (!row.assigned_to) continue
    counts.set(row.assigned_to, (counts.get(row.assigned_to) ?? 0) + 1)
  }
  return counts
}
