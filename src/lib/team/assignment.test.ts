import { describe, expect, it } from 'vitest'

import {
  canAssignConversation,
  canSeeConversation,
  leastBusyAgent,
  nextRoundRobinAgent,
} from './assignment'

const members = [
  { user_id: 'agent-a', role: 'agent', status: 'active' },
  { user_id: 'agent-b', role: 'agent', status: 'active' },
  { user_id: 'agent-c', role: 'agent', status: 'suspended' },
]

describe('team assignment helpers', () => {
  it('allows managers to assign conversations to any active agent', () => {
    expect(
      canAssignConversation({
        role: 'manager',
        actorUserId: 'manager-1',
        currentAssignedUserId: 'agent-a',
        nextAssignedUserId: 'agent-b',
      }),
    ).toBe(true)
  })

  it('allows agents to self-assign only unassigned conversations', () => {
    expect(
      canAssignConversation({
        role: 'agent',
        actorUserId: 'agent-a',
        currentAssignedUserId: null,
        nextAssignedUserId: 'agent-a',
      }),
    ).toBe(true)
    expect(
      canAssignConversation({
        role: 'agent',
        actorUserId: 'agent-a',
        currentAssignedUserId: 'agent-b',
        nextAssignedUserId: 'agent-a',
      }),
    ).toBe(false)
  })

  it('filters conversation visibility for agents', () => {
    expect(
      canSeeConversation({
        role: 'agent',
        actorUserId: 'agent-a',
        assignedAgentId: 'agent-a',
      }),
    ).toBe(true)
    expect(
      canSeeConversation({
        role: 'agent',
        actorUserId: 'agent-a',
        assignedAgentId: 'agent-b',
      }),
    ).toBe(false)
    expect(
      canSeeConversation({
        role: 'admin',
        actorUserId: 'admin-1',
        assignedAgentId: 'agent-b',
      }),
    ).toBe(true)
  })

  it('rotates round-robin across active members only', () => {
    expect(nextRoundRobinAgent(members)).toBe('agent-a')
    expect(nextRoundRobinAgent(members, 'agent-a')).toBe('agent-b')
    expect(nextRoundRobinAgent(members, 'agent-b')).toBe('agent-a')
  })

  it('chooses the least busy active member', () => {
    expect(
      leastBusyAgent([
        { user_id: 'agent-a', role: 'agent', status: 'active', open_conversations: 4 },
        { user_id: 'agent-b', role: 'agent', status: 'active', open_conversations: 1 },
        { user_id: 'agent-c', role: 'agent', status: 'suspended', open_conversations: 0 },
      ]),
    ).toBe('agent-b')
  })
})
