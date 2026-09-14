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
const adminUserDetailRoute = readFileSync(
  join(process.cwd(), 'src/app/api/admin/users/[id]/route.ts'),
  'utf8',
)

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

  it('shows generated WhatsApp PIN availability without exposing it in the user list', () => {
    expect(adminUsersRoute).toContain(".from('whatsapp_config')")
    expect(adminUsersRoute).toContain('two_step_pin_encrypted')
    expect(adminUsersRoute).toContain('has_whatsapp_pin')
    expect(adminUsersPage).toContain('WhatsApp PIN')
    expect(adminUsersPage).toContain('Reveal PIN')
    expect(adminUsersPage).toContain('has_whatsapp_pin?')
  })

  it('reveals a PIN only through the approved-admin detail route', () => {
    expect(adminUserDetailRoute).toContain('export async function GET')
    expect(adminUserDetailRoute).toContain('const adminCheck = await requireAdmin()')
    expect(adminUserDetailRoute).toContain('decrypt(config.two_step_pin_encrypted)')
    expect(adminUserDetailRoute).toContain("'Cache-Control': 'private, no-store, max-age=0'")
    expect(adminUsersPage).toContain('cache: "no-store"')
  })

  it('leaves team member listing under the workspace team page path', () => {
    expect(teamServer).toContain('listWorkspaceMembers')
    expect(teamServer).toContain(".from('workspace_members')")
    expect(teamServer).toContain('.eq(\'workspace_id\', workspaceId)')
  })
})
