import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const bootstrapRoute = read('src/app/api/auth/bootstrap/route.ts')
const loginPage = read('src/app/(auth)/login/page.tsx')
const changePasswordPage = read('src/app/change-password/page.tsx')
const middleware = read('src/middleware.ts')

describe('auth bootstrap after forced password change', () => {
  it('adds a server-side bootstrap endpoint for fresh profile and workspace routing', () => {
    expect(bootstrapRoute).toContain('export async function GET')
    expect(bootstrapRoute).toContain('supabase.auth.getUser()')
    expect(bootstrapRoute).toContain('supabaseAdmin()')
    expect(bootstrapRoute).toContain('must_change_password')
    expect(bootstrapRoute).toContain('ensureApprovedUserOwnWorkspace(user.id)')
    expect(bootstrapRoute).toContain('listCurrentUserWorkspaces(user.id)')
    expect(bootstrapRoute).toContain('redirectTo: authenticatedRedirectPath(profile)')
  })

  it('returns clear login errors when a team member has no active workspace', () => {
    expect(bootstrapRoute).toContain('Your team account is not connected to an active workspace')
    expect(bootstrapRoute).toContain('Login succeeded, but your workspace could not be loaded')
    expect(bootstrapRoute).toContain('{ status: 409 }')
  })

  it('makes login wait for a session and retry bootstrap before redirecting', () => {
    expect(loginPage).toContain('AUTH_BOOTSTRAP_RETRY_DELAYS')
    expect(loginPage).toContain('fetch("/api/auth/bootstrap"')
    expect(loginPage).toContain('supabase.auth.getSession()')
    expect(loginPage).toContain('throw new Error("Login succeeded, but your session was not ready')
    expect(loginPage).toContain('const redirectTo = await loadAuthBootstrap()')
    expect(loginPage).toContain('refreshClientRoute(router, redirectTo)')
  })

  it('keeps invite login separate from normal bootstrap login', () => {
    expect(loginPage).toContain('if (inviteActive)')
    expect(loginPage).toContain('refreshClientRoute(router, inviteRedirectPath)')
  })

  it('signs out after forced password change so the next login starts cleanly', () => {
    expect(changePasswordPage).toContain('supabase.auth.signOut()')
    expect(changePasswordPage).toContain('/login?password_changed=1')
    expect(loginPage).toContain('Password changed. Please sign in with your new password.')
  })

  it('keeps middleware guards for password-change and admin separation', () => {
    expect(middleware).toContain("profile?.must_change_password")
    expect(middleware).toContain("url.pathname = '/change-password'")
    expect(middleware).toContain("request.nextUrl.pathname === '/change-password'")
    expect(middleware).toContain("request.nextUrl.pathname.startsWith('/admin') && !isAdmin(profile)")
  })
})
