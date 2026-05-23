import { describe, expect, it } from 'vitest'
import { automationSendSkipReason } from './send-safety'

describe('automation send safety', () => {
  it('skips opted-out or unsubscribed contacts before automation sends', () => {
    expect(automationSendSkipReason({ opted_out_at: '2026-05-01T00:00:00.000Z' })).toBe(
      'contact is opted out',
    )
    expect(automationSendSkipReason({ is_opted_out: true })).toBe(
      'contact is opted out',
    )
    expect(automationSendSkipReason({ unsubscribed: true })).toBe(
      'contact is opted out',
    )
  })

  it('allows contacts that are not opted out', () => {
    expect(automationSendSkipReason({ opted_in: true })).toBeNull()
  })

  it('requires opt-in for automation template sends when requested', () => {
    expect(automationSendSkipReason({ whatsapp_opt_in: false }, { requireOptIn: true })).toBe(
      'contact is not opted in',
    )
    expect(automationSendSkipReason({ whatsapp_opt_in: true }, { requireOptIn: true })).toBeNull()
  })
})
