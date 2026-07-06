import { describe, expect, it } from 'vitest'

import { evaluateWorkspaceBillingAccess, isBillingLockAllowedPath } from './access'

describe('workspace billing access', () => {
  const now = new Date('2026-07-06T00:00:00.000Z')

  it('allows active trial workspaces during the 14-day trial window', () => {
    const access = evaluateWorkspaceBillingAccess(
      {
        plan_type: 'trial',
        subscription_status: 'trialing',
        trial_ends_at: '2026-07-10T00:00:00.000Z',
      },
      now,
    )

    expect(access.canUseHostedCrm).toBe(true)
    expect(access.reason).toBe('active_trial')
  })

  it('blocks expired trial workspaces while still allowing upgrade-safe paths', () => {
    const access = evaluateWorkspaceBillingAccess(
      {
        plan_type: 'trial',
        subscription_status: 'trialing',
        trial_ends_at: '2026-07-01T00:00:00.000Z',
      },
      now,
    )

    expect(access.canUseHostedCrm).toBe(false)
    expect(access.reason).toBe('expired_trial')
    expect(access.message).toMatch(/14-day free trial has ended/)
    expect(isBillingLockAllowedPath('/dashboard')).toBe(true)
    expect(isBillingLockAllowedPath('/billing')).toBe(true)
    expect(isBillingLockAllowedPath('/checkout/pro')).toBe(true)
    expect(isBillingLockAllowedPath('/broadcasts')).toBe(false)
  })

  it('allows active non-expired Pro workspaces and blocks expired Pro', () => {
    expect(
      evaluateWorkspaceBillingAccess(
        {
          plan_type: 'pro',
          subscription_status: 'active',
          billing_period: 'monthly',
          subscription_ends_at: '2026-08-06T00:00:00.000Z',
        },
        now,
      ).canUseHostedCrm,
    ).toBe(true)

    const expired = evaluateWorkspaceBillingAccess(
      {
        plan_type: 'pro',
        subscription_status: 'active',
        billing_period: 'monthly',
        subscription_ends_at: '2026-07-01T00:00:00.000Z',
      },
      now,
    )

    expect(expired.canUseHostedCrm).toBe(false)
    expect(expired.reason).toBe('expired_pro')
  })
})
