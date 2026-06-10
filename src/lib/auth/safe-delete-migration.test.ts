import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/025_safe_delete_users_and_invitations.sql'),
  'utf8',
)

describe('safe delete migration', () => {
  it('adds soft-delete metadata to profiles without hard-deleting history', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS deleted_at')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS deleted_by')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS delete_reason')
    expect(migration).toContain("'deleted'")
  })

  it('adds soft-delete metadata to workspace invitations', () => {
    expect(migration).toContain('ALTER TABLE workspace_invitations')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS deleted_at')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users')
  })
})
