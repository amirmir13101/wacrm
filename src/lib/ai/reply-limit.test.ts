import { describe, expect, it } from 'vitest'
import {
  autoReplyClaimLimit,
  DEFAULT_AUTO_REPLY_LIMIT,
  hasReachedAutoReplyLimit,
  MAX_AUTO_REPLY_LIMIT,
  normalizeAutoReplyLimit,
  UNLIMITED_AUTO_REPLY_CLAIM_LIMIT,
  UNLIMITED_AUTO_REPLY_LIMIT,
} from './reply-limit'

describe('AI auto-reply limits', () => {
  it('preserves zero as the Unlimited sentinel', () => {
    expect(normalizeAutoReplyLimit(0)).toBe(UNLIMITED_AUTO_REPLY_LIMIT)
    expect(normalizeAutoReplyLimit('0')).toBe(UNLIMITED_AUTO_REPLY_LIMIT)
  })

  it('keeps finite limits inside the existing 1–20 range', () => {
    expect(normalizeAutoReplyLimit(1)).toBe(1)
    expect(normalizeAutoReplyLimit(12.9)).toBe(12)
    expect(normalizeAutoReplyLimit(99)).toBe(MAX_AUTO_REPLY_LIMIT)
    expect(normalizeAutoReplyLimit(-5)).toBe(1)
    expect(normalizeAutoReplyLimit('not-a-number')).toBe(
      DEFAULT_AUTO_REPLY_LIMIT,
    )
  })

  it('never reports the cap reached when Unlimited is selected', () => {
    expect(hasReachedAutoReplyLimit(0, UNLIMITED_AUTO_REPLY_LIMIT)).toBe(false)
    expect(hasReachedAutoReplyLimit(500_000, UNLIMITED_AUTO_REPLY_LIMIT)).toBe(
      false,
    )
  })

  it('preserves normal finite-cap behavior', () => {
    expect(hasReachedAutoReplyLimit(2, 3)).toBe(false)
    expect(hasReachedAutoReplyLimit(3, 3)).toBe(true)
  })

  it('maps Unlimited to a database-safe atomic claim cap', () => {
    expect(autoReplyClaimLimit(UNLIMITED_AUTO_REPLY_LIMIT)).toBe(
      UNLIMITED_AUTO_REPLY_CLAIM_LIMIT,
    )
    expect(autoReplyClaimLimit(7)).toBe(7)
  })
})
