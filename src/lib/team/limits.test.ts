import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  FREE_TEAM_MEMBER_LIMIT,
  PRO_TEAM_MEMBER_LIMIT,
  teamMemberLimitMessage,
  workspaceTeamMemberLimit,
} from './limits'

describe('workspace team member limits', () => {
  it('allows one non-owner team member on free/trial workspaces', () => {
    expect(workspaceTeamMemberLimit({ planType: 'trial', subscriptionStatus: 'trialing' })).toBe(
      FREE_TEAM_MEMBER_LIMIT,
    )
  })

  it('allows ten non-owner team members on active Pro workspaces', () => {
    expect(
      workspaceTeamMemberLimit({
        planType: 'pro',
        subscriptionStatus: 'active',
        subscriptionEndsAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ).toBe(PRO_TEAM_MEMBER_LIMIT)
  })

  it('falls back to the free limit when Pro is expired', () => {
    expect(
      workspaceTeamMemberLimit({
        planType: 'pro',
        subscriptionStatus: 'active',
        subscriptionEndsAt: new Date(Date.now() - 86_400_000).toISOString(),
      }),
    ).toBe(FREE_TEAM_MEMBER_LIMIT)
  })

  it('uses the required upgrade message', () => {
    expect(teamMemberLimitMessage(1)).toBe(
      'Your current plan allows up to 1 team member(s). Upgrade your plan to invite more team members.',
    )
  })

  it('enforces the same limit in direct member creation and legacy invitations', () => {
    const membersRoute = readFileSync(
      join(process.cwd(), 'src/app/api/team/members/route.ts'),
      'utf8',
    )
    const invitationsRoute = readFileSync(
      join(process.cwd(), 'src/app/api/team/invitations/route.ts'),
      'utf8',
    )

    expect(membersRoute).toContain('getWorkspaceTeamLimitStatus')
    expect(membersRoute).toContain('teamLimit.message')
    expect(invitationsRoute).toContain('getWorkspaceTeamLimitStatus')
    expect(invitationsRoute).toContain('teamLimit.message')
  })
})

