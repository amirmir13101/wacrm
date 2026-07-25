import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('manual payment flow wiring', () => {
  const root = process.cwd()
  const migration = readFileSync(
    join(root, 'supabase/migrations/030_manual_payment_requests.sql'),
    'utf8',
  )
  const linkingMigration = readFileSync(
    join(root, 'supabase/migrations/031_manual_payment_customer_linking.sql'),
    'utf8',
  )
  const subscriptionMigration = readFileSync(
    join(root, 'supabase/migrations/032_workspace_subscription_expiry.sql'),
    'utf8',
  )
  const approvalMigration = readFileSync(
    join(root, 'supabase/migrations/014_account_approval.sql'),
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
  const adminPaymentsPage = readFileSync(join(root, 'src/app/admin/payments/page.tsx'), 'utf8')
  const checkoutForm = readFileSync(
    join(root, 'src/components/checkout/manual-checkout-form.tsx'),
    'utf8',
  )
  const checkoutPage = readFileSync(join(root, 'src/app/checkout/[plan]/page.tsx'), 'utf8')
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

  it('stores checkout customer account fields for linking', () => {
    expect(linkingMigration).toContain('ADD COLUMN IF NOT EXISTS phone')
    expect(linkingMigration).toContain('ADD COLUMN IF NOT EXISTS company_name')
    expect(linkingMigration).toContain('ADD COLUMN IF NOT EXISTS auth_user_created')
  })

  it('stores hosted Pro billing periods separately from lifetime setup requests', () => {
    expect(subscriptionMigration).toContain('ALTER TABLE manual_payment_requests')
    expect(subscriptionMigration).toContain('ADD COLUMN IF NOT EXISTS billing_period')
    expect(subscriptionMigration).toContain("billing_period IS NULL OR billing_period IN ('monthly', 'yearly', 'lifetime_setup')")
    expect(subscriptionMigration).toContain("WHEN plan_type = 'pro' THEN 'monthly'")
    expect(subscriptionMigration).toContain("WHEN plan_type = 'lifetime' THEN 'lifetime_setup'")
  })

  it('keeps normal signup profiles pending until admin approval', () => {
    expect(approvalMigration).toContain('CREATE OR REPLACE FUNCTION public.handle_new_user()')
    expect(approvalMigration).toContain("'pending'")
    expect(approvalMigration).toContain('pending approval status')
  })

  it('validates manual checkout server-side without Stripe or PayPal', () => {
    expect(checkoutRoute).toContain('getManualCheckoutPlan')
    expect(checkoutRoute).toContain('getManualPaymentMethod')
    expect(checkoutRoute).toContain('manual_payment_requests')
    expect(checkoutRoute).toContain('requestedBillingPeriod')
    expect(checkoutRoute).not.toContain("requestedBillingPeriod === 'yearly'")
    expect(checkoutRoute).toContain('billing_period: plan.billingPeriod')
    expect(checkoutRoute).toContain('admin.auth.admin.createUser')
    expect(checkoutRoute).toContain('ensureCheckoutWorkspace')
    expect(checkoutRoute).toContain('requireCurrentWorkspace')
    expect(checkoutRoute).toContain('workspaceResult.workspace.workspaceId')
    expect(checkoutRoute).toContain('phone')
    expect(checkoutRoute).toContain('passwordValidationError')
    expect(checkoutRoute).toContain("approval_status: 'pending'")
    expect(checkoutRoute).toContain("plan_type: 'trial'")
    expect(checkoutRoute).toContain("subscription_status: 'trialing'")
    expect(checkoutRoute).not.toContain("approval_status: 'approved'")
    expect(checkoutRoute).not.toContain("subscription_status: 'active',")
    expect(checkoutRoute.toLowerCase()).not.toContain('stripe')
    expect(checkoutRoute.toLowerCase()).not.toContain('paypal')
  })

  it('lets platform admins approve Pro customers and activate monthly or yearly workspace plans', () => {
    expect(adminReviewRoute).toContain('requirePlatformAdmin')
    expect(adminReviewRoute).toContain('approve_manual_pro_payment')
    expect(adminReviewRoute).toContain("paymentRequest.plan_type === 'pro'")
    expect(adminReviewRoute).toContain(".rpc('approve_manual_pro_payment'")
    expect(adminReviewRoute).toContain("status: 'rejected'")
    expect(adminReviewRoute).not.toContain('Ask the customer to sign up or login')
  })

  it('keeps Lifetime approval as a self-hosted setup request instead of hosted lifetime access', () => {
    expect(adminReviewRoute).toContain("paymentRequest.plan_type === 'pro'")
    expect(adminReviewRoute).not.toContain("plan_type: paymentRequest.plan_type")
    expect(adminReviewRoute).not.toContain("plan_type: 'lifetime'")
    expect(adminReviewRoute).not.toContain('Lifetime plan active')
  })

  it('lets platform admins delete manual payment request records without deleting users or workspaces', () => {
    expect(adminReviewRoute).toContain('export async function DELETE')
    expect(adminReviewRoute).toContain('requirePlatformAdmin')
    expect(adminReviewRoute).toContain('manual_payment_requests')
    expect(adminReviewRoute).toContain('.delete()')
    expect(adminReviewRoute).not.toContain("paymentRequest.status === 'approved'")
    expect(adminReviewRoute).not.toContain('Approved payment requests are kept for audit history')
    expect(adminReviewRoute).not.toContain('auth.admin.deleteUser')
    expect(adminReviewRoute).not.toContain(".from('workspaces').delete")
    expect(adminReviewRoute).not.toContain(".from('profiles').delete")
  })

  it('updates the admin payment list without requiring a browser refresh', () => {
    expect(adminPaymentsPage).toContain('paymentBelongsInCurrentFilter')
    expect(adminPaymentsPage).toContain('setRequests((current) =>')
    expect(adminPaymentsPage).toContain('deleteRequest')
    expect(adminPaymentsPage).toContain('method: "DELETE"')
    expect(adminPaymentsPage).toContain('setRequests((current) => current.filter')
    expect(adminPaymentsPage).toContain('window.confirm')
    expect(adminPaymentsPage).toContain('Are you sure you want to delete this approved manual payment record?')
    expect(adminPaymentsPage).not.toContain('Approved payment requests are kept for audit history')
    expect(adminPaymentsPage).not.toContain('disabled={savingId === request.id || request.status === "approved"}')
  })

  it('routes Pro monthly and Lifetime setup pricing CTAs to manual checkout without public yearly pricing', () => {
    expect(pricingPage).toContain('href: "/checkout/pro"')
    expect(pricingPage).not.toContain('yearlyHref: "/checkout/pro-yearly"')
    expect(pricingPage).not.toContain('$12/year')
    expect(pricingPage).toContain('href: "/checkout/lifetime"')
    expect(trialCard).toContain('href="/checkout/pro"')
    expect(trialCard).toContain('Renew Pro')
    expect(trialCard).toContain('isProExpired')
    expect(trialCard).not.toContain('Request Lifetime Setup')
    expect(trialCard).not.toContain('Lifetime plan active')
    expect(trialCard).toContain('Lifetime is a self-hosted setup request')
    expect(trialCard).toContain('broadcast messages used this billing period')
    expect(trialCard).toContain('remaining this billing period')
    expect(trialCard).not.toContain('Broadcast sending is not limited by the free trial quota')
  })

  it('shows account checkout fields and the red payment instruction', () => {
    expect(checkoutForm).toContain('Full name')
    expect(checkoutForm).toContain('Phone number')
    expect(checkoutForm).toContain('Password')
    expect(checkoutForm).toContain('Company name (optional)')
    expect(checkoutForm).toContain('Already registered?')
    expect(checkoutForm).not.toContain('Already have an account? Login instead')
    expect(checkoutForm).toContain('Login inside checkout')
    expect(checkoutForm).toContain('Need a new account? Continue with checkout signup')
    expect(checkoutForm).toContain('Logged in as')
    expect(checkoutForm).toContain('signInWithPassword')
    expect(checkoutForm).toContain('Form submitted successfully')
    expect(checkoutForm).toContain('Send Payment Proof')
    expect(checkoutForm).toContain('Please send your payment screenshot or payment proof')
    expect(checkoutForm).toContain('If you have sent your payment screenshot, you can')
    expect(checkoutForm).toContain('login here')
    expect(checkoutForm).toContain('href="/login"')
    expect(checkoutForm).not.toContain('Your customer account and workspace are')
    expect(checkoutForm).not.toContain('Request ID:')
    expect(checkoutForm).not.toContain('Request ID: <span')
    expect(checkoutForm).not.toContain("requestId: requestId ?? undefined")
    expect(checkoutForm).not.toContain('>Login</Link>')
    expect(checkoutForm).not.toContain('After submitting, send your payment')
    expect(checkoutForm).toContain('const selectedPaymentDetails = MANUAL_PAYMENT_METHODS[paymentMethod]')
    expect(checkoutForm).toContain('billing_period: plan.billingPeriod')
    expect(checkoutForm).toContain('selectedPaymentDetails.fields.map')
    expect(checkoutForm).toContain('flex justify-center')
    expect(checkoutForm).toContain('text-red-700')
    expect(checkoutForm).toContain('Pay with Easypaisa or bank transfer')
    expect(checkoutForm).toContain('plan.originalPriceLabel')
    expect(checkoutForm).toContain('plan.offerLabel')
  })

  it('hides the public header on checkout pages only', () => {
    expect(checkoutPage).toContain('PublicFooter')
    expect(checkoutPage).not.toContain('PublicHeader')
  })
})
