import { getBroadcastConsentEligibility } from '@/lib/contacts/consent'
import {
  calculatePricingEstimate,
  detectCountryFromPhone,
  findRateForPhone,
  type WhatsAppPricingCategory,
  type WhatsAppPricingRate,
} from '@/lib/whatsapp/pricing'
import { isValidE164, normalizePhoneForComparison } from '@/lib/whatsapp/phone-utils'
import type { Contact, MessageTemplate } from '@/types'

export interface PreflightRecipient {
  contact: Contact
  normalizedPhone: string
}

export interface PricingBreakdownRow {
  country_name: string
  iso_country_code: string
  currency: string
  category: WhatsAppPricingCategory
  recipientCount: number
  rateDisplay: string
  estimatedTotalDisplay: string
  verified: boolean
  lastVerifiedAt: string | null
  warnings: string[]
}

export interface BroadcastPreflightSummary {
  whatsappConnected: boolean
  templateApproved: boolean
  templateName: string
  templateLanguage: string
  templateCategory: string
  templateStatus: string
  totalSelected: number
  eligibleCount: number
  skippedNotOptedIn: number
  skippedOptedOut: number
  skippedInvalidPhone: number
  skippedDuplicatePhone: number
  finalQueueCount: number
  pricingMissingCount: number
  pricingBreakdown: PricingBreakdownRow[]
  currencyTotals: { currency: string; totalDisplay: string }[]
  missingPricingWarnings: string[]
  blockers: string[]
  warnings: string[]
}

export function templateCategoryToPricingCategory(category?: string | null): WhatsAppPricingCategory {
  const normalized = (category ?? '').toLowerCase()
  if (normalized === 'marketing') return 'marketing'
  if (normalized === 'authentication') return 'authentication'
  if (normalized === 'service') return 'service'
  return 'utility'
}

export function evaluateBroadcastRecipients(contacts: Contact[]) {
  const seenPhones = new Set<string>()
  const eligible: PreflightRecipient[] = []
  const skipped = {
    notOptedIn: 0,
    optedOut: 0,
    invalidPhone: 0,
    duplicatePhone: 0,
  }

  for (const contact of contacts) {
    const normalizedPhone = normalizePhoneForComparison(contact.phone ?? '')
    if (!normalizedPhone || !isValidE164(normalizedPhone)) {
      skipped.invalidPhone += 1
      continue
    }

    if (seenPhones.has(normalizedPhone)) {
      skipped.duplicatePhone += 1
      continue
    }
    seenPhones.add(normalizedPhone)

    const consent = getBroadcastConsentEligibility(contact)
    if (!consent.eligible) {
      if (/opted out/i.test(consent.reason ?? '')) skipped.optedOut += 1
      else skipped.notOptedIn += 1
      continue
    }

    eligible.push({ contact, normalizedPhone })
  }

  return { eligible, skipped }
}

export function buildBroadcastPricingSummary(args: {
  eligibleRecipients: PreflightRecipient[]
  rates: WhatsAppPricingRate[]
  category: WhatsAppPricingCategory
}) {
  const buckets = new Map<string, { rate: WhatsAppPricingRate | null; count: number; countryLabel: string }>()
  const missingPricingWarnings: string[] = []

  for (const recipient of args.eligibleRecipients) {
    const detected = detectCountryFromPhone(recipient.normalizedPhone)
    if (!detected) {
      missingPricingWarnings.push(`Could not detect country for ${recipient.normalizedPhone}.`)
      continue
    }

    const rate = findRateForPhone(args.rates, recipient.normalizedPhone)
    const key = `${detected.iso_country_code}:${rate?.currency ?? 'missing'}`
    const existing = buckets.get(key)
    buckets.set(key, {
      rate,
      count: (existing?.count ?? 0) + 1,
      countryLabel: detected.country_name,
    })
  }

  const pricingBreakdown: PricingBreakdownRow[] = []
  const currencyTotalsMicros = new Map<string, bigint>()

  for (const bucket of buckets.values()) {
    if (!bucket.rate) {
      missingPricingWarnings.push(`Pricing rate not configured for ${bucket.countryLabel} / ${args.category}.`)
      continue
    }

    const estimate = calculatePricingEstimate({
      rate: bucket.rate,
      category: args.category,
      messageCount: bucket.count,
    })

    if (estimate.status === 'missing_rate') {
      missingPricingWarnings.push(`Pricing rate not configured for ${bucket.rate.country_name} / ${args.category}.`)
      continue
    }

    currencyTotalsMicros.set(
      bucket.rate.currency,
      (currencyTotalsMicros.get(bucket.rate.currency) ?? BigInt(0)) + estimate.rawTotalMicros,
    )

    pricingBreakdown.push({
      country_name: bucket.rate.country_name,
      iso_country_code: bucket.rate.iso_country_code,
      currency: bucket.rate.currency,
      category: args.category,
      recipientCount: bucket.count,
      rateDisplay: estimate.rateDisplay,
      estimatedTotalDisplay: estimate.totalDisplay,
      verified: bucket.rate.verified_by_admin === true,
      lastVerifiedAt: bucket.rate.last_verified_at ?? null,
      warnings: estimate.warnings,
    })
  }

  const currencyTotals = [...currencyTotalsMicros.entries()].map(([currency, totalMicros]) => {
    const whole = totalMicros / BigInt(1_000_000)
    const remainder = totalMicros % BigInt(1_000_000)
    const cents = (remainder + BigInt(5_000)) / BigInt(10_000)
    return {
      currency,
      totalDisplay: `${currency} ${whole}.${cents.toString().padStart(2, '0')}`,
    }
  })

  return {
    pricingBreakdown,
    currencyTotals,
    missingPricingWarnings,
    pricingMissingCount: missingPricingWarnings.length,
  }
}

export function buildBroadcastPreflightSummary(args: {
  whatsappConnected: boolean
  template: Pick<MessageTemplate, 'name' | 'language' | 'category' | 'status'>
  contacts: Contact[]
  rates: WhatsAppPricingRate[]
}): BroadcastPreflightSummary {
  const recipientResult = evaluateBroadcastRecipients(args.contacts)
  const category = templateCategoryToPricingCategory(args.template.category)
  const pricing = buildBroadcastPricingSummary({
    eligibleRecipients: recipientResult.eligible,
    rates: args.rates,
    category,
  })

  const templateApproved = args.template.status === 'Approved'
  const blockers: string[] = []
  if (!args.whatsappConnected) blockers.push('WhatsApp is not connected. Please configure WhatsApp in Settings.')
  if (!templateApproved) blockers.push('Template is not approved. Please sync/select an approved Meta template.')
  if (recipientResult.eligible.length === 0) blockers.push('No eligible opted-in recipients.')

  const warnings = [
    ...pricing.missingPricingWarnings,
    recipientResult.skipped.notOptedIn > 0
      ? `${recipientResult.skipped.notOptedIn} contacts skipped because they are not opted in.`
      : null,
    recipientResult.skipped.optedOut > 0
      ? `${recipientResult.skipped.optedOut} contacts skipped because they opted out.`
      : null,
  ].filter((warning): warning is string => Boolean(warning))

  return {
    whatsappConnected: args.whatsappConnected,
    templateApproved,
    templateName: args.template.name,
    templateLanguage: args.template.language ?? 'en_US',
    templateCategory: args.template.category,
    templateStatus: args.template.status ?? 'Unknown',
    totalSelected: args.contacts.length,
    eligibleCount: recipientResult.eligible.length,
    skippedNotOptedIn: recipientResult.skipped.notOptedIn,
    skippedOptedOut: recipientResult.skipped.optedOut,
    skippedInvalidPhone: recipientResult.skipped.invalidPhone,
    skippedDuplicatePhone: recipientResult.skipped.duplicatePhone,
    finalQueueCount: recipientResult.eligible.length,
    pricingMissingCount: pricing.pricingMissingCount,
    pricingBreakdown: pricing.pricingBreakdown,
    currencyTotals: pricing.currencyTotals,
    missingPricingWarnings: pricing.missingPricingWarnings,
    blockers,
    warnings,
  }
}
