import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  calculatePricingEstimate,
  detectCountryFromPhone,
  estimateBroadcastPricingBreakdown,
  findRateForPhone,
  formatMicros,
  isConvertedCurrencyEstimate,
  parseRateToMicros,
  type WhatsAppPricingRate,
} from './pricing'

const pakistan: WhatsAppPricingRate = {
  country_name: 'Pakistan',
  iso_country_code: 'PK',
  phone_country_code: '92',
  currency: 'PKR',
  marketing_rate: '13.173050',
  utility_rate: '2.785000',
  authentication_rate: '2.785000',
  service_rate: '0.000000',
  last_verified_at: '2026-05-24T00:00:00.000Z',
  verified_by_admin: true,
  notes:
    'Admin verified estimate. Converted from USD estimate using admin-maintained exchange rate. Actual Meta billing currency/rate may differ; verify important campaigns with the official WhatsApp calculator.',
}

const turkey: WhatsAppPricingRate = {
  country_name: 'Turkey',
  iso_country_code: 'TR',
  phone_country_code: '90',
  currency: 'TRY',
  marketing_rate: '0.292500',
  utility_rate: '0.022750',
  authentication_rate: '0.022750',
  service_rate: '0.000000',
  last_verified_at: '2026-05-24T00:00:00.000Z',
  verified_by_admin: true,
  notes:
    'Admin verified estimate. Converted from USD estimate using admin-maintained exchange rate. Actual Meta billing currency/rate may differ; verify important campaigns with the official WhatsApp calculator.',
}

const unitedStates: WhatsAppPricingRate = {
  country_name: 'United States',
  iso_country_code: 'US',
  phone_country_code: '1',
  currency: 'USD',
  marketing_rate: '0.025000',
  utility_rate: '0.003000',
  authentication_rate: '0.003000',
  service_rate: '0.000000',
  last_verified_at: '2026-05-24T00:00:00.000Z',
  verified_by_admin: true,
}

describe('WhatsApp pricing helpers', () => {
  it('keeps decimal precision with micros', () => {
    expect(parseRateToMicros('0.010900')).toBe(BigInt(10900))
    expect(formatMicros(BigInt(10900) * BigInt(1000), 'USD')).toBe('USD 10.90')
  })

  it('calculates Pakistan marketing estimates', () => {
    const result = calculatePricingEstimate({
      rate: pakistan,
      category: 'marketing',
      messageCount: 1000,
      now: new Date('2026-05-24T00:00:00.000Z'),
    })
    expect(result.status).toBe('ok')
    expect(result.rateDisplay).toBe('PKR 13.173050')
    expect(result.totalDisplay).toBe('PKR 13173.05')
  })

  it('calculates Turkey marketing estimates', () => {
    const result = calculatePricingEstimate({
      rate: turkey,
      category: 'marketing',
      messageCount: 1000,
      now: new Date('2026-05-24T00:00:00.000Z'),
    })
    expect(result.rateDisplay).toBe('TRY 0.292500')
    expect(result.totalDisplay).toBe('TRY 292.50')
  })

  it('keeps United States rates in USD', () => {
    const result = calculatePricingEstimate({
      rate: unitedStates,
      category: 'marketing',
      messageCount: 1000,
      now: new Date('2026-05-24T00:00:00.000Z'),
    })

    expect(result.totalDisplay).toBe('USD 25.00')
  })

  it('warns for missing and outdated rates', () => {
    expect(calculatePricingEstimate({ rate: null, category: 'marketing', messageCount: 10 }).warnings).toContain(
      'Rate not configured.',
    )
    const outdated = calculatePricingEstimate({
      rate: { ...pakistan, last_verified_at: '2026-01-01T00:00:00.000Z' },
      category: 'marketing',
      messageCount: 1,
      now: new Date('2026-05-24T00:00:00.000Z'),
    })
    expect(outdated.warnings).toContain('Rate may be outdated.')
  })

  it('warns when a rate is converted from a USD estimate', () => {
    const result = calculatePricingEstimate({
      rate: pakistan,
      category: 'marketing',
      messageCount: 1,
      now: new Date('2026-05-24T00:00:00.000Z'),
    })

    expect(isConvertedCurrencyEstimate(pakistan)).toBe(true)
    expect(result.warnings).toContain('Converted estimate. Actual Meta billing currency/rate may differ.')
  })

  it('does not require review for admin verified current rows', () => {
    const result = calculatePricingEstimate({
      rate: unitedStates,
      category: 'marketing',
      messageCount: 1,
      now: new Date('2026-05-24T00:00:00.000Z'),
    })

    expect(result.warnings).not.toContain('Rate not verified.')
    expect(result.warnings).not.toContain('Rate may be outdated.')
    expect(result.warnings).not.toContain('Rate should be verified against Meta official calculator.')
  })

  it('detects countries from WhatsApp phone numbers', () => {
    expect(detectCountryFromPhone('923001234567')?.country_name).toBe('Pakistan')
    expect(detectCountryFromPhone('905551112233')?.country_name).toBe('Turkey')
    expect(detectCountryFromPhone('447700900123')?.country_name).toBe('United Kingdom')
    expect(detectCountryFromPhone('971501234567')?.country_name).toBe('UAE')
  })

  it('looks up category rates by detected country', () => {
    expect(findRateForPhone([pakistan, turkey], '923001234567')?.country_name).toBe('Pakistan')
    expect(findRateForPhone([pakistan, turkey], '905551112233')?.country_name).toBe('Turkey')
  })

  it('delivered-cost style calculation excludes failed/skipped counts by using delivered count only', () => {
    const deliveredOnly = calculatePricingEstimate({
      rate: pakistan,
      category: 'marketing',
      messageCount: 12,
      now: new Date('2026-05-24T00:00:00.000Z'),
    })
    expect(deliveredOnly.totalDisplay).toBe('PKR 158.08')
  })

  it('prepares country breakdowns for broadcast pricing integration', () => {
    const result = estimateBroadcastPricingBreakdown({
      rates: [pakistan, turkey],
      category: 'marketing',
      recipients: [
        { phone: '923001234567' },
        { phone: '923331234567' },
        { phone: '905551112233' },
        { phone: '971501234567' },
      ],
    })

    expect(result.rows.map((row) => [row.country_name, row.recipientCount])).toEqual([
      ['Pakistan', 2],
      ['Turkey', 1],
    ])
    expect(result.missingRateWarnings).toEqual(['Rate not configured for UAE.'])
  })

  it('uses an update-only verification seed so reruns do not insert duplicate rows', () => {
    const seed = readFileSync(
      resolve(process.cwd(), 'supabase/seeds/018_verify_pricing_and_localize_currencies.sql'),
      'utf8',
    )

    expect(seed).toContain('UPDATE whatsapp_pricing_rates AS rate')
    expect(seed).not.toContain('INSERT INTO whatsapp_pricing_rates')
  })
})
