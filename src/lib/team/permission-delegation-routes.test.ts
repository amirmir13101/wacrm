import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('team permission delegation routes', () => {
  const createRoute = readFileSync(
    join(process.cwd(), 'src/app/api/team/members/route.ts'),
    'utf8',
  )
  const updateRoute = readFileSync(
    join(process.cwd(), 'src/app/api/team/members/[id]/route.ts'),
    'utf8',
  )
  const invitationRoute = readFileSync(
    join(process.cwd(), 'src/app/api/team/invitations/route.ts'),
    'utf8',
  )

  it('validates delegated roles and permissions on every creation path', () => {
    for (const source of [createRoute, invitationRoute]) {
      expect(source).toContain('canManageWorkspaceRole(actor.role, role)')
      expect(source).toContain('canDelegatePermissions(actor, permissions)')
      expect(source).toContain("status: 403")
    }
  })

  it('prevents lower roles from editing or deleting equal and higher roles', () => {
    expect(updateRoute).toContain('canManageWorkspaceRole(actor.role, existing.role)')
    expect(updateRoute).toContain('canManageWorkspaceRole(workspaceResult.workspace.role, existing.role)')
    expect(updateRoute).toContain('canDelegatePermissions(actor, body.permissions)')
  })
})
