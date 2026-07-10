import { describe, expect, it } from 'vitest'
import {
  finalBroadcastStatus,
  getBroadcastContactEligibility,
  getQueueStatusAction,
  getRetryDelayMs,
  isCronSecretValid,
  safeBroadcastSendError,
  shouldFinalizeBroadcast,
  shouldProcessBroadcastStatus,
} from './broadcast-queue'
import type { Contact } from '@/types'

const baseContact: Contact = {
  id: 'c1',
  user_id: 'u1',
  phone: '923001234567',
  name: 'Ada',
  whatsapp_opt_in: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe('getBroadcastContactEligibility', () => {
  it('allows opted-in contacts', () => {
    expect(getBroadcastContactEligibility(baseContact)).toEqual({ eligible: true })
  })

  it('skips opted-out contacts when opt-out fields exist', () => {
    expect(
      getBroadcastContactEligibility({ ...baseContact, opted_out_at: new Date().toISOString() }),
    ).toEqual({ eligible: false, reason: 'Contact is opted out.' })
  })

  it('skips contacts not opted in', () => {
    expect(
      getBroadcastContactEligibility({ ...baseContact, whatsapp_opt_in: false }),
    ).toEqual({ eligible: false, reason: 'Contact is not opted in.' })
  })

  it('skips missing contact or phone', () => {
    expect(getBroadcastContactEligibility(null)).toEqual({
      eligible: false,
      reason: 'Contact no longer exists.',
    })
    expect(getBroadcastContactEligibility({ ...baseContact, phone: '' })).toEqual({
      eligible: false,
      reason: 'Contact has no phone number.',
    })
  })
})

describe('queue retry and finalization helpers', () => {
  it('schedules backoff only for temporary failures', () => {
    expect(getRetryDelayMs('Meta API error: 500', 1)).toBe(60_000)
    expect(getRetryDelayMs('rate limit exceeded', 2)).toBe(120_000)
    expect(getRetryDelayMs('Invalid phone number format', 1)).toBeNull()
  })

  it('finalizes only when no queue work remains', () => {
    expect(
      shouldFinalizeBroadcast({ pending: 0, sending: 0, failedRetryable: 0 }),
    ).toBe(true)
    expect(
      shouldFinalizeBroadcast({ pending: 1, sending: 0, failedRetryable: 0 }),
    ).toBe(false)
    expect(
      shouldFinalizeBroadcast({ pending: 0, sending: 0, failedRetryable: 1 }),
    ).toBe(false)
  })

  it('processes only queued or sending broadcasts', () => {
    expect(shouldProcessBroadcastStatus('queued')).toBe(true)
    expect(shouldProcessBroadcastStatus('sending')).toBe(true)
    expect(shouldProcessBroadcastStatus('paused')).toBe(false)
    expect(shouldProcessBroadcastStatus('cancelled')).toBe(false)
  })

  it('turns paused and cancelled campaign statuses into worker stop actions', () => {
    expect(getQueueStatusAction('queued')).toBe('process')
    expect(getQueueStatusAction('sending')).toBe('process')
    expect(getQueueStatusAction('paused')).toBe('pause')
    expect(getQueueStatusAction('cancelled')).toBe('cancel')
    expect(getQueueStatusAction('completed')).toBe('release')
  })

  it('requires the cron secret', () => {
    expect(isCronSecretValid('secret', 'secret')).toBe(true)
    expect(isCronSecretValid('secret', 'wrong')).toBe(false)
    expect(isCronSecretValid(undefined, 'secret')).toBe(false)
  })

  it('maps Meta #132001 template translation errors to an actionable permanent failure', () => {
    expect(
      safeBroadcastSendError(
        'Meta API error: 400 - (#132001) Template name does not exist in the translation',
      ),
    ).toBe(
      'Selected template/language is not available in Meta anymore. Please re-sync templates and select the approved template again.',
    )
  })

  it('marks all-failed campaigns failed and mixed campaigns completed', () => {
    expect(finalBroadcastStatus({ failed: 3, sentLike: 0, skipped: 0 })).toBe(
      'failed',
    )
    expect(finalBroadcastStatus({ failed: 1, sentLike: 2, skipped: 0 })).toBe(
      'completed',
    )
  })
})
