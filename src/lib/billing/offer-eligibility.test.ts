import { describe, expect, it } from 'vitest'

import {
  hashBillingProviderIdentity,
  normalizeBillingEmail,
  normalizeBillingPhone,
} from './offer-eligibility'

describe('billing offer identity normalization', () => {
  it('normalizes emails and phone numbers consistently', () => {
    expect(normalizeBillingEmail('  Customer@Example.COM ')).toBe('customer@example.com')
    expect(normalizeBillingEmail('   ')).toBeNull()
    expect(normalizeBillingPhone('+92 (300) 123-4567')).toBe('923001234567')
    expect(normalizeBillingPhone('0044 7700 900123')).toBe('447700900123')
    expect(normalizeBillingPhone('not a phone')).toBeNull()
  })

  it('hashes future provider identities without returning the raw identifier', () => {
    const previousKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = 'a'.repeat(64)
    try {
      const raw = 'stripe-card-fingerprint-example'
      const hashed = hashBillingProviderIdentity(raw)
      expect(hashed).toMatch(/^[a-f0-9]{64}$/)
      expect(hashed).not.toContain(raw)
      expect(hashBillingProviderIdentity(raw)).toBe(hashed)
    } finally {
      process.env.ENCRYPTION_KEY = previousKey
    }
  })
})
