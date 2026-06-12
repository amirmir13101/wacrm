import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const loginPage = read('src/app/(auth)/login/page.tsx')
const changePasswordPage = read('src/app/change-password/page.tsx')
const teamPage = read('src/app/(dashboard)/team/page.tsx')
const adminUsersPage = read('src/app/admin/users/page.tsx')
const adminContactsPage = read('src/app/admin/contacts/page.tsx')
const refreshHelper = read('src/lib/ui/post-mutation.ts')

describe('CRM stale UI refresh patterns', () => {
  it('uses a shared client route refresh helper after mutations and auth transitions', () => {
    expect(refreshHelper).toContain('export function refreshClientRoute')
    expect(refreshHelper).toContain('router.replace(path)')
    expect(refreshHelper).toContain('router.refresh()')
  })

  it('resets login loading and refreshes session/router after successful sign-in', () => {
    expect(loginPage).toContain('try {')
    expect(loginPage).toContain('finally')
    expect(loginPage).toContain('setLoading(false)')
    expect(loginPage).toContain('supabase.auth.getSession()')
    expect(loginPage).toContain('loadAuthBootstrap()')
    expect(loginPage).toContain('refreshClientRoute(router, redirectTo)')
    expect(loginPage).toContain('refreshClientRoute(router, inviteRedirectPath)')
  })

  it('clears stale auth state and returns to login after first-login password change', () => {
    expect(changePasswordPage).toContain('supabase.auth.signOut()')
    expect(changePasswordPage).toContain('Password changed. Please sign in with your new password.')
    expect(changePasswordPage).toContain('window.location.replace("/login?password_changed=1")')
    expect(changePasswordPage).toContain('setNewPassword("")')
    expect(changePasswordPage).toContain('finally')
    expect(changePasswordPage).toContain('setSaving(false)')
  })

  it('updates Team page state immediately after member mutations', () => {
    expect(teamPage).toContain('loadTeam(options: { showLoading?: boolean } = {})')
    expect(teamPage).toContain('await loadTeam({ showLoading: false })')
    expect(teamPage).toContain('item.id !== member.id && item.user_id !== member.user_id')
    expect(teamPage).toContain('toast.error(error instanceof Error ? error.message : "Failed to delete team member")')
  })

  it('updates Admin Users rows according to the active filter after mutations', () => {
    expect(adminUsersPage).toContain('function userBelongsInCurrentFilter')
    expect(adminUsersPage).toContain('current.flatMap((user)')
    expect(adminUsersPage).toContain('return userBelongsInCurrentFilter(updated) ? [updated] : []')
    expect(adminUsersPage).toContain('await loadUsers()')
    expect(adminUsersPage).toContain('setUsers((current) => current.filter')
  })

  it('removes deleted admin contact imports locally before refetching pagination', () => {
    expect(adminContactsPage).toContain('const deletedIds = new Set(confirmIds)')
    expect(adminContactsPage).toContain('setImports((current) => current.filter((item) => !deletedIds.has(item.id)))')
    expect(adminContactsPage).toContain('setTotal((current) => Math.max(0, current - deletedVisibleCount))')
    expect(adminContactsPage).toContain('setSelectedIds(new Set())')
    expect(adminContactsPage).toContain('await loadImports(nextPage, pageSize)')
  })
})
