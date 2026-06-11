import { hasWorkspacePermission, type WorkspacePermissions } from './permissions'

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'agent'
export type WorkspaceMemberStatus = 'active' | 'invited' | 'suspended'
export type AssignmentMode = 'specific_agent' | 'round_robin' | 'least_busy' | 'unassigned_only'

export interface WorkspaceMemberOption {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  status: WorkspaceMemberStatus
  permissions?: Record<string, boolean>
  can_connect_own_whatsapp?: boolean
  contact_visibility?: string
  conversation_visibility?: string
  deal_visibility?: string
  profile_id: string | null
  full_name: string | null
  email: string | null
  avatar_url?: string | null
  account_type?: string | null
  open_conversations?: number
  assigned_deals?: number
}

export function canManageTeam(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager'
}

export function canAssignConversation(args: {
  role?: string | null
  permissions?: WorkspacePermissions | null
  actorUserId: string
  currentAssignedUserId?: string | null
  nextAssignedUserId?: string | null
}): boolean {
  if (hasWorkspacePermission({ role: args.role, permissions: args.permissions }, 'assign_conversations')) {
    return true
  }
  if (args.role !== 'agent') return false
  return (
    hasWorkspacePermission({ role: args.role, permissions: args.permissions }, 'view_unassigned_conversations') &&
    !args.currentAssignedUserId &&
    args.nextAssignedUserId === args.actorUserId
  )
}

export function canSeeConversation(args: {
  role?: string | null
  permissions?: WorkspacePermissions | null
  actorUserId: string
  assignedAgentId?: string | null
}): boolean {
  if (hasWorkspacePermission({ role: args.role, permissions: args.permissions }, 'view_all_conversations')) return true
  if (args.role !== 'agent') return false
  if (!args.assignedAgentId) {
    return hasWorkspacePermission(
      { role: args.role, permissions: args.permissions },
      'view_unassigned_conversations',
    )
  }
  return (
    args.assignedAgentId === args.actorUserId &&
    hasWorkspacePermission(
      { role: args.role, permissions: args.permissions },
      'view_assigned_conversations',
    )
  )
}

export function nextRoundRobinAgent(
  members: Array<{ user_id: string; status: string; role: string }>,
  lastAssignedUserId?: string | null,
): string | null {
  const candidates = members
    .filter((member) => member.status === 'active')
    .filter((member) => ['owner', 'admin', 'manager', 'agent'].includes(member.role))
    .map((member) => member.user_id)
    .sort()

  if (candidates.length === 0) return null
  if (!lastAssignedUserId) return candidates[0]

  const index = candidates.indexOf(lastAssignedUserId)
  if (index < 0 || index === candidates.length - 1) return candidates[0]
  return candidates[index + 1]
}

export function leastBusyAgent(
  members: Array<{ user_id: string; status: string; role: string; open_conversations?: number }>,
): string | null {
  const candidates = members
    .filter((member) => member.status === 'active')
    .filter((member) => ['owner', 'admin', 'manager', 'agent'].includes(member.role))
    .sort((a, b) => {
      const load = (a.open_conversations ?? 0) - (b.open_conversations ?? 0)
      if (load !== 0) return load
      return a.user_id.localeCompare(b.user_id)
    })

  return candidates[0]?.user_id ?? null
}

export function assignmentLabel(member?: {
  full_name?: string | null
  email?: string | null
}): string {
  return member?.full_name?.trim() || member?.email?.trim() || 'Assigned'
}
