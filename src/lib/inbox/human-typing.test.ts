import { describe, expect, it } from 'vitest'
import {
  HUMAN_TYPING_MIN_SIGNAL_INTERVAL_MS,
  shouldSendHumanTypingSignal,
} from './human-typing'

describe('human WhatsApp typing signal policy', () => {
  it('never signals while AI owns the conversation', () => {
    expect(
      shouldSendHumanTypingSignal({
        handoffActive: false,
        lastSignalAt: 0,
        now: 1,
      }),
    ).toBe(false)
  })

  it('signals the first real typing activity during Human Handoff', () => {
    expect(
      shouldSendHumanTypingSignal({
        handoffActive: true,
        lastSignalAt: 0,
        now: 1,
      }),
    ).toBe(true)
  })

  it('throttles repeated keystrokes and permits a later refresh', () => {
    const lastSignalAt = 10_000
    expect(
      shouldSendHumanTypingSignal({
        handoffActive: true,
        lastSignalAt,
        now: lastSignalAt + HUMAN_TYPING_MIN_SIGNAL_INTERVAL_MS - 1,
      }),
    ).toBe(false)
    expect(
      shouldSendHumanTypingSignal({
        handoffActive: true,
        lastSignalAt,
        now: lastSignalAt + HUMAN_TYPING_MIN_SIGNAL_INTERVAL_MS,
      }),
    ).toBe(true)
  })
})
