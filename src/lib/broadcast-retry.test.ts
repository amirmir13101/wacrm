import { describe, expect, it } from 'vitest'
import {
  classifyBroadcastFailure,
  getRetryableRecipients,
  resolveBroadcastVariables,
} from './broadcast-retry'

describe('getRetryableRecipients', () => {
  const contact = {
    id: 'contact-1',
    name: 'Ada',
    phone: '923001234567',
    email: 'ada@example.com',
    company: 'Acme',
    whatsapp_opt_in: true,
  }

  it('only retries failed recipients', () => {
    const recipients = [
      { id: 'r1', status: 'failed' as const, contact },
      { id: 'r2', status: 'sent' as const, contact },
      { id: 'r3', status: 'delivered' as const, contact },
      { id: 'r4', status: 'read' as const, contact },
      { id: 'r5', status: 'replied' as const, contact },
    ]

    const result = getRetryableRecipients(recipients)

    expect(result.retryable.map((r) => r.id)).toEqual(['r1'])
    expect(result.skipped).toHaveLength(4)
    expect(result.skipped.map((s) => s.recipientId)).toEqual([
      'r2',
      'r3',
      'r4',
      'r5',
    ])
  })

  it('skips failed recipients with missing contact data', () => {
    const result = getRetryableRecipients([
      { id: 'missing-contact', status: 'failed' as const, contact: null },
      {
        id: 'missing-phone',
        status: 'failed' as const,
        contact: { ...contact, phone: '' },
      },
    ])

    expect(result.retryable).toHaveLength(0)
    expect(result.skipped.map((s) => s.reason)).toEqual([
      'Contact no longer exists.',
      'Contact has no phone number.',
    ])
  })

  it('skips failed recipients that are not opted in or are opted out', () => {
    const result = getRetryableRecipients([
      {
        id: 'not-opted-in',
        status: 'failed' as const,
        contact: { ...contact, whatsapp_opt_in: false },
      },
      {
        id: 'opted-out',
        status: 'failed' as const,
        contact: { ...contact, opted_out_at: '2026-05-01T00:00:00.000Z' },
      },
    ])

    expect(result.retryable).toHaveLength(0)
    expect(result.skipped.map((s) => s.reason)).toEqual([
      'Contact is not opted in.',
      'Contact is opted out.',
    ])
  })
})

describe('classifyBroadcastFailure', () => {
  it('classifies temporary Meta/network failures', () => {
    expect(classifyBroadcastFailure('Meta API error: 500')).toBe('temporary')
    expect(classifyBroadcastFailure('rate limit exceeded')).toBe('temporary')
    expect(classifyBroadcastFailure('network timeout')).toBe('temporary')
  })

  it('classifies permanent recipient/template failures', () => {
    expect(classifyBroadcastFailure('Invalid phone number format')).toBe(
      'permanent',
    )
    expect(
      classifyBroadcastFailure('(#131030) Recipient phone number not in allowed list'),
    ).toBe('permanent')
    expect(classifyBroadcastFailure('template is not approved')).toBe(
      'permanent',
    )
  })

  it('classifies everything else as unknown', () => {
    expect(classifyBroadcastFailure('something unusual happened')).toBe(
      'unknown',
    )
  })
})

describe('resolveBroadcastVariables', () => {
  it('resolves static, contact field, and custom field mappings in numeric order', () => {
    const custom = new Map([['field-1', 'Gold']])

    expect(
      resolveBroadcastVariables(
        {
          '2': { type: 'field', value: 'name' },
          '1': { type: 'static', value: 'Hello' },
          '10': { type: 'custom_field', value: 'field-1' },
        },
        {
          name: 'Ada',
          phone: '923001234567',
          email: 'ada@example.com',
          company: 'Acme',
        },
        custom,
      ),
    ).toEqual(['Hello', 'Ada', 'Gold'])
  })
})
