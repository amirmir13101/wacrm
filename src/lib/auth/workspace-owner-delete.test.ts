import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/026_workspace_archive_owner_delete.sql'),
  'utf8',
)
const adminUserRoute = readFileSync(
  join(process.cwd(), 'src/app/api/admin/users/[id]/route.ts'),
  'utf8',
)
const adminUsersPage = readFileSync(
  join(process.cwd(), 'src/app/admin/users/page.tsx'),
  'utf8',
)
const teamServer = readFileSync(join(process.cwd(), 'src/lib/team/server.ts'), 'utf8')
const middleware = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')

describe('workspace owner safe delete options', () => {
  it('adds archive metadata and blocks archived workspaces in RLS helpers', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS archived_at')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS archived_by')
    expect(migration).toContain('archive_reason')
    expect(migration).toContain('AND w.archived_at IS NULL')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.is_active_workspace_member')
  })

  it('returns owner delete options instead of hard-deleting workspace owners', () => {
    expect(adminUserRoute).toContain('requires_owner_action: true')
    expect(adminUserRoute).toContain('owned_workspaces: ownedWorkspaceDetails')
    expect(adminUserRoute).toContain("action === 'transfer_delete'")
    expect(adminUserRoute).toContain("action === 'archive_delete'")
    expect(adminUserRoute).not.toContain('deleteUser(')
  })

  it('transfers workspace ownership before soft-deleting the old owner', () => {
    expect(adminUserRoute).toContain('transferOwnedWorkspaces')
    expect(adminUserRoute).toContain('owner_user_id: newOwnerUserId')
    expect(adminUserRoute).toContain("role: 'owner'")
    expect(adminUserRoute).toContain(".update({ role: 'agent', status: 'suspended' })")
  })

  it('archives workspaces and suspends members before soft-deleting the owner', () => {
    expect(adminUserRoute).toContain('archiveOwnedWorkspaces')
    expect(adminUserRoute).toContain("confirmation !== 'ARCHIVE DELETE'")
    expect(adminUserRoute).toContain('archived_at: archivedAt')
    expect(adminUserRoute).toContain("archive_reason: reason")
    expect(adminUserRoute).toContain(".update({ status: 'suspended' })")
  })

  it('blocks archived workspaces from server and middleware workspace resolution', () => {
    expect(teamServer).toContain('workspaceIsArchived')
    expect(teamServer).toContain('!workspaceIsArchived(row.workspace)')
    expect(middleware).toContain('workspaceIsArchived')
    expect(middleware).toContain('!workspaceIsArchived(row.workspace)')
  })

  it('shows transfer/archive UI and refreshes after success', () => {
    expect(adminUsersPage).toContain('OwnerDeleteModal')
    expect(adminUsersPage).toContain('Transfer ownership')
    expect(adminUsersPage).toContain('Archive workspace and delete')
    expect(adminUsersPage).toContain('ARCHIVE DELETE')
    expect(adminUsersPage).toContain('await loadUsers()')
    expect(adminUsersPage).toContain('Deleting...')
    expect(adminUsersPage).toContain('Archiving...')
  })
})
