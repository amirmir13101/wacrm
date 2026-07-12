import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('first-month Pro promotional pricing', () => {
  const root = process.cwd()
  const migration = readFileSync(
    join(root, 'supabase/migrations/060_first_month_pro_promo.sql'),
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
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS first_month_promo_used_at')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS original_amount')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS charged_amount')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS is_first_month_promo')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS promo_type')
    expect(migration).not.toContain('DROP TABLE')
    expect(migration).not.toContain('TRUNCATE')
  })

  it('backfills approved old $1 Pro payments as promo-used but not rejected payments', () => {
    expect(migration).toContain("request.plan_type = 'pro'")
    expect(migration).toContain('request.status = \'approved\'')
    expect(migration).toContain('request.amount <= 1.00')
    expect(migration).toContain('workspace.first_month_promo_used_at IS NULL')
  })

  it('marks promo used only inside the successful Pro approval transaction', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.approve_manual_pro_payment')
    expect(migration).toContain('payment.is_first_month_promo = TRUE')
    expect(migration).toContain('first_month_promo_used_at = CASE')
    expect(migration).toContain('COALESCE(workspace.first_month_promo_used_at, p_now)')
    expect(migration).toContain('promo_already_used')
    expect(migration).toContain('already used the first-month promotion')
  })

  it('requires renewal payments to be $9.90 after promo use', () => {
    expect(migration).toContain('charged < 9.90')
    expect(migration).toContain('Monthly renewal payment must be $9.90/month')
    expect(migration).toContain('Monthly renewal price: $9.90/month')
  })

  it('calculates checkout amount server-side and does not trust a frontend amount', () => {
    expect(checkoutRoute).toContain('isFirstMonthPromoEligible')
    expect(checkoutRoute).toContain('getManualCheckoutPricing')
    expect(checkoutRoute).toContain('amount: pricing.amount')
    expect(checkoutRoute).toContain('charged_amount: pricing.chargedAmount')
    expect(checkoutRoute).toContain('is_first_month_promo: pricing.isFirstMonthPromo')
    expect(checkoutRoute).not.toContain('readString(body.amount)')
    expect(checkoutRoute).not.toContain('amount: body.amount')
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
})
