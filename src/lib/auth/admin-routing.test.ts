import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const loginPage = readFileSync(
  join(process.cwd(), 'src/app/(auth)/login/page.tsx'),
  'utf8',
)
const middleware = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')
const homePage = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8')
const sidebar = readFileSync(join(process.cwd(), 'src/components/layout/sidebar.tsx'), 'utf8')

describe('platform admin routing separation', () => {
  it('uses role-aware destinations after normal login and home redirect', () => {
    expect(loginPage).toContain('/api/auth/bootstrap')
    expect(loginPage).toContain('loadAuthBootstrap()')
    expect(homePage).toContain('authenticatedRedirectPath(profile)')
  })

  it('preserves invite login flow before role-aware normal redirects', () => {
    expect(loginPage).toContain('if (inviteActive)')
    expect(loginPage).toContain('refreshClientRoute(router, inviteRedirectPath)')
    expect(loginPage).toContain('inviteAuthPath("/signup"')
  })

  it('redirects approved platform admins away from workspace routes', () => {
    expect(middleware).toContain("url.pathname = authenticatedRedirectPath(profile)")
    expect(middleware).toContain("isAdmin(profile) && !request.nextUrl.pathname.startsWith('/admin')")
    expect(middleware).toContain("url.pathname = '/admin'")
  })

  it('blocks non-admins from admin routes', () => {
    expect(middleware).toContain("request.nextUrl.pathname.startsWith('/admin') && !isAdmin(profile)")
    expect(middleware).toContain("url.pathname = '/dashboard'")
  })

  it('removes platform admin links from the normal CRM sidebar', () => {
    expect(sidebar).not.toContain('/admin/users')
    expect(sidebar).not.toContain('Admin users')
  })
})
