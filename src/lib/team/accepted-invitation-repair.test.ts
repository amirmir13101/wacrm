import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const serverSource = readFileSync(join(process.cwd(), 'src/lib/team/server.ts'), 'utf8')
const repairSource = serverSource.slice(serverSource.indexOf('async function repairAcceptedInvitationMembership'))

describe('accepted invitation membership repair', () => {
  it('repairs accepted invite memberships only after the normal member lookup fails', () => {
    expect(serverSource).toContain('if (!member) {')
    expect(serverSource).toContain('member = await repairAcceptedInvitationMembership(user.id)')
  })

  it('restores active workspace membership from accepted invitations without granting owner access', () => {
    expect(repairSource).toContain(".from('workspace_invitations')")
    expect(repairSource).toContain(".eq('accepted_by_user_id', userId)")
    expect(repairSource).toContain(".eq('status', 'accepted')")
    expect(repairSource).toContain("role: invitation.role")
    expect(repairSource).not.toContain("role: 'owner'")
  })

  it('keeps invite permissions and visibility when restoring membership', () => {
    expect(repairSource).toContain('permissions: invitation.permissions ?? {}')
    expect(repairSource).toContain("contact_visibility: invitation.contact_visibility ?? 'assigned_only'")
    expect(repairSource).toContain("conversation_visibility: invitation.conversation_visibility ?? 'unassigned_and_assigned'")
    expect(repairSource).toContain("deal_visibility: invitation.deal_visibility ?? 'assigned_only'")
  })
})
