import { describe, expect, it } from 'vitest'
import { buildAiThreadUpdate } from './thread-state'

describe('buildAiThreadUpdate', () => {
  it('preserves normal human takeover behavior', () => {
    expect(
      buildAiThreadUpdate({
        paused: true,
        assignToMe: true,
        userId: 'agent-1',
      }),
    ).toEqual({
      ai_autoreply_disabled: true,
      assigned_agent_id: 'agent-1',
    })
  })

  it('fully resets takeover state and records a fresh AI context boundary', () => {
    expect(
      buildAiThreadUpdate({
        paused: false,
        assignToMe: false,
        userId: 'agent-1',
        resumedAt: '2026-08-31T12:00:00.000Z',
      }),
    ).toEqual({
      ai_autoreply_disabled: false,
      assigned_agent_id: null,
      ai_reply_count: 0,
      ai_handoff_summary: null,
      ai_resumed_at: '2026-08-31T12:00:00.000Z',
    })
  })
})
