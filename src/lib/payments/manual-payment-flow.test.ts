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

  it('keeps normal signup profiles pending until admin approval', () => {
    expect(approvalMigration).toContain('CREATE OR REPLACE FUNCTION public.handle_new_user()')
    expect(approvalMigration).toContain("'pending'")
    expect(approvalMigration).toContain('pending approval status')
  })

  it('validates manual checkout server-side without Stripe or PayPal', () => {
    expect(checkoutRoute).toContain('getManualCheckoutPlan')
    expect(checkoutRoute).toContain('getManualPaymentMethod')
    expect(checkoutRoute).toContain('manual_payment_requests')
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

  it('lets platform admins approve customers from payment review and activate workspace plans', () => {
    expect(adminReviewRoute).toContain('requirePlatformAdmin')
    expect(adminReviewRoute).toContain('approvePaymentCustomer')
    expect(adminReviewRoute).toContain("approval_status: 'approved'")
    expect(adminReviewRoute).toContain('approved_by: approvedByProfileId')
    expect(adminReviewRoute).toContain("plan_type: paymentRequest.plan_type")
    expect(adminReviewRoute).toContain("subscription_status: 'active'")
    expect(adminReviewRoute).toContain('ensureApprovedUserOwnWorkspace')
    expect(adminReviewRoute).toContain("status: 'rejected'")
    expect(adminReviewRoute).not.toContain('Ask the customer to sign up or login')
  })

  it('lets platform admins delete non-approved payment request records only', () => {
    expect(adminReviewRoute).toContain('export async function DELETE')
    expect(adminReviewRoute).toContain('requirePlatformAdmin')
    expect(adminReviewRoute).toContain("paymentRequest.status === 'approved'")
    expect(adminReviewRoute).toContain('manual_payment_requests')
    expect(adminReviewRoute).toContain('.delete()')
    expect(adminReviewRoute).toContain('Approved payment requests are kept for audit history')
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
    expect(adminPaymentsPage).toContain('Approved payment requests are kept for audit history')
  })

  it('routes Pro and Lifetime pricing CTAs to manual checkout', () => {
    expect(pricingPage).toContain('href: "/checkout/pro"')
    expect(pricingPage).toContain('href: "/checkout/lifetime"')
    expect(trialCard).toContain('href="/checkout/pro"')
    expect(trialCard).toContain('isPro ? null')
    expect(trialCard).not.toContain('Request Lifetime Setup')
    expect(trialCard).toContain('Lifetime plan active')
    expect(trialCard).toContain('You are now a Pro user. You can use Talk Wagon CRM with unlimited Pro access.')
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
    expect(checkoutForm).toContain('selectedPaymentDetails.fields.map')
    expect(checkoutForm).toContain('flex justify-center')
    expect(checkoutForm).toContain('text-red-700')
    expect(checkoutForm).toContain('Pay with Easypaisa or bank transfer')
  })

  it('hides the public header on checkout pages only', () => {
    expect(checkoutPage).toContain('PublicFooter')
    expect(checkoutPage).not.toContain('PublicHeader')
  })
})
