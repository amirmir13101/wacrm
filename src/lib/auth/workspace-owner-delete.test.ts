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

describe('workspace archive support and owner permanent delete', () => {
  it('adds archive metadata and blocks archived workspaces in RLS helpers', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS archived_at')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS archived_by')
    expect(migration).toContain('archive_reason')
    expect(migration).toContain('AND w.archived_at IS NULL')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.is_active_workspace_member')
  })

  it('requires permanent delete confirmation and deletes the auth user', () => {
    expect(adminUserRoute).toContain("confirmation !== 'PERMANENT DELETE'")
    expect(adminUserRoute).toContain('admin.auth.admin.deleteUser(target.user_id)')
    expect(adminUserRoute).toContain('deleted_user_id: target.user_id')
    expect(adminUserRoute).not.toContain('transferOwnedWorkspaces')
    expect(adminUserRoute).not.toContain('archiveOwnedWorkspaces')
  })

  it('blocks archived workspaces from server and middleware workspace resolution', () => {
    expect(teamServer).toContain('workspaceIsArchived')
    expect(teamServer).toContain('!workspaceIsArchived(row.workspace)')
    expect(middleware).toContain('workspaceIsArchived')
    expect(middleware).toContain('!workspaceIsArchived(row.workspace)')
  })

  it('shows permanent delete UI and refreshes after success', () => {
    expect(adminUsersPage).toContain('PermanentDeleteModal')
    expect(adminUsersPage).toContain('PERMANENT DELETE')
    expect(adminUsersPage).toContain('owned_workspaces_count')
    expect(adminUsersPage).toContain('database cascades')
    expect(adminUsersPage).toContain('await loadUsers()')
    expect(adminUsersPage).toContain('Deleting...')
  })
})
