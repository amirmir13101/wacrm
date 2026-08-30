import type { WorkspaceRole } from './assignment'

export const WORKSPACE_PERMISSIONS = [
  'view_dashboard',
  'view_inbox',
  'view_all_conversations',
  'view_assigned_conversations',
  'view_unassigned_conversations',
  'reply_to_conversations',
  'assign_conversations',
  'close_conversations',
  'view_contacts',
  'view_all_contacts',
  'view_assigned_contacts',
  'create_contacts',
  'edit_contacts',
  'delete_contacts',
  'export_contacts',
  'view_broadcasts',
  'create_broadcasts',
  'queue_broadcasts',
  'pause_resume_cancel_broadcasts',
  'view_broadcast_reports',
  'view_templates',
  'sync_templates',
  'manage_local_templates',
  'view_automations',
  'create_automations',
  'edit_automations',
  'activate_deactivate_automations',
  'view_flows',
  'create_flows',
  'edit_flows',
  'activate_deactivate_flows',
  'view_ai_agent',
  'manage_ai_agent',
  'view_knowledge_base',
  'manage_knowledge_base',
  'view_pipeline',
  'view_all_deals',
  'view_assigned_deals',
  'create_deals',
  'edit_deals',
  'assign_deals',
  'mark_deal_won_lost',
  'view_reports',
  'export_reports',
  'view_pricing',
  'use_cost_calculator',
  'manage_pricing_rates',
  'view_settings',
  'manage_whatsapp_config',
  'manage_business_settings',
  'view_team',
  'manage_team_members',
  'edit_team_permissions',
  'use_workspace_whatsapp_config',
  'connect_own_whatsapp_config',
] as const

export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number]
export type WorkspacePermissions = Partial<Record<WorkspacePermission, boolean>>

export type VisibilityMode = 'all' | 'assigned_only' | 'unassigned_and_assigned' | 'none'

export interface PermissionSubject {
  role?: WorkspaceRole | string | null
  permissions?: WorkspacePermissions | null
  can_connect_own_whatsapp?: boolean | null
}

const OWNER_PERMISSIONS = Object.fromEntries(
  WORKSPACE_PERMISSIONS.map((permission) => [permission, true]),
) as Record<WorkspacePermission, boolean>

const MANAGER_PERMISSIONS: WorkspacePermissions = {
  view_dashboard: true,
  view_inbox: true,
  view_all_conversations: true,
  view_assigned_conversations: true,
  view_unassigned_conversations: true,
  reply_to_conversations: true,
  assign_conversations: true,
  close_conversations: true,
  view_contacts: true,
  view_all_contacts: true,
  create_contacts: true,
  edit_contacts: true,
  export_contacts: true,
  view_broadcasts: true,
  create_broadcasts: true,
  queue_broadcasts: true,
  pause_resume_cancel_broadcasts: true,
  view_broadcast_reports: true,
  view_templates: true,
  sync_templates: true,
  manage_local_templates: true,
  view_automations: true,
  create_automations: true,
  edit_automations: true,
  activate_deactivate_automations: true,
  view_flows: true,
  create_flows: true,
  edit_flows: true,
  activate_deactivate_flows: true,
  view_ai_agent: true,
  manage_ai_agent: true,
  view_knowledge_base: true,
  manage_knowledge_base: true,
  view_pipeline: true,
  view_all_deals: true,
  create_deals: true,
  edit_deals: true,
  assign_deals: true,
  mark_deal_won_lost: true,
  view_reports: true,
  view_pricing: true,
  use_cost_calculator: true,
  view_settings: true,
  view_team: true,
  manage_team_members: true,
  edit_team_permissions: true,
  use_workspace_whatsapp_config: true,
}

const AGENT_PERMISSIONS: WorkspacePermissions = {
  view_dashboard: true,
  view_inbox: true,
  view_assigned_conversations: true,
  view_unassigned_conversations: true,
  reply_to_conversations: true,
  view_contacts: true,
  view_assigned_contacts: true,
  create_contacts: true,
  edit_contacts: true,
  view_pipeline: true,
  view_assigned_deals: true,
  edit_deals: true,
  view_pricing: true,
  use_cost_calculator: true,
  view_settings: true,
  use_workspace_whatsapp_config: true,
}

export function defaultPermissionsForRole(role?: string | null): WorkspacePermissions {
  if (role === 'owner' || role === 'admin') return { ...OWNER_PERMISSIONS }
  if (role === 'manager') return { ...MANAGER_PERMISSIONS }
  return { ...AGENT_PERMISSIONS }
}

export function effectivePermissions(subject: PermissionSubject): WorkspacePermissions {
  const defaults = defaultPermissionsForRole(subject.role)
  const explicit = subject.permissions ?? {}
  return {
    ...defaults,
    ...explicit,
    connect_own_whatsapp_config:
      explicit.connect_own_whatsapp_config ?? subject.can_connect_own_whatsapp ?? false,
  }
}

export function hasWorkspacePermission(
  subject: PermissionSubject,
  permission: WorkspacePermission,
): boolean {
  if (subject.role === 'owner') return true
  const permissions = effectivePermissions(subject)
  return permissions[permission] === true
}

export function canManageTeamWithPermissions(subject: PermissionSubject): boolean {
  return (
    hasWorkspacePermission(subject, 'manage_team_members') ||
    hasWorkspacePermission(subject, 'edit_team_permissions')
  )
}

const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  agent: 1,
}

export function canManageWorkspaceRole(
  actorRole: WorkspaceRole | string | null | undefined,
  targetRole: WorkspaceRole | string | null | undefined,
): boolean {
  if (actorRole === 'owner') {
    return (
      typeof targetRole === 'string' &&
      targetRole in WORKSPACE_ROLE_RANK &&
      targetRole !== 'owner'
    )
  }
  if (
    typeof actorRole !== 'string' ||
    typeof targetRole !== 'string' ||
    !(actorRole in WORKSPACE_ROLE_RANK) ||
    !(targetRole in WORKSPACE_ROLE_RANK)
  ) {
    return false
  }
  return (
    WORKSPACE_ROLE_RANK[actorRole as WorkspaceRole] >
    WORKSPACE_ROLE_RANK[targetRole as WorkspaceRole]
  )
}

export function canDelegatePermissions(
  actor: PermissionSubject,
  requested: unknown,
): requested is WorkspacePermissions {
  if (!requested || typeof requested !== 'object' || Array.isArray(requested)) return false

  for (const [key, value] of Object.entries(requested)) {
    if (!(WORKSPACE_PERMISSIONS as readonly string[]).includes(key)) return false
    if (typeof value !== 'boolean') return false
    if (value && !hasWorkspacePermission(actor, key as WorkspacePermission)) return false
  }
  return true
}

export function canAccessDashboardPath(
  subject: PermissionSubject,
  pathname: string,
): boolean {
  if (pathname.startsWith('/dashboard')) return hasWorkspacePermission(subject, 'view_dashboard')
  if (pathname.startsWith('/inbox')) return hasWorkspacePermission(subject, 'view_inbox')
  if (pathname.startsWith('/contacts')) return hasWorkspacePermission(subject, 'view_contacts')
  if (pathname.startsWith('/pipelines')) return hasWorkspacePermission(subject, 'view_pipeline')
  if (pathname.startsWith('/broadcasts')) return hasWorkspacePermission(subject, 'view_broadcasts')
  if (pathname.startsWith('/automations')) return hasWorkspacePermission(subject, 'view_automations')
  if (pathname.startsWith('/flows')) return hasWorkspacePermission(subject, 'view_flows')
  if (pathname.startsWith('/ai-agent') || pathname.startsWith('/agents')) {
    return hasWorkspacePermission(subject, 'view_ai_agent')
  }
  if (pathname.startsWith('/knowledge-base')) {
    return hasWorkspacePermission(subject, 'view_knowledge_base')
  }
  if (pathname.startsWith('/billing')) return true
  if (pathname.startsWith('/whatsapp-api-pricing')) {
    return (
      hasWorkspacePermission(subject, 'view_pricing') ||
      hasWorkspacePermission(subject, 'use_cost_calculator')
    )
  }
  if (pathname.startsWith('/team')) {
    return (
      hasWorkspacePermission(subject, 'view_team') ||
      hasWorkspacePermission(subject, 'manage_team_members')
    )
  }
  if (pathname.startsWith('/settings')) return hasWorkspacePermission(subject, 'view_settings')
  return true
}
