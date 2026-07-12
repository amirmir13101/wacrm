import { describe, expect, it } from 'vitest'

import {
  buildPaymentProofWhatsAppUrl,
  getManualCheckoutPricing,
  getManualCheckoutPlan,
  MANUAL_CHECKOUT_PLANS,
  MANUAL_PAYMENT_METHODS,
  MANUAL_PAYMENT_WHATSAPP_NUMBER,
} from './manual-payment-config'

describe('manual payment checkout config', () => {
  it('defines Pro monthly and Lifetime manual checkout prices', () => {
    expect(MANUAL_CHECKOUT_PLANS.pro.amount).toBe(1)
    expect(MANUAL_CHECKOUT_PLANS.pro.priceLabel).toBe('$1 first month, then $9.90/month')
    expect(MANUAL_CHECKOUT_PLANS.pro.regularAmount).toBe(9.9)
    expect(MANUAL_CHECKOUT_PLANS.pro.originalPriceLabel).toBe('$9.90/month')
    expect(MANUAL_CHECKOUT_PLANS.pro.offerLabel).toBe('First month promo')
    expect(MANUAL_CHECKOUT_PLANS.lifetime.amount).toBe(499)
    expect(MANUAL_CHECKOUT_PLANS.lifetime.priceLabel).toBe('$499 one-time')
  })

  it('keeps new Pro manual checkout monthly-only', () => {
    expect(getManualCheckoutPlan('pro')?.amount).toBe(1)
    expect(getManualCheckoutPlan('pro-yearly')).toBeNull()
    expect(JSON.stringify(MANUAL_CHECKOUT_PLANS)).not.toContain('$12/year')
  })

  it('calculates first-month promo and renewal prices from backend-owned config', () => {
    const promo = getManualCheckoutPricing({
      plan: MANUAL_CHECKOUT_PLANS.pro,
      firstMonthPromoEligible: true,
    })
    expect(promo.amount).toBe(1)
    expect(promo.originalAmount).toBe(9.9)
    expect(promo.chargedAmount).toBe(1)
    expect(promo.isFirstMonthPromo).toBe(true)
    expect(promo.promoType).toBe('first_month')
    expect(promo.pricingLabel).toBe('First month promotional price: $1')

    const renewal = getManualCheckoutPricing({
      plan: MANUAL_CHECKOUT_PLANS.pro,
      firstMonthPromoEligible: false,
    })
    expect(renewal.amount).toBe(9.9)
    expect(renewal.chargedAmount).toBe(9.9)
    expect(renewal.isFirstMonthPromo).toBe(false)
    expect(renewal.pricingLabel).toBe('Monthly renewal price: $9.90/month')
  })

  it('contains Easypaisa and UBL bank payment details', () => {
    expect(MANUAL_PAYMENT_METHODS.easypaisa.fields).toContainEqual(['Account number', '03489122663'])
    expect(MANUAL_PAYMENT_METHODS.bank_transfer.fields).toContainEqual(['Bank name', 'UBL'])
    expect(MANUAL_PAYMENT_METHODS.bank_transfer.fields).toContainEqual([
      'IBAN',
      'PK70UNIL0109000305754781',
    ])
  })

  it('builds a WhatsApp proof handoff URL without exposing a payment gateway', () => {
    const url = buildPaymentProofWhatsAppUrl({
      plan: MANUAL_CHECKOUT_PLANS.pro,
      payerName: 'Test User',
      payerEmail: 'test@example.com',
      workspaceName: 'Test Workspace',
      requestId: 'request-123',
    })

    expect(url).toContain(`https://wa.me/${MANUAL_PAYMENT_WHATSAPP_NUMBER}`)
    expect(decodeURIComponent(url)).toContain('Plan: Pro Monthly')
    expect(decodeURIComponent(url)).toContain('Request ID: request-123')
  })
})
