import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/024_workspace_invitations.sql'),
  'utf8',
)

describe('workspace invitations migration', () => {
  it('creates a secure invitation table with hashed token storage', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS workspace_invitations')
    expect(migration).toContain('token_hash TEXT NOT NULL')
    expect(migration).toContain('expires_at TIMESTAMPTZ NOT NULL')
    expect(migration).toContain("status TEXT NOT NULL DEFAULT 'pending'")
    expect(migration).toContain('accepted_by_user_id UUID')
  })

  it('adds active workspace selection to profiles', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS active_workspace_id UUID')
    expect(migration).toContain('UPDATE profiles p')
    expect(migration).toContain('active_workspace_id = w.id')
  })

  it('backfills approved normal users as owners of their own workspace', () => {
    expect(migration).toContain("WHERE p.approval_status = 'approved'")
    expect(migration).toContain("role = 'owner'")
    expect(migration).toContain("status = 'active'")
    expect(migration).toContain("contact_visibility = 'all'")
    expect(migration).toContain("conversation_visibility = 'all'")
    expect(migration).toContain("deal_visibility = 'all'")
  })

  it('protects invite rows with manager permission RLS', () => {
    expect(migration).toContain('ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain("public.workspace_has_permission(workspace_id, 'manage_team_members')")
  })
})
