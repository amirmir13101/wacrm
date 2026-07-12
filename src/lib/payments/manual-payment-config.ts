export type ManualCheckoutPlanType = 'pro' | 'lifetime'
export type ManualCheckoutBillingPeriod = 'monthly' | 'yearly' | 'lifetime_setup'
export type ManualPaymentMethod = 'easypaisa' | 'bank_transfer'

export interface ManualCheckoutPlan {
  readonly planType: ManualCheckoutPlanType
  readonly checkoutSlug: string
  readonly billingPeriod: ManualCheckoutBillingPeriod
  readonly title: string
  readonly shortTitle: string
  readonly amount: number
  readonly regularAmount?: number
  readonly currency: 'USD'
  readonly priceLabel: string
  readonly regularPriceLabel?: string
  readonly originalPriceLabel?: string
  readonly offerLabel?: string
  readonly billingLabel: string
  readonly description: string
  readonly activationNote: string
}

export interface ManualCheckoutPricing {
  readonly amount: number
  readonly originalAmount: number
  readonly chargedAmount: number
  readonly currency: 'USD'
  readonly priceLabel: string
  readonly billingLabel: string
  readonly pricingLabel: string
  readonly isFirstMonthPromo: boolean
  readonly promoType: 'first_month' | null
  readonly renewalMessage?: string
}

export interface ManualPaymentMethodDetails {
  readonly id: ManualPaymentMethod
  readonly label: string
  readonly helper: string
  readonly fields: ReadonlyArray<readonly [string, string]>
}

export const MANUAL_PAYMENT_WHATSAPP_NUMBER = '447882756946'
export const PRO_FIRST_MONTH_PROMO_AMOUNT = 1
export const PRO_REGULAR_MONTHLY_AMOUNT = 9.9
export const PRO_FIRST_MONTH_PRICE_LABEL = '$1 first month'
export const PRO_REGULAR_MONTHLY_PRICE_LABEL = '$9.90/month'
export const PRO_FIRST_MONTH_PROMO_LABEL = '$1 first month, then $9.90/month'

export const MANUAL_CHECKOUT_PLANS = {
  pro: {
    planType: 'pro',
    checkoutSlug: 'pro',
    billingPeriod: 'monthly',
    title: 'Talk Wagon Pro Monthly',
    shortTitle: 'Pro Monthly',
    amount: PRO_FIRST_MONTH_PROMO_AMOUNT,
    regularAmount: PRO_REGULAR_MONTHLY_AMOUNT,
    currency: 'USD',
    priceLabel: PRO_FIRST_MONTH_PROMO_LABEL,
    regularPriceLabel: PRO_REGULAR_MONTHLY_PRICE_LABEL,
    originalPriceLabel: PRO_REGULAR_MONTHLY_PRICE_LABEL,
    offerLabel: 'First month promo',
    billingLabel: 'Manual monthly activation',
    description:
      'Unlock full Talk Wagon CRM features, unlimited CRM usage, team inbox, broadcasts, automations, and pipeline tools.',
    activationNote:
      'Your Pro workspace is activated by the platform admin after payment proof is confirmed.',
  },
  lifetime: {
    planType: 'lifetime',
    checkoutSlug: 'lifetime',
    billingPeriod: 'lifetime_setup',
    title: 'Talk Wagon Lifetime Self-Hosted Setup',
    shortTitle: 'Lifetime',
    amount: 499,
    currency: 'USD',
    priceLabel: '$499 one-time',
    billingLabel: 'Manual lifetime setup request',
    description:
      'Request a branded self-hosted CRM setup for your company with Talk Wagon workspace features.',
    activationNote:
      'Your lifetime self-hosted setup request is reviewed manually after payment proof is confirmed.',
  },
} as const satisfies Record<string, ManualCheckoutPlan>

export const MANUAL_PAYMENT_METHODS: Record<ManualPaymentMethod, ManualPaymentMethodDetails> = {
  easypaisa: {
    id: 'easypaisa',
    label: 'Easypaisa',
    helper: 'Send the payment, then share proof with our team on WhatsApp or live chat.',
    fields: [
      ['Account name', 'Amir'],
      ['Account number', '03489122663'],
    ],
  },
  bank_transfer: {
    id: 'bank_transfer',
    label: 'Bank Transfer',
    helper: 'Use the bank details below and include your reference number in the checkout form if available.',
    fields: [
      ['Bank name', 'UBL'],
      ['Account name', 'Amir'],
      ['Account number', '0355305754781'],
      ['IBAN', 'PK70UNIL0109000305754781'],
    ],
  },
}

export function getManualCheckoutPlan(plan: string): ManualCheckoutPlan | null {
  if (plan === 'pro') return MANUAL_CHECKOUT_PLANS.pro
  if (plan === 'lifetime') return MANUAL_CHECKOUT_PLANS.lifetime
  return null
}

export function getManualPaymentMethod(method: string): ManualPaymentMethodDetails | null {
  if (method === 'easypaisa' || method === 'bank_transfer') return MANUAL_PAYMENT_METHODS[method]
  return null
}

export function getManualCheckoutPricing(args: {
  readonly plan: ManualCheckoutPlan
  readonly firstMonthPromoEligible: boolean
}): ManualCheckoutPricing {
  if (args.plan.planType !== 'pro') {
    return {
      amount: args.plan.amount,
      originalAmount: args.plan.amount,
      chargedAmount: args.plan.amount,
      currency: args.plan.currency,
      priceLabel: args.plan.priceLabel,
      billingLabel: args.plan.billingLabel,
      pricingLabel: args.plan.billingLabel,
      isFirstMonthPromo: false,
      promoType: null,
    }
  }

  if (args.firstMonthPromoEligible) {
    return {
      amount: PRO_FIRST_MONTH_PROMO_AMOUNT,
      originalAmount: PRO_REGULAR_MONTHLY_AMOUNT,
      chargedAmount: PRO_FIRST_MONTH_PROMO_AMOUNT,
      currency: args.plan.currency,
      priceLabel: PRO_FIRST_MONTH_PRICE_LABEL,
      billingLabel: 'First month promotional price',
      pricingLabel: 'First month promotional price: $1',
      isFirstMonthPromo: true,
      promoType: 'first_month',
      renewalMessage: 'Renews at $9.90/month after the first month.',
    }
  }

  return {
    amount: PRO_REGULAR_MONTHLY_AMOUNT,
    originalAmount: PRO_REGULAR_MONTHLY_AMOUNT,
    chargedAmount: PRO_REGULAR_MONTHLY_AMOUNT,
    currency: args.plan.currency,
    priceLabel: PRO_REGULAR_MONTHLY_PRICE_LABEL,
    billingLabel: 'Monthly renewal price',
    pricingLabel: 'Monthly renewal price: $9.90/month',
    isFirstMonthPromo: false,
    promoType: null,
    renewalMessage: 'Your first-month promotion has already been used. Renewal price is $9.90/month.',
  }
}

export function buildPaymentProofWhatsAppUrl(args: {
  readonly plan: ManualCheckoutPlan
  readonly payerName?: string
  readonly payerEmail?: string
  readonly workspaceName?: string
  readonly requestId?: string
}): string {
  const message = [
    'Hi Talk Wagon team, I want to share manual payment proof.',
    `Plan: ${args.plan.shortTitle}`,
    `Amount: ${args.plan.priceLabel}`,
    args.requestId ? `Request ID: ${args.requestId}` : null,
    args.payerName ? `Name: ${args.payerName}` : null,
    args.payerEmail ? `Email: ${args.payerEmail}` : null,
    args.workspaceName ? `Workspace: ${args.workspaceName}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `https://wa.me/${MANUAL_PAYMENT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
