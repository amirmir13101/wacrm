import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('manual payment flow wiring', () => {
  const root = process.cwd()
  const migration = readFileSync(
    join(root, 'supabase/migrations/030_manual_payment_requests.sql'),
    'utf8',
  )
  const checkoutRoute = readFileSync(
    join(root, 'src/app/api/payments/manual/route.ts'),
    'utf8',
  )
  const adminReviewRoute = readFileSync(
    join(root, 'src/app/api/admin/payments/[id]/route.ts'),
    'utf8',
  )
  const pricingPage = readFileSync(join(root, 'src/app/pricing/page.tsx'), 'utf8')
  const trialCard = readFileSync(
    join(root, 'src/components/billing/trial-usage-card.tsx'),
    'utf8',
  )

  it('creates an RLS-protected manual payment request table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS manual_payment_requests')
    expect(migration).toContain("plan_type IN ('pro', 'lifetime')")
    expect(migration).toContain("payment_method IN ('easypaisa', 'bank_transfer')")
    expect(migration).toContain('ALTER TABLE manual_payment_requests ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('Platform admins manage manual payment requests')
  })

  it('validates manual checkout server-side without Stripe or PayPal', () => {
    expect(checkoutRoute).toContain('getManualCheckoutPlan')
    expect(checkoutRoute).toContain('getManualPaymentMethod')
    expect(checkoutRoute).toContain('manual_payment_requests')
    expect(checkoutRoute.toLowerCase()).not.toContain('stripe')
    expect(checkoutRoute.toLowerCase()).not.toContain('paypal')
  })

  it('lets platform admins approve requests and activate workspace plans', () => {
    expect(adminReviewRoute).toContain('requirePlatformAdmin')
    expect(adminReviewRoute).toContain("plan_type: paymentRequest.plan_type")
    expect(adminReviewRoute).toContain("subscription_status: subscriptionStatus")
    expect(adminReviewRoute).toContain('ensureApprovedUserOwnWorkspace')
    expect(adminReviewRoute).toContain("status: 'rejected'")
  })

  it('routes Pro and Lifetime pricing CTAs to manual checkout', () => {
    expect(pricingPage).toContain('href: "/checkout/pro"')
    expect(pricingPage).toContain('href: "/checkout/lifetime"')
    expect(trialCard).toContain('href="/checkout/pro"')
  })
})
