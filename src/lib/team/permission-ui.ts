import {
  WORKSPACE_PERMISSIONS,
  defaultPermissionsForRole,
  type WorkspacePermission,
  type WorkspacePermissions,
} from './permissions'

export type PermissionGroupId =
  | 'dashboard'
  | 'inbox'
  | 'contacts'
  | 'broadcasts'
  | 'templates'
  | 'automations'
  | 'flows'
  | 'ai_agent'
  | 'pipeline'
  | 'reports'
  | 'pricing'
  | 'settings'
  | 'team'
  | 'whatsapp'

export interface PermissionItem {
  key: WorkspacePermission
  label: string
  danger?: boolean
}

export interface PermissionGroup {
  id: PermissionGroupId
  title: string
  helper: string
  items: PermissionItem[]
  section?: 'main' | 'conversation' | 'contact' | 'sales' | 'marketing' | 'admin' | 'whatsapp'
}

export interface PermissionPreset {
  id: string
  label: string
  helper: string
  permissions: WorkspacePermissions
  canConnectOwnWhatsapp?: boolean
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    helper: 'Basic CRM overview widgets.',
    section: 'main',
    items: [{ key: 'view_dashboard', label: 'View dashboard' }],
  },
  {
    id: 'inbox',
    title: 'Inbox',
    helper: 'WhatsApp conversation access and actions.',
    section: 'conversation',
    items: [
      { key: 'view_inbox', label: 'View inbox' },
      { key: 'view_all_conversations', label: 'View all conversations' },
      { key: 'view_assigned_conversations', label: 'View assigned conversations' },
      { key: 'view_unassigned_conversations', label: 'View unassigned conversations' },
      { key: 'reply_to_conversations', label: 'Reply to conversations' },
      { key: 'assign_conversations', label: 'Assign conversations' },
      { key: 'close_conversations', label: 'Close conversations' },
    ],
  },
  {
    id: 'contacts',
    title: 'Contacts',
    helper: 'Contact records, exports, and contact edits.',
    section: 'contact',
    items: [
      { key: 'view_contacts', label: 'View contacts' },
      { key: 'view_all_contacts', label: 'View all contacts' },
      { key: 'view_assigned_contacts', label: 'View assigned contacts' },
      { key: 'create_contacts', label: 'Create contacts' },
      { key: 'edit_contacts', label: 'Edit contacts' },
      { key: 'delete_contacts', label: 'Delete contacts', danger: true },
      { key: 'export_contacts', label: 'Export contacts', danger: true },
    ],
  },
  {
    id: 'broadcasts',
    title: 'Broadcasts',
    helper: 'Campaign creation, queue control, and reports.',
    section: 'marketing',
    items: [
      { key: 'view_broadcasts', label: 'View broadcasts' },
      { key: 'create_broadcasts', label: 'Create broadcasts' },
      { key: 'queue_broadcasts', label: 'Queue broadcasts' },
      { key: 'pause_resume_cancel_broadcasts', label: 'Pause/resume/cancel broadcasts' },
      { key: 'view_broadcast_reports', label: 'View broadcast reports' },
    ],
  },
  {
    id: 'templates',
    title: 'Templates',
    helper: 'Approved Meta template catalog access.',
    section: 'marketing',
    items: [
      { key: 'view_templates', label: 'View templates' },
      { key: 'sync_templates', label: 'Sync templates' },
      { key: 'manage_local_templates', label: 'Manage local templates' },
    ],
  },
  {
    id: 'automations',
    title: 'Automations',
    helper: 'Workflow builder access and activation controls.',
    section: 'main',
    items: [
      { key: 'view_automations', label: 'View automations' },
      { key: 'create_automations', label: 'Create automations' },
      { key: 'edit_automations', label: 'Edit automations' },
      { key: 'activate_deactivate_automations', label: 'Activate/deactivate automations' },
    ],
  },
  {
    id: 'flows',
    title: 'Flows',
    helper: 'WhatsApp button/list flow builder access and activation controls.',
    section: 'main',
    items: [
      { key: 'view_flows', label: 'View flows' },
      { key: 'create_flows', label: 'Create flows' },
      { key: 'edit_flows', label: 'Edit flows' },
      { key: 'activate_deactivate_flows', label: 'Activate/deactivate flows' },
    ],
  },
  {
    id: 'ai_agent',
    title: 'AI Agent',
    helper: 'Separate AI agent settings, knowledge, playground, and usage visibility.',
    section: 'main',
    items: [
      { key: 'view_ai_agent', label: 'View AI Agent' },
      { key: 'manage_ai_agent', label: 'Manage AI Agent', danger: true },
    ],
  },
  {
    id: 'pipeline',
    title: 'Pipeline',
    helper: 'Deal board, assignments, and deal status.',
    section: 'sales',
    items: [
      { key: 'view_pipeline', label: 'View pipeline' },
      { key: 'view_all_deals', label: 'View all deals' },
      { key: 'view_assigned_deals', label: 'View assigned deals' },
      { key: 'create_deals', label: 'Create deals' },
      { key: 'edit_deals', label: 'Edit deals' },
      { key: 'assign_deals', label: 'Assign deals' },
      { key: 'mark_deal_won_lost', label: 'Mark deal won/lost' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    helper: 'Reporting and exports.',
    section: 'main',
    items: [
      { key: 'view_reports', label: 'View reports' },
      { key: 'export_reports', label: 'Export reports', danger: true },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing',
    helper: 'WhatsApp cost estimates and rate management.',
    section: 'admin',
    items: [
      { key: 'view_pricing', label: 'View pricing' },
      { key: 'use_cost_calculator', label: 'Use cost calculator' },
      { key: 'manage_pricing_rates', label: 'Manage pricing rates', danger: true },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    helper: 'Workspace settings and WhatsApp setup.',
    section: 'admin',
    items: [
      { key: 'view_settings', label: 'View settings' },
      { key: 'manage_whatsapp_config', label: 'Manage WhatsApp config', danger: true },
      { key: 'manage_business_settings', label: 'Manage business settings' },
    ],
  },
  {
    id: 'team',
    title: 'Team',
    helper: 'Member list, roles, and permission editing.',
    section: 'admin',
    items: [
      { key: 'view_team', label: 'View team' },
      { key: 'manage_team_members', label: 'Manage team members', danger: true },
      { key: 'edit_team_permissions', label: 'Edit team permissions', danger: true },
    ],
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp API',
    helper: 'Which WhatsApp connection this member can use.',
    section: 'whatsapp',
    items: [
      { key: 'use_workspace_whatsapp_config', label: 'Use workspace WhatsApp config' },
      { key: 'connect_own_whatsapp_config', label: 'Connect own WhatsApp config', danger: true },
    ],
  },
]

export const ROLE_PRESETS: PermissionPreset[] = [
  {
    id: 'agent_basic',
    label: 'Basic Agent',
    helper: 'Can view and reply to assigned chats only.',
    permissions: defaultPermissionsForRole('agent'),
  },
  {
    id: 'sales_agent',
    label: 'Sales Agent',
    helper: 'Can handle assigned chats, contacts, and deals.',
    permissions: {
      ...defaultPermissionsForRole('agent'),
      create_contacts: true,
      edit_contacts: true,
      create_deals: true,
    },
  },
  {
    id: 'support_agent',
    label: 'Support Agent',
    helper: 'Can handle inbox and support conversations.',
    permissions: {
      view_dashboard: true,
      view_inbox: true,
      view_assigned_conversations: true,
      view_unassigned_conversations: true,
      reply_to_conversations: true,
      close_conversations: true,
      view_contacts: true,
      view_assigned_contacts: true,
      view_settings: true,
      use_workspace_whatsapp_config: true,
    },
  },
  {
    id: 'manager',
    label: 'Manager',
    helper: 'Can view team activity and assign work.',
    permissions: defaultPermissionsForRole('manager'),
  },
  {
    id: 'full_access',
    label: 'Full Access',
    helper: 'Can access almost everything except platform admin.',
    permissions: Object.fromEntries(
      WORKSPACE_PERMISSIONS.map((permission) => [permission, true]),
    ) as Record<WorkspacePermission, boolean>,
  },
]

export const ADVANCED_PERMISSION_SECTIONS = [
  {
    id: 'main',
    title: 'Main access',
    groupIds: ['dashboard', 'inbox', 'contacts', 'pipeline', 'broadcasts', 'automations', 'flows', 'ai_agent', 'reports'],
  },
  {
    id: 'conversation',
    title: 'Conversation permissions',
    groupIds: ['inbox'],
  },
  {
    id: 'contact',
    title: 'Contact permissions',
    groupIds: ['contacts'],
  },
  {
    id: 'sales',
    title: 'Sales / Pipeline permissions',
    groupIds: ['pipeline'],
  },
  {
    id: 'marketing',
    title: 'Marketing permissions',
    groupIds: ['broadcasts', 'templates'],
  },
  {
    id: 'admin',
    title: 'Advanced admin permissions',
    groupIds: ['pricing', 'settings', 'team'],
    danger: true,
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp connection',
    groupIds: ['whatsapp'],
  },
] as const

export const MAIN_ACCESS_PERMISSIONS: Array<{
  key: WorkspacePermission
  label: string
}> = [
  { key: 'view_dashboard', label: 'Dashboard' },
  { key: 'view_inbox', label: 'Inbox' },
  { key: 'view_contacts', label: 'Contacts' },
  { key: 'view_pipeline', label: 'Pipeline' },
  { key: 'view_broadcasts', label: 'Broadcasts' },
  { key: 'view_automations', label: 'Automations' },
  { key: 'view_flows', label: 'Flows' },
  { key: 'view_ai_agent', label: 'AI Agent' },
  { key: 'view_reports', label: 'Reports' },
]

export function findMatchingPreset(permissions: WorkspacePermissions): PermissionPreset | null {
  for (const preset of ROLE_PRESETS) {
    const matches = WORKSPACE_PERMISSIONS.every(
      (permission) => Boolean(permissions[permission]) === Boolean(preset.permissions[permission]),
    )
    if (matches) return preset
  }
  return null
}

export function enabledMainAccessLabels(permissions: WorkspacePermissions): string[] {
  return MAIN_ACCESS_PERMISSIONS
    .filter((item) => permissions[item.key] === true)
    .map((item) => item.label)
}

export function permissionSummary(permissions: WorkspacePermissions): {
  access: string
  canReply: boolean
  canBroadcast: boolean
  canManageSettings: boolean
  whatsapp: string
} {
  const access = enabledMainAccessLabels(permissions).join(', ') || 'No main tabs'
  return {
    access,
    canReply: permissions.reply_to_conversations === true,
    canBroadcast: permissions.queue_broadcasts === true,
    canManageSettings:
      permissions.manage_business_settings === true ||
      permissions.manage_whatsapp_config === true ||
      permissions.manage_pricing_rates === true,
    whatsapp:
      permissions.connect_own_whatsapp_config === true
        ? 'Can connect own WhatsApp'
        : 'Uses workspace connection',
  }
}

export function enabledCount(
  permissions: WorkspacePermissions,
  group: PermissionGroup,
): number {
  return group.items.filter((item) => permissions[item.key] === true).length
}

export function setGroupPermissions(
  permissions: WorkspacePermissions,
  group: PermissionGroup,
  enabled: boolean,
): WorkspacePermissions {
  return {
    ...permissions,
    ...Object.fromEntries(group.items.map((item) => [item.key, enabled])),
  }
}

export function applyPermissionPreset(presetId: string): {
  permissions: WorkspacePermissions
  canConnectOwnWhatsapp: boolean
} {
  const preset = ROLE_PRESETS.find((item) => item.id === presetId) ?? ROLE_PRESETS[0]
  return {
    permissions: { ...preset.permissions },
    canConnectOwnWhatsapp: Boolean(
      preset.canConnectOwnWhatsapp || preset.permissions.connect_own_whatsapp_config,
    ),
  }
}
