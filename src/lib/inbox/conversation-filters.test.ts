import { describe, expect, it } from 'vitest'
import type { Conversation } from '@/types'
import {
  filterConversationsByView,
  isAiHandoffConversation,
} from './conversation-filters'

function conversation(
  id: string,
  aiAutoreplyDisabled: boolean,
): Conversation {
  return {
    id,
    user_id: 'user-1',
    contact_id: `contact-${id}`,
    status: 'open',
    unread_count: 0,
    created_at: '2026-08-31T12:00:00.000Z',
    updated_at: '2026-08-31T12:00:00.000Z',
    ai_autoreply_disabled: aiAutoreplyDisabled,
  }
}

describe('AI Handoff conversation filtering', () => {
  const active = conversation('active', false)
  const handedOff = conversation('handoff', true)

  it('keeps every conversation in the normal Inbox', () => {
    expect(filterConversationsByView([active, handedOff], 'inbox')).toEqual([
      active,
      handedOff,
    ])
  })

  it('shows only conversations currently paused for human attention', () => {
    expect(isAiHandoffConversation(handedOff)).toBe(true)
    expect(
      filterConversationsByView([active, handedOff], 'ai_handoff'),
    ).toEqual([handedOff])
  })

  it('removes a conversation immediately after Resume AI clears the flag', () => {
    const resumed = { ...handedOff, ai_autoreply_disabled: false }
    expect(filterConversationsByView([resumed], 'ai_handoff')).toEqual([])
    expect(filterConversationsByView([resumed], 'inbox')).toEqual([resumed])
  })
})
