export type BillingPlanType = 'trial' | 'pro' | 'lifetime' | string | null | undefined
export type BillingSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'manual'
  | string
  | null
  | undefined
export type BillingPeriod = 'monthly' | 'yearly' | 'lifetime_setup' | string | null | undefined

export interface WorkspaceBillingAccessRow {
  plan_type?: BillingPlanType
  subscription_status?: BillingSubscriptionStatus
  billing_period?: BillingPeriod
  trial_ends_at?: string | null
  subscription_ends_at?: string | null
}

export interface WorkspaceBillingAccess {
  canUseHostedCrm: boolean
  reason: 'active_trial' | 'active_pro' | 'expired_trial' | 'expired_pro' | 'lifetime_setup' | 'unknown'
  message?: string
}

export function evaluateWorkspaceBillingAccess(
  row: WorkspaceBillingAccessRow | null | undefined,
  now = new Date(),
): WorkspaceBillingAccess {
  if (!row) {
    return {
      canUseHostedCrm: false,
      reason: 'unknown',
      message: 'Workspace plan status is unavailable. Please contact support.',
    }
  }

  const planType = row.plan_type ?? 'trial'
  const subscriptionStatus = row.subscription_status ?? 'trialing'
  const billingPeriod = row.billing_period ?? null
  const trialEndsAt = row.trial_ends_at ? new Date(row.trial_ends_at) : null
  const subscriptionEndsAt = row.subscription_ends_at ? new Date(row.subscription_ends_at) : null

  if (planType === 'pro') {
    const active =
      subscriptionStatus === 'active' &&
      (billingPeriod === 'monthly' || billingPeriod === 'yearly') &&
      Boolean(subscriptionEndsAt && subscriptionEndsAt > now)

    if (active) return { canUseHostedCrm: true, reason: 'active_pro' }

    return {
      canUseHostedCrm: false,
      reason: 'expired_pro',
      message: 'Your Pro plan has expired. Renew your Pro plan to continue using CRM features.',
    }
  }

  if (planType === 'lifetime' || billingPeriod === 'lifetime_setup') {
    return {
      canUseHostedCrm: false,
      reason: 'lifetime_setup',
      message:
        'Lifetime is a self-hosted setup request. Hosted CRM access requires an active Trial or Pro plan.',
    }
  }

  if (subscriptionStatus === 'trialing' && trialEndsAt && trialEndsAt > now) {
    return { canUseHostedCrm: true, reason: 'active_trial' }
  }

  return {
    canUseHostedCrm: false,
    reason: 'expired_trial',
    message: 'Your 14-day free trial has ended. Upgrade to Pro to continue using CRM features.',
  }
}

export function isBillingLockAllowedPath(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/billing') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/api/billing') ||
    pathname.startsWith('/api/payments') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/team/workspaces')
  )
}
