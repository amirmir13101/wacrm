import { describe, expect, it } from 'vitest'
import { automationSendSkipReason } from './send-safety'

describe('automation send safety', () => {
  it('skips opted-out or unsubscribed contacts before automation sends', () => {
    expect(automationSendSkipReason({ opted_out: true })).toBe(
      'contact is opted out or unsubscribed',
    )
    expect(automationSendSkipReason({ is_opted_out: true })).toBe(
      'contact is opted out or unsubscribed',
    )
    expect(automationSendSkipReason({ unsubscribed: true })).toBe(
      'contact is opted out or unsubscribed',
    )
  })

  it('allows contacts that are not opted out', () => {
    expect(automationSendSkipReason({ opted_in: true })).toBeNull()
  })
})
