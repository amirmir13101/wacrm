import { describe, expect, it } from 'vitest'
import {
  getBroadcastConsentEligibility,
  getContactConsentStatus,
  inboundConsentUpdate,
  parseCsvConsent,
} from './consent'

describe('contact consent helpers', () => {
  it('defaults old contacts to not opted in', () => {
    expect(getContactConsentStatus({ phone: '923001234567' })).toBe('not_opted_in')
    expect(getBroadcastConsentEligibility({ phone: '923001234567' })).toEqual({
      eligible: false,
      reason: 'Contact is not opted in.',
    })
  })

  it('allows only opted-in contacts for broadcasts', () => {
    expect(getBroadcastConsentEligibility({ phone: '923001234567', whatsapp_opt_in: true })).toEqual({
      eligible: true,
    })
  })

  it('skips opted-out contacts even if they were previously opted in', () => {
    expect(
      getBroadcastConsentEligibility({
        phone: '923001234567',
        whatsapp_opt_in: true,
        opted_out_at: '2026-05-01T00:00:00.000Z',
      }),
    ).toEqual({ eligible: false, reason: 'Contact is opted out.' })
  })

  it('parses CSV opt-in and opt-out values', () => {
    expect(parseCsvConsent({ whatsapp_opt_in: 'yes', opt_in_source: 'Website form' }, 'now')).toMatchObject({
      whatsapp_opt_in: true,
      opt_in_source: 'Website form',
      opted_in_at: 'now',
      last_consent_updated_at: 'now',
    })
    expect(parseCsvConsent({ unsubscribed: 'true', opt_out_reason: 'STOP' }, 'now')).toMatchObject({
      whatsapp_opt_in: false,
      opted_out_at: 'now',
      opt_out_reason: 'STOP',
    })
  })

  it('defaults newly imported CSV contacts to opted in', () => {
    expect(parseCsvConsent({}, 'now')).toEqual({
      whatsapp_opt_in: true,
      opt_in_source: 'CSV import',
      opted_in_at: 'now',
      opted_out_at: null,
      opt_out_reason: null,
      last_consent_updated_at: 'now',
    })
  })

  it('respects explicit CSV opt-out and explicit no-consent values', () => {
    expect(parseCsvConsent({ opted_out: 'yes' }, 'now')).toMatchObject({
      whatsapp_opt_in: false,
      opted_out_at: 'now',
      opt_out_reason: 'CSV import',
    })
    expect(parseCsvConsent({ whatsapp_opt_in: 'no' }, 'now')).toEqual({
      whatsapp_opt_in: false,
      opt_in_source: null,
      opted_in_at: null,
      opted_out_at: null,
      opt_out_reason: null,
      last_consent_updated_at: 'now',
    })
  })

  it('turns STOP-like inbound messages into opt-out updates', () => {
    expect(inboundConsentUpdate(' STOP ', 'now')).toEqual({
      whatsapp_opt_in: false,
      opted_out_at: 'now',
      opt_out_reason: 'keyword:stop',
      last_consent_updated_at: 'now',
    })
  })

  it('turns START-like inbound messages into opt-in updates', () => {
    expect(inboundConsentUpdate('start', 'now')).toEqual({
      whatsapp_opt_in: true,
      opted_in_at: 'now',
      opt_in_source: 'inbound_keyword',
      opted_out_at: null,
      opt_out_reason: null,
      last_consent_updated_at: 'now',
    })
  })
})
