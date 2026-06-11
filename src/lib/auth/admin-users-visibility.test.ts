import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const adminUsersRoute = readFileSync(
  join(process.cwd(), 'src/app/api/admin/users/route.ts'),
  'utf8',
)
const adminUsersPage = readFileSync(
  join(process.cwd(), 'src/app/admin/users/page.tsx'),
  'utf8',
)
const teamServer = readFileSync(join(process.cwd(), 'src/lib/team/server.ts'), 'utf8')

describe('platform admin users visibility', () => {
  it('classifies admin users separately from workspace team members', () => {
    expect(adminUsersRoute).toContain('filterPlatformAdminUsers')
    expect(adminUsersRoute).toContain('classifyAdminUser')
    expect(adminUsersRoute).toContain("profile.role === 'admin'")
    expect(adminUsersRoute).toContain("return 'platform_admin'")
    expect(adminUsersRoute).toContain("return 'workspace_owner'")
    expect(adminUsersRoute).toContain("return 'pending_signup'")
  })

  it('excludes invited team-only users from the platform admin list', () => {
    expect(adminUsersRoute).toContain(".from('workspace_members')")
    expect(adminUsersRoute).toContain(".from('workspace_invitations')")
    expect(adminUsersRoute).toContain("row.role !== 'owner'")
    expect(adminUsersRoute).toContain('hasInviteFootprint')
    expect(adminUsersRoute).toContain('if (hasInviteFootprint) return null')
    expect(adminUsersRoute).toContain("profile.account_type !== null")
  })

  it('keeps workspace owners visible even when they are also team members elsewhere', () => {
    expect(adminUsersRoute).toContain('workspaceOwnerUserIds.has(profile.user_id)')
    expect(adminUsersRoute.indexOf("return 'workspace_owner'")).toBeLessThan(
      adminUsersRoute.indexOf('hasInviteFootprint'),
    )
  })

  it('labels platform account type in the admin users UI', () => {
    expect(adminUsersPage).toContain('account_type?')
    expect(adminUsersPage).toContain('Platform Admin')
    expect(adminUsersPage).toContain('Workspace Owner')
    expect(adminUsersPage).toContain('Pending Signup')
    expect(adminUsersPage).toContain('accountTypeLabel')
  })

  it('leaves team member listing under the workspace team page path', () => {
    expect(teamServer).toContain('listWorkspaceMembers')
    expect(teamServer).toContain(".from('workspace_members')")
    expect(teamServer).toContain('.eq(\'workspace_id\', workspaceId)')
  })
})
