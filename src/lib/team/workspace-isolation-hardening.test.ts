import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('active workspace isolation hardening', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/056_workspace_isolation_hardening.sql'),
    'utf8',
  )
  const invitations = readFileSync(join(process.cwd(), 'src/lib/team/invitations.ts'), 'utf8')
  const server = readFileSync(join(process.cwd(), 'src/lib/team/server.ts'), 'utf8')

  it('requires permission and membership helpers to match the selected workspace', () => {
    expect(migration).toContain('p.active_workspace_id = p_workspace_id')
    expect(migration).toContain('public.current_active_workspace_id() = self.workspace_id')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.workspace_has_permission')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.is_active_workspace_member')
  })

  it('uses the selected workspace for default workspace triggers', () => {
    expect(migration).toContain('SELECT p.active_workspace_id')
    expect(migration).not.toContain('ORDER BY wm.joined_at ASC')
  })

  it('classifies accepted invite accounts as team members and selects the invited workspace', () => {
    expect(invitations).toContain("account_type: 'team_member'")
    expect(invitations).toContain('active_workspace_id: invitation.workspace_id')
    expect(migration).toContain("account_type = 'team_member'")
    expect(server).toContain("profile?.account_type !== 'team_member' || row.role !== 'owner'")
  })
})
