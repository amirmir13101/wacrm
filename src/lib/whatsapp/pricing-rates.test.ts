import { describe, expect, it } from 'vitest'
import { dedupeSharedPricingRates } from './pricing-rates'
import type { WhatsAppPricingRate } from '@/types'

function rate(overrides: Partial<WhatsAppPricingRate>): WhatsAppPricingRate {
  return {
    id: overrides.id ?? 'rate',
    user_id: overrides.user_id ?? 'user',
    country_name: overrides.country_name ?? 'Pakistan',
    iso_country_code: overrides.iso_country_code ?? 'PK',
    phone_country_code: overrides.phone_country_code ?? '92',
    currency: overrides.currency ?? 'PKR',
    marketing_rate: overrides.marketing_rate ?? '1.000000',
    utility_rate: overrides.utility_rate ?? '1.000000',
    authentication_rate: overrides.authentication_rate ?? '1.000000',
    service_rate: overrides.service_rate ?? '0.000000',
    verified_by_admin: overrides.verified_by_admin ?? false,
    last_verified_at: overrides.last_verified_at ?? null,
    created_at: overrides.created_at ?? '2026-05-24T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-05-24T00:00:00.000Z',
  }
}

describe('shared WhatsApp pricing rates', () => {
  it('keeps one shared rate per country and currency', () => {
    const result = dedupeSharedPricingRates([
      rate({ id: 'old', verified_by_admin: false }),
      rate({ id: 'verified', verified_by_admin: true, last_verified_at: '2026-05-24T00:00:00.000Z' }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('verified')
  })

  it('prefers the latest verified row when multiple admins have the same market', () => {
    const result = dedupeSharedPricingRates([
      rate({ id: 'older', verified_by_admin: true, last_verified_at: '2026-04-01T00:00:00.000Z' }),
      rate({ id: 'newer', verified_by_admin: true, last_verified_at: '2026-05-24T00:00:00.000Z' }),
    ])

    expect(result[0].id).toBe('newer')
  })
})
