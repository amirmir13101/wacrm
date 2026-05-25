import { describe, expect, it } from 'vitest'

import {
  createInviteToken,
  defaultInviteVisibility,
  hashInviteToken,
  inviteUrl,
} from './invitations'

describe('workspace invitations', () => {
  it('creates secure non-reversible invite token hashes', () => {
    const token = createInviteToken()
    const hash = hashInviteToken(token)

    expect(token.length).toBeGreaterThanOrEqual(32)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).not.toBe(token)
    expect(hashInviteToken(token)).toBe(hash)
  })

  it('uses safe visibility defaults for invited agents', () => {
    expect(defaultInviteVisibility('agent')).toEqual({
      contact_visibility: 'assigned_only',
      conversation_visibility: 'unassigned_and_assigned',
      deal_visibility: 'assigned_only',
    })
  })

  it('uses full workspace visibility defaults for manager/admin invites', () => {
    expect(defaultInviteVisibility('manager')).toEqual({
      contact_visibility: 'all',
      conversation_visibility: 'all',
      deal_visibility: 'all',
    })
  })

  it('builds invite accept URLs without exposing token hashes', () => {
    const url = inviteUrl('plain-token-value')

    expect(url).toContain('/invite/accept?token=plain-token-value')
    expect(url).not.toContain(hashInviteToken('plain-token-value'))
  })
})
