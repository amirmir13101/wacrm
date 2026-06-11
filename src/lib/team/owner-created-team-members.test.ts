import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const migration = read('supabase/migrations/028_owner_created_team_members.sql')
const teamMembersRoute = read('src/app/api/team/members/route.ts')
const teamMemberRoute = read('src/app/api/team/members/[id]/route.ts')
const teamPage = read('src/app/(dashboard)/team/page.tsx')
const middleware = read('src/middleware.ts')
const changePasswordPage = read('src/app/change-password/page.tsx')
const changePasswordRoute = read('src/app/api/auth/change-password/route.ts')
const signupCheckRoute = read('src/app/api/auth/signup-check/route.ts')
const signupPage = read('src/app/(auth)/signup/page.tsx')
const teamServer = read('src/lib/team/server.ts')
const adminUsersRoute = read('src/app/api/admin/users/route.ts')

describe('owner-created team member accounts', () => {
  it('adds durable account type and first-login password flags', () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'workspace_owner'")
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false')
    expect(migration).toContain('temporary_password_set_at TIMESTAMPTZ')
    expect(migration).toContain("'platform_admin'")
    expect(migration).toContain("'workspace_owner'")
    expect(migration).toContain("'team_member'")
    expect(migration).toContain('idx_profiles_must_change_password')
  })

  it('creates approved team-member auth accounts with a one-time temporary password response', () => {
    expect(teamMembersRoute).toContain('admin.auth.admin.createUser')
    expect(teamMembersRoute).toContain('email_confirm: true')
    expect(teamMembersRoute).toContain("account_type: 'team_member'")
    expect(teamMembersRoute).toContain('must_change_password: true')
    expect(teamMembersRoute).toContain('temporary_password_set_at')
    expect(teamMembersRoute).toContain("approval_status: 'approved'")
    expect(teamMembersRoute).toContain('temporary_password: temporaryPassword')
    expect(teamMembersRoute).toContain('Temporary passwords do not match')
  })

  it('replaces new invite-link creation with direct team member creation in the Team UI', () => {
    expect(teamPage).toContain('Add Team Member')
    expect(teamPage).toContain('Temporary password')
    expect(teamPage).toContain('Confirm password')
    expect(teamPage).toContain('Create Team Member')
    expect(teamPage).toContain('The temporary password is shown only once')
    expect(teamPage).toContain('Legacy pending invitations')
    expect(teamPage).not.toContain('Invite team member')
    expect(teamPage).not.toContain('createInvite')
  })

  it('allows owners to delete only owner-created team member accounts safely', () => {
    expect(teamMemberRoute).toContain("profile?.account_type !== 'team_member'")
    expect(teamMemberRoute).toContain('Only owner-created team member accounts can be permanently deleted here.')
    expect(teamMemberRoute).toContain('Workspace owner cannot be deleted here')
    expect(teamMemberRoute).toContain('You cannot delete your own account from Team')
    expect(teamMemberRoute).toContain('assigned_agent_id: null')
    expect(teamMemberRoute).toContain('assigned_to: null')
    expect(teamMemberRoute).toContain('admin.auth.admin.deleteUser')
    expect(teamMemberRoute).toContain('conversationCleanup.error')
    expect(teamMemberRoute).toContain('dealCleanup.error')
  })

  it('forces first-login password change before CRM access', () => {
    expect(middleware).toContain("request.nextUrl.pathname !== '/change-password'")
    expect(middleware).toContain("url.pathname = '/change-password'")
    expect(middleware).toContain("'Password change required'")
    expect(middleware).toContain("request.nextUrl.pathname !== '/api/auth/change-password'")
    expect(changePasswordPage).toContain('Please create a new password before continuing.')
    expect(changePasswordPage).toContain('New password')
    expect(changePasswordPage).toContain('Confirm new password')
    expect(changePasswordPage).toContain('Save password')
  })

  it('clears the password-change flag only after a secure auth password update', () => {
    expect(changePasswordRoute).toContain('admin.auth.admin.updateUserById')
    expect(changePasswordRoute).toContain('must_change_password: false')
    expect(changePasswordRoute).toContain('temporary_password_set_at: null')
    expect(changePasswordRoute).toContain('New password must be at least 8 characters.')
    expect(changePasswordRoute).toContain('Password change is not required.')
  })

  it('keeps normal signup separate from team-member accounts', () => {
    expect(signupPage).toContain('/api/auth/signup-check')
    expect(signupCheckRoute).toContain('account_type === "team_member"')
    expect(signupCheckRoute).toContain('This email is already used as a team member account')
  })

  it('prevents team members from becoming workspace owners or platform admin customers by default', () => {
    expect(teamServer).toContain("profile.account_type === 'team_member'")
    expect(adminUsersRoute).toContain("profile.account_type === 'team_member'")
    expect(adminUsersRoute).toContain('return null')
  })
})
