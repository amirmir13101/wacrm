import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const adminUserRoute = readFileSync(
  join(process.cwd(), 'src/app/api/admin/users/[id]/route.ts'),
  'utf8',
)
const adminUsersRoute = readFileSync(
  join(process.cwd(), 'src/app/api/admin/users/route.ts'),
  'utf8',
)
const invitationsRoute = readFileSync(
  join(process.cwd(), 'src/app/api/team/invitations/route.ts'),
  'utf8',
)
const adminUsersPage = readFileSync(
  join(process.cwd(), 'src/app/admin/users/page.tsx'),
  'utf8',
)
const teamPage = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/team/page.tsx'),
  'utf8',
)

describe('safe delete routes and UI', () => {
  it('soft-deletes platform users and blocks unsafe admin actions', () => {
    expect(adminUserRoute).toContain('export async function DELETE')
    expect(adminUserRoute).toContain('requireAdmin()')
    expect(adminUserRoute).toContain('target.user_id === adminCheck.user.id')
    expect(adminUserRoute).toContain('You cannot delete your own platform admin account')
    expect(adminUserRoute).toContain(".from('workspaces')")
    expect(adminUserRoute).toContain('requires_owner_action: true')
    expect(adminUserRoute).toContain('owned_workspaces: ownedWorkspaceDetails')
    expect(adminUserRoute).toContain("approval_status: 'deleted'")
    expect(adminUserRoute).toContain("deleted_at: deletedAt")
    expect(adminUserRoute).toContain(".from('workspace_members')")
    expect(adminUserRoute).toContain(".update({ status: 'suspended' })")
  })

  it('hides deleted users from the default admin users list', () => {
    expect(adminUsersRoute).toContain("query.neq('approval_status', 'deleted')")
    expect(adminUsersRoute).toContain("status === 'deleted'")
  })

  it('requires a clear confirmation before deleting users in the UI', () => {
    expect(adminUsersPage).toContain('Type DELETE to confirm')
    expect(adminUsersPage).toContain('typed !== "DELETE"')
    expect(adminUsersPage).toContain('method: "DELETE"')
  })

  it('soft-deletes invitations and blocks accepted invite deletion', () => {
    expect(invitationsRoute).toContain('export async function DELETE')
    expect(invitationsRoute).toContain('canManageTeamWithPermissions')
    expect(invitationsRoute).toContain("invitation.status === 'accepted'")
    expect(invitationsRoute).toContain('Accepted invitations are kept for audit history')
    expect(invitationsRoute).toContain("update.status = 'revoked'")
    expect(invitationsRoute).toContain('deleted_at')
  })

  it('shows revoke and delete actions for invitations in team UI', () => {
    expect(teamPage).toContain('async function deleteInvite')
    expect(teamPage).toContain('Delete this invitation from the list')
    expect(teamPage).toContain('onDelete={deleteInvite}')
    expect(teamPage).toContain('Kept for audit')
  })
})
