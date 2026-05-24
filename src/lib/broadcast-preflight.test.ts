import { describe, expect, it } from 'vitest'
import {
  buildBroadcastPreflightSummary,
  buildBroadcastPricingSummary,
  evaluateBroadcastRecipients,
} from './broadcast-preflight'
import { convertCurrencyTotalsToCurrency } from './whatsapp/pricing'
import type { Contact, MessageTemplate, WhatsAppPricingRate } from '@/types'

const baseContact: Contact = {
  id: 'c1',
  user_id: 'u1',
  name: 'A',
  phone: '923001234567',
  whatsapp_opt_in: true,
  created_at: '2026-05-24T00:00:00.000Z',
  updated_at: '2026-05-24T00:00:00.000Z',
}

const approvedTemplate: MessageTemplate = {
  id: 't1',
  user_id: 'u1',
  name: 'promo',
  category: 'Marketing',
  language: 'en_US',
  body_text: 'Hi',
  status: 'Approved',
  created_at: '2026-05-24T00:00:00.000Z',
}

const rates: WhatsAppPricingRate[] = [
  {
    id: 'r1',
    user_id: 'u1',
    country_name: 'Pakistan',
    iso_country_code: 'PK',
    phone_country_code: '92',
    currency: 'PKR',
    marketing_rate: '13.173050',
    utility_rate: '2.785000',
    authentication_rate: '2.785000',
    service_rate: '0.000000',
    verified_by_admin: true,
    last_verified_at: '2026-05-24T00:00:00.000Z',
    created_at: '2026-05-24T00:00:00.000Z',
    updated_at: '2026-05-24T00:00:00.000Z',
  },
  {
    id: 'r2',
    user_id: 'u1',
    country_name: 'United States',
    iso_country_code: 'US',
    phone_country_code: '1',
    currency: 'USD',
    marketing_rate: '0.025000',
    utility_rate: '0.003000',
    authentication_rate: '0.003000',
    service_rate: '0.000000',
    verified_by_admin: true,
    last_verified_at: '2026-05-24T00:00:00.000Z',
    created_at: '2026-05-24T00:00:00.000Z',
    updated_at: '2026-05-24T00:00:00.000Z',
  },
]

describe('broadcast preflight', () => {
  it('allows opted-in contacts', () => {
    const result = evaluateBroadcastRecipients([baseContact])
    expect(result.eligible).toHaveLength(1)
  })

  it('skips not opted-in, opted-out, invalid, and duplicate contacts', () => {
    const result = evaluateBroadcastRecipients([
      baseContact,
      { ...baseContact, id: 'c2', phone: '+92 300 1234567' },
      { ...baseContact, id: 'c3', phone: '14155552671', whatsapp_opt_in: false },
      { ...baseContact, id: 'c4', phone: '447700900123', opted_out_at: '2026-05-01T00:00:00.000Z' },
      { ...baseContact, id: 'c5', phone: 'bad' },
    ])

    expect(result.eligible).toHaveLength(1)
    expect(result.skipped.duplicatePhone).toBe(1)
    expect(result.skipped.notOptedIn).toBe(1)
    expect(result.skipped.optedOut).toBe(1)
    expect(result.skipped.invalidPhone).toBe(1)
  })

  it('calculates multiple-currency pricing breakdowns', () => {
    const pricing = buildBroadcastPricingSummary({
      eligibleRecipients: [
        { contact: baseContact, normalizedPhone: '923001234567' },
        { contact: { ...baseContact, id: 'c2', phone: '14155552671' }, normalizedPhone: '14155552671' },
      ],
      rates,
      category: 'marketing',
    })

    expect(pricing.pricingBreakdown.map((row) => [row.country_name, row.currency])).toEqual([
      ['Pakistan', 'PKR'],
      ['United States', 'USD'],
    ])
    expect(pricing.pricingBreakdown[0].estimatedTotalDisplay).toBe('PKR 13.17 total')
    expect(pricing.currencyTotals.map((row) => row.currency).sort()).toEqual(['PKR', 'USD'])
    expect(pricing.currencyTotals.every((row) => row.totalMicros)).toBe(true)
  })

  it('converts multiple-country preflight totals without changing original breakdown', () => {
    const pricing = buildBroadcastPricingSummary({
      eligibleRecipients: [
        { contact: baseContact, normalizedPhone: '923001234567' },
        { contact: { ...baseContact, id: 'c2', phone: '14155552671' }, normalizedPhone: '14155552671' },
      ],
      rates,
      category: 'marketing',
    })

    const converted = convertCurrencyTotalsToCurrency(pricing.currencyTotals, 'PKR')

    expect(converted.status).toBe('ok')
    expect(converted.display).toBe('PKR 20.14 total')
    expect(pricing.pricingBreakdown.map((row) => row.estimatedTotalDisplay)).toEqual([
      'PKR 13.17 total',
      'USD 0.03 total',
    ])
  })

  it('converts preflight totals with non-common local currencies', () => {
    const pricing = buildBroadcastPricingSummary({
      eligibleRecipients: [
        { contact: baseContact, normalizedPhone: '923001234567' },
        { contact: { ...baseContact, id: 'c2', phone: '258841234567' }, normalizedPhone: '258841234567' },
      ],
      rates: [
        ...rates,
        {
          id: 'r3',
          user_id: 'u1',
          country_name: 'Mozambique',
          iso_country_code: 'MZ',
          phone_country_code: '258',
          currency: 'MZN',
          marketing_rate: '1.440000',
          utility_rate: '0.300000',
          authentication_rate: '0.300000',
          service_rate: '0.000000',
          verified_by_admin: true,
          last_verified_at: '2026-05-24T00:00:00.000Z',
          created_at: '2026-05-24T00:00:00.000Z',
          updated_at: '2026-05-24T00:00:00.000Z',
        },
      ],
      category: 'marketing',
    })

    const converted = convertCurrencyTotalsToCurrency(pricing.currencyTotals, 'INR')

    expect(converted.status).toBe('ok')
    expect(converted.display).toBe('INR 5.79 total')
    expect(pricing.pricingBreakdown.map((row) => row.estimatedTotalDisplay)).toEqual([
      'PKR 13.17 total',
      'MZN 1.44 total',
    ])
  })

  it('shows missing pricing warnings', () => {
    const pricing = buildBroadcastPricingSummary({
      eligibleRecipients: [{ contact: baseContact, normalizedPhone: '905551112233' }],
      rates,
      category: 'marketing',
    })

    expect(pricing.pricingMissingCount).toBe(1)
    expect(pricing.missingPricingWarnings[0]).toContain('Turkey')
  })

  it('blocks no eligible recipients, missing WhatsApp, and unapproved templates', () => {
    const summary = buildBroadcastPreflightSummary({
      whatsappConnected: false,
      template: { ...approvedTemplate, status: 'Pending' },
      contacts: [{ ...baseContact, whatsapp_opt_in: false }],
      rates,
    })

    expect(summary.blockers).toContain('WhatsApp is not connected. Please configure WhatsApp in Settings.')
    expect(summary.blockers).toContain('Template is not approved. Please sync/select an approved Meta template.')
    expect(summary.blockers).toContain('No eligible opted-in recipients.')
  })
})
