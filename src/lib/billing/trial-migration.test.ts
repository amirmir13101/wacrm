import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('workspace trial migration', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/029_workspace_trial_broadcast_usage.sql'),
    'utf8',
  )
  const subscriptionMigration = readFileSync(
    join(process.cwd(), 'supabase/migrations/032_workspace_subscription_expiry.sql'),
    'utf8',
  )
  const monthlyUsageMigration = readFileSync(
    join(process.cwd(), 'supabase/migrations/054_workspace_monthly_broadcast_usage.sql'),
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

  it('adds hosted Pro subscription expiry fields without making Lifetime a hosted plan', () => {
    expect(subscriptionMigration).toContain('ADD COLUMN IF NOT EXISTS subscription_started_at')
    expect(subscriptionMigration).toContain('ADD COLUMN IF NOT EXISTS subscription_ends_at')
    expect(subscriptionMigration).toContain('ADD COLUMN IF NOT EXISTS billing_period')
    expect(subscriptionMigration).toContain("billing_period IN ('monthly', 'yearly', 'lifetime_setup')")
    expect(subscriptionMigration).toContain('ADD COLUMN IF NOT EXISTS billing_period')
    expect(subscriptionMigration).toContain("plan_type = 'lifetime'")
    expect(subscriptionMigration).toContain("'lifetime_setup'")
  })

  it('only treats non-expired active Pro as unlimited for broadcast usage', () => {
    expect(subscriptionMigration).toContain("workspace_row.plan_type = 'pro'")
    expect(subscriptionMigration).toContain('workspace_row.subscription_ends_at > NOW()')
    expect(subscriptionMigration).toContain("'pro_expired'")
    expect(subscriptionMigration).toContain("'lifetime_setup_not_hosted'")
    expect(subscriptionMigration).not.toContain("workspace_row.plan_type IN ('pro', 'lifetime')")
    expect(subscriptionMigration).not.toContain("workspace_row.subscription_status IN ('active', 'manual') THEN")
  })

  it('adds workspace-scoped monthly Pro broadcast usage with an atomic reserve function', () => {
    expect(monthlyUsageMigration).toContain('CREATE TABLE IF NOT EXISTS public.workspace_broadcast_usage')
    expect(monthlyUsageMigration).toContain('workspace_id UUID NOT NULL REFERENCES public.workspaces')
    expect(monthlyUsageMigration).toContain('period_start DATE NOT NULL')
    expect(monthlyUsageMigration).toContain('messages_used INTEGER NOT NULL DEFAULT 0')
    expect(monthlyUsageMigration).toContain('public.workspace_has_permission(workspace_id, \'view_broadcasts\')')
    expect(monthlyUsageMigration).toContain('CREATE OR REPLACE FUNCTION public.reserve_workspace_broadcast_usage')
    expect(monthlyUsageMigration).toContain('pro_limit INTEGER := 250000')
    expect(monthlyUsageMigration).toContain('FOR UPDATE')
    expect(monthlyUsageMigration).toContain("'pro_limit_exceeded'")
    expect(monthlyUsageMigration).toContain('date_trunc(\'month\'')
    expect(monthlyUsageMigration).toContain('CREATE OR REPLACE FUNCTION public.release_workspace_broadcast_usage')
  })
})
