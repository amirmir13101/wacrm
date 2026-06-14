import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('workspace trial migration', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/029_workspace_trial_broadcast_usage.sql'),
    'utf8',
  )

  it('adds workspace plan and trial broadcast usage fields', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS plan_type')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS subscription_status')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS trial_started_at')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS trial_ends_at')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS trial_broadcast_limit')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS trial_broadcast_used')
  })

  it('creates atomic reserve and release functions for broadcast usage', () => {
    expect(migration).toContain('reserve_workspace_trial_broadcast_usage')
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('trial_limit_exceeded')
    expect(migration).toContain('trial_expired')
    expect(migration).toContain('release_workspace_trial_broadcast_usage')
  })
})
