import { createHmac } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

export const FREE_TRIAL_OFFER_CODE = 'free_trial_14_day'
export const PRO_FIRST_MONTH_OFFER_CODE = 'pro_first_month'

export type BillingOfferCode =
  | typeof FREE_TRIAL_OFFER_CODE
  | typeof PRO_FIRST_MONTH_OFFER_CODE

export interface BillingOfferIdentity {
  readonly workspaceId?: string | null
  readonly userId?: string | null
  readonly email?: string | null
  readonly phone?: string | null
  readonly paymentProvider?: string | null
  readonly providerCustomerHash?: string | null
  readonly paymentMethodFingerprintHash?: string | null
}

export function normalizeBillingEmail(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? ''
  return normalized || null
}

export function normalizeBillingPhone(value?: string | null): string | null {
  const digits = value?.replace(/\D/g, '') ?? ''
  if (!digits) return null
  return digits.startsWith('00') ? digits.slice(2) : digits
}

/**
 * Hash stable provider identifiers before they enter the billing ledger.
 * This supports future Stripe card fingerprints, PayPal payer IDs, and
 * provider customer IDs without storing those identifiers in plaintext.
 */
export function hashBillingProviderIdentity(value: string): string {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret) throw new Error('Billing identity hashing is not configured.')
  return createHmac('sha256', secret).update(value.trim()).digest('hex')
}

export async function isBillingOfferEligible(args: {
  readonly admin: SupabaseClient
  readonly offerCode: BillingOfferCode
  readonly identity: BillingOfferIdentity
}): Promise<boolean> {
  const { data, error } = await args.admin.rpc('billing_offer_is_eligible', {
    p_offer_code: args.offerCode,
    p_workspace_id: args.identity.workspaceId ?? null,
    p_user_id: args.identity.userId ?? null,
    p_normalized_email: normalizeBillingEmail(args.identity.email),
    p_normalized_phone: normalizeBillingPhone(args.identity.phone),
    p_payment_provider: args.identity.paymentProvider?.trim().toLowerCase() || null,
    p_provider_customer_hash: args.identity.providerCustomerHash ?? null,
    p_payment_method_fingerprint_hash:
      args.identity.paymentMethodFingerprintHash ?? null,
  })

  if (error) throw new Error(`Could not verify billing offer eligibility: ${error.message}`)
  return data === true
}

/**
 * Provider-neutral redemption entry point for future automated payment
 * webhooks. Manual payment approval records its redemption in the database
 * transaction instead.
 */
export async function redeemAutomatedBillingOffer(args: {
  readonly admin: SupabaseClient
  readonly offerCode: BillingOfferCode
  readonly identity: BillingOfferIdentity
  readonly sourceReference: string
  readonly amount: number
  readonly currency: string
}): Promise<string | null> {
  const { data, error } = await args.admin.rpc('redeem_billing_offer', {
    p_offer_code: args.offerCode,
    p_workspace_id: args.identity.workspaceId ?? null,
    p_user_id: args.identity.userId ?? null,
    p_normalized_email: normalizeBillingEmail(args.identity.email),
    p_normalized_phone: normalizeBillingPhone(args.identity.phone),
    p_payment_provider: args.identity.paymentProvider?.trim().toLowerCase() || null,
    p_provider_customer_hash: args.identity.providerCustomerHash ?? null,
    p_payment_method_fingerprint_hash:
      args.identity.paymentMethodFingerprintHash ?? null,
    p_source_type: 'automated_payment',
    p_source_reference: args.sourceReference,
    p_amount: args.amount,
    p_currency: args.currency.toUpperCase(),
    p_redeemed_at: new Date().toISOString(),
  })

  if (error) throw new Error(`Could not record billing offer redemption: ${error.message}`)
  return typeof data === 'string' ? data : null
}
