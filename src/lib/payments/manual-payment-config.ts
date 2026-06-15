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
  readonly currency: 'USD'
  readonly priceLabel: string
  readonly billingLabel: string
  readonly description: string
  readonly activationNote: string
}

export interface ManualPaymentMethodDetails {
  readonly id: ManualPaymentMethod
  readonly label: string
  readonly helper: string
  readonly fields: ReadonlyArray<readonly [string, string]>
}

export const MANUAL_PAYMENT_WHATSAPP_NUMBER = '447882756946'

export const MANUAL_CHECKOUT_PLANS = {
  pro: {
    planType: 'pro',
    checkoutSlug: 'pro',
    billingPeriod: 'monthly',
    title: 'Talk Wagon Pro Monthly',
    shortTitle: 'Pro Monthly',
    amount: 1,
    currency: 'USD',
    priceLabel: '$1/month',
    billingLabel: 'Manual monthly activation',
    description:
      'Unlock full Talk Wagon CRM features, unlimited CRM usage, team inbox, broadcasts, automations, and pipeline tools.',
    activationNote:
      'Your Pro workspace is activated by the platform admin after payment proof is confirmed.',
  },
  pro_yearly: {
    planType: 'pro',
    checkoutSlug: 'pro-yearly',
    billingPeriod: 'yearly',
    title: 'Talk Wagon Pro Yearly',
    shortTitle: 'Pro Yearly',
    amount: 12,
    currency: 'USD',
    priceLabel: '$12/year',
    billingLabel: 'Manual yearly activation',
    description:
      'Unlock full Talk Wagon CRM features for one year with team inbox, broadcasts, automations, and pipeline tools.',
    activationNote:
      'Your yearly Pro workspace is activated by the platform admin after payment proof is confirmed.',
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
  if (plan === 'pro-yearly' || plan === 'pro_yearly') return MANUAL_CHECKOUT_PLANS.pro_yearly
  if (plan === 'lifetime') return MANUAL_CHECKOUT_PLANS.lifetime
  return null
}

export function getManualPaymentMethod(method: string): ManualPaymentMethodDetails | null {
  if (method === 'easypaisa' || method === 'bank_transfer') return MANUAL_PAYMENT_METHODS[method]
  return null
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
