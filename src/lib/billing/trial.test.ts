import { describe, expect, it } from 'vitest'

import { calculateTrialStatus, trialBlockMessage } from './trial'

describe('workspace trial status', () => {
  const now = new Date('2026-06-14T00:00:00.000Z')

  it('calculates remaining trial days and broadcast messages', () => {
    const status = calculateTrialStatus(
      {
        id: 'workspace-1',
        plan_type: 'trial',
        subscription_status: 'trialing',
        billing_period: null,
        subscription_started_at: null,
        subscription_ends_at: null,
        trial_started_at: '2026-06-14T00:00:00.000Z',
        trial_ends_at: '2026-06-23T00:00:00.000Z',
        trial_broadcast_limit: 1000,
        trial_broadcast_used: 430,
      },
      now,
    )

    expect(status.isTrial).toBe(true)
    expect(status.trialDaysRemaining).toBe(9)
    expect(status.trialBroadcastRemaining).toBe(570)
    expect(status.isTrialLimitReached).toBe(false)
  })

  it('detects expired trials', () => {
    const status = calculateTrialStatus(
      {
        id: 'workspace-1',
        plan_type: 'trial',
        subscription_status: 'trialing',
        billing_period: null,
        subscription_started_at: null,
        subscription_ends_at: null,
        trial_started_at: '2026-05-01T00:00:00.000Z',
        trial_ends_at: '2026-05-15T00:00:00.000Z',
        trial_broadcast_limit: 1000,
        trial_broadcast_used: 100,
      },
      now,
    )

    expect(status.isTrialExpired).toBe(true)
    expect(status.trialDaysRemaining).toBe(0)
  })

  it('marks Pro workspaces as unlimited from the CRM side', () => {
    const status = calculateTrialStatus(
      {
        id: 'workspace-1',
        plan_type: 'pro',
        subscription_status: 'active',
        billing_period: 'monthly',
        subscription_started_at: '2026-06-01T00:00:00.000Z',
        subscription_ends_at: '2026-07-01T00:00:00.000Z',
        trial_started_at: '2026-06-14T00:00:00.000Z',
        trial_ends_at: '2026-06-28T00:00:00.000Z',
        trial_broadcast_limit: 1000,
        trial_broadcast_used: 1000,
      },
      now,
    )

    expect(status.isTrial).toBe(false)
    expect(status.isActivePro).toBe(true)
    expect(status.isProExpired).toBe(false)
    expect(status.hasTrialBroadcastLimit).toBe(false)
    expect(status.trialBroadcastRemaining).toBeNull()
  })

  it('does not treat expired Pro workspaces as active Pro', () => {
    const status = calculateTrialStatus(
      {
        id: 'workspace-1',
        plan_type: 'pro',
        subscription_status: 'active',
        billing_period: 'monthly',
        subscription_started_at: '2026-05-01T00:00:00.000Z',
        subscription_ends_at: '2026-06-01T00:00:00.000Z',
        trial_started_at: '2026-05-01T00:00:00.000Z',
        trial_ends_at: '2026-05-15T00:00:00.000Z',
        trial_broadcast_limit: 1000,
        trial_broadcast_used: 1000,
      },
      now,
    )

    expect(status.isActivePro).toBe(false)
    expect(status.isProExpired).toBe(true)
    expect(status.hasTrialBroadcastLimit).toBe(false)
  })

  it('treats Lifetime as a self-hosted setup request instead of hosted unlimited access', () => {
    const status = calculateTrialStatus(
      {
        id: 'workspace-1',
        plan_type: 'lifetime',
        subscription_status: 'manual',
        billing_period: 'lifetime_setup',
        subscription_started_at: null,
        subscription_ends_at: null,
        trial_started_at: '2026-06-14T00:00:00.000Z',
        trial_ends_at: '2026-06-28T00:00:00.000Z',
        trial_broadcast_limit: 1000,
        trial_broadcast_used: 0,
      },
      now,
    )

    expect(status.isLifetimeSetup).toBe(true)
    expect(status.isActivePro).toBe(false)
  })

  it('returns clear beginner-friendly trial block messages', () => {
    expect(trialBlockMessage({ reason: 'trial_expired' })).toMatch(/14-day free trial has ended/)
    expect(trialBlockMessage({ reason: 'pro_expired' })).toMatch(/Pro plan has expired/)
    expect(trialBlockMessage({ reason: 'trial_limit_exceeded', remaining: 100 })).toContain(
      'You have 100 remaining',
    )
  })
})
