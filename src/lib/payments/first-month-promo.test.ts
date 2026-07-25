import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('first-month Pro promotional pricing', () => {
  const root = process.cwd()
  const migration = readFileSync(
    join(root, 'supabase/migrations/062_billing_offer_eligibility.sql'),
    'utf8',
  )
  const checkoutRoute = readFileSync(
    join(root, 'src/app/api/payments/manual/route.ts'),
    'utf8',
  )
  const adminRoute = readFileSync(
    join(root, 'src/app/api/admin/payments/route.ts'),
    'utf8',
  )
  const adminReviewRoute = readFileSync(
    join(root, 'src/app/api/admin/payments/[id]/route.ts'),
    'utf8',
  )
  const checkoutForm = readFileSync(
    join(root, 'src/components/checkout/manual-checkout-form.tsx'),
    'utf8',
  )
  const checkoutConfig = readFileSync(
    join(root, 'src/lib/payments/manual-payment-config.ts'),
    'utf8',
  )

  it('adds additive promo tracking fields without deleting payment history', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.billing_offer_redemptions')
    expect(migration).toContain("'free_trial_14_day'")
    expect(migration).toContain("'pro_first_month'")
    expect(migration).toContain('ON DELETE SET NULL')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS normalized_email')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS normalized_phone')
    expect(migration).not.toContain('DROP TABLE')
    expect(migration).not.toContain('TRUNCATE')
  })

  it('backfills historical free trials and approved old $1 Pro payments', () => {
    expect(migration).toContain("'free_trial_14_day'")
    expect(migration).toContain('workspace.trial_started_at')
    expect(migration).toContain("request.plan_type = 'pro'")
    expect(migration).toContain('request.status = \'approved\'')
    expect(migration).toContain('request.amount <= 1.00')
    expect(migration).toContain('workspace.first_month_promo_used_at IS NOT NULL')
  })

  it('marks promo used only inside the successful Pro approval transaction', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.approve_manual_pro_payment')
    expect(migration).toContain('payment.is_first_month_promo = TRUE')
    expect(migration).toContain("SELECT public.redeem_billing_offer(")
    expect(migration).toContain("'manual_payment'")
    expect(migration).toContain('IF redemption_id IS NULL')
    expect(migration).toContain('first-month promotion')
  })

  it('validates renewals against the server-created current-price snapshot', () => {
    expect(migration).toContain('expected_regular_amount')
    expect(migration).toContain('charged <> expected_regular_amount')
    expect(migration).toContain('current regular monthly checkout price')
    expect(migration).not.toContain('charged < 9.90')
  })

  it('calculates checkout amount server-side and does not trust a frontend amount', () => {
    expect(checkoutRoute).toContain('isBillingOfferEligible')
    expect(checkoutRoute).toContain('PRO_FIRST_MONTH_OFFER_CODE')
    expect(checkoutRoute).toContain('getManualCheckoutPricing')
    expect(checkoutRoute).toContain('amount: pricing.amount')
    expect(checkoutRoute).toContain('charged_amount: pricing.chargedAmount')
    expect(checkoutRoute).toContain('is_first_month_promo: pricing.isFirstMonthPromo')
    expect(checkoutRoute).not.toContain('readString(body.amount)')
    expect(checkoutRoute).not.toContain('amount: body.amount')
    expect(checkoutRoute).toContain('expected_charged_amount')
    expect(checkoutRoute).toContain('hasMatchingPendingManualRequest')
    expect(checkoutRoute).toContain(
      'An account already exists with this email. Please login first, then submit checkout again.',
    )
    expect(checkoutRoute).not.toContain("account_type: 'workspace_owner',\n        updated_at: now")
  })

  it('exposes safe promo status to checkout and admin review UI', () => {
    expect(checkoutRoute).toContain('export async function GET')
    expect(checkoutForm).toContain('/api/payments/manual?plan_type=')
    expect(checkoutForm).toContain('pricingPreview?.renewalMessage')
    expect(checkoutConfig).toContain('Your first-month promotion has already been used')
    expect(adminRoute).toContain('is_first_month_promo')
    expect(adminRoute).toContain('pricing_label')
    expect(adminReviewRoute).toContain(".rpc('approve_manual_pro_payment'")
  })

  it('prevents trial and promo reuse across durable customer and provider identities', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.billing_offer_is_eligible')
    expect(migration).toContain('normalized_email')
    expect(migration).toContain('normalized_phone')
    expect(migration).toContain('provider_customer_hash')
    expect(migration).toContain('payment_method_fingerprint_hash')
    expect(migration).toContain("'automated_payment'")
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.enforce_single_workspace_trial')
    expect(migration).toContain('enforce_single_workspace_trial_on_insert')
  })
})
