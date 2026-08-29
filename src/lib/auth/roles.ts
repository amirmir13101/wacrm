export type AccountRole = 'owner' | 'admin' | 'agent' | 'viewer'

const ROLE_RANK: Record<AccountRole, number> = {
  viewer: 0,
  agent: 1,
  admin: 2,
  owner: 3,
}

export function hasMinRole(role: AccountRole | null | undefined, min: AccountRole): boolean {
  if (!role) return false
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

export function canEditSettings(role: AccountRole | null | undefined): boolean {
  return hasMinRole(role, 'admin')
}

export function mapWorkspaceRoleToAccountRole(role: string | null | undefined): AccountRole {
  if (role === 'owner') return 'owner'
  if (role === 'admin' || role === 'manager') return 'admin'
  if (role === 'agent') return 'agent'
  return 'viewer'
}
