import { describe, expect, it } from 'vitest'

import {
  createInviteToken,
  defaultInviteVisibility,
  friendlyAuthError,
  friendlyInviteError,
  hashInviteToken,
  inviteAcceptPath,
  inviteAuthPath,
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

  it('preserves invite token in login and signup links', () => {
    expect(inviteAuthPath('/login', 'abc123')).toBe(
      '/login?invite_token=abc123&redirect=%2Finvite%2Faccept',
    )
    expect(inviteAuthPath('/signup', 'abc123', 'agent@example.com')).toBe(
      '/signup?invite_token=abc123&redirect=%2Finvite%2Faccept&email=agent%40example.com',
    )
  })

  it('redirects successful auth back to the tokenized accept page', () => {
    expect(inviteAcceptPath('abc123')).toBe('/invite/accept?token=abc123')
    expect(inviteAcceptPath()).toBe('/invite/accept')
  })

  it('builds cookie-backed auth links when the URL token is no longer present', () => {
    expect(inviteAuthPath('/login')).toBe('/login?invite=1&redirect=%2Finvite%2Faccept')
    expect(inviteAuthPath('/signup', '', 'agent@example.com')).toBe(
      '/signup?invite=1&redirect=%2Finvite%2Faccept&email=agent%40example.com',
    )
  })

  it('uses friendly invite and auth errors for common invite flow failures', () => {
    expect(friendlyInviteError('Invite token is required')).toContain('missing or incomplete')
    expect(friendlyInviteError('Invitation not found')).toContain('invalid or expired')
    expect(friendlyAuthError('Invalid login credentials')).toContain('email or password is incorrect')
    expect(friendlyAuthError('Email not confirmed')).toContain('email confirmation is required')
  })
})
