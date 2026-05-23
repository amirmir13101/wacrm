import { describe, expect, it } from 'vitest'
import {
  calculatePricingEstimate,
  detectCountryFromPhone,
  estimateBroadcastPricingBreakdown,
  findRateForPhone,
  formatMicros,
  parseRateToMicros,
  type WhatsAppPricingRate,
} from './pricing'

const pakistan: WhatsAppPricingRate = {
  country_name: 'Pakistan',
  iso_country_code: 'PK',
  phone_country_code: '92',
  currency: 'USD',
  marketing_rate: '0.010900',
  utility_rate: '0.004200',
  authentication_rate: '0.003100',
  service_rate: '0.000000',
  last_verified_at: '2026-05-20T00:00:00.000Z',
  verified_by_admin: true,
}

const turkey: WhatsAppPricingRate = {
  country_name: 'Turkey',
  iso_country_code: 'TR',
  phone_country_code: '90',
  currency: 'USD',
  marketing_rate: '0.034500',
  utility_rate: '0.010000',
  authentication_rate: '0.009000',
  service_rate: '0.000000',
  last_verified_at: '2026-05-20T00:00:00.000Z',
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
    expect(result.rateDisplay).toBe('USD 0.010900')
    expect(result.totalDisplay).toBe('USD 10.90')
  })

  it('calculates Turkey marketing estimates', () => {
    const result = calculatePricingEstimate({
      rate: turkey,
      category: 'marketing',
      messageCount: 1000,
      now: new Date('2026-05-24T00:00:00.000Z'),
    })
    expect(result.totalDisplay).toBe('USD 34.50')
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
    expect(deliveredOnly.totalDisplay).toBe('USD 0.13')
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
})
