import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const validateRoute = readFileSync(
  join(process.cwd(), 'src/app/api/invite/validate/route.ts'),
  'utf8',
)
const acceptRoute = readFileSync(
  join(process.cwd(), 'src/app/api/invite/accept/route.ts'),
  'utf8',
)
const loginPage = readFileSync(
  join(process.cwd(), 'src/app/(auth)/login/page.tsx'),
  'utf8',
)
const signupPage = readFileSync(
  join(process.cwd(), 'src/app/(auth)/signup/page.tsx'),
  'utf8',
)
const acceptPage = readFileSync(
  join(process.cwd(), 'src/app/invite/accept/page.tsx'),
  'utf8',
)

describe('invite auth flow persistence', () => {
  it('stores a valid invite token in a short-lived secure cookie', () => {
    expect(validateRoute).toContain('response.cookies.set(INVITE_TOKEN_COOKIE')
    expect(validateRoute).toContain('httpOnly: true')
    expect(validateRoute).toContain("sameSite: 'lax'")
    expect(validateRoute).toContain('maxAge: INVITE_COOKIE_MAX_AGE_SECONDS')
  })

  it('clears the invite cookie after invalid validation or successful acceptance', () => {
    expect(validateRoute).toContain('response.cookies.delete(INVITE_TOKEN_COOKIE)')
    expect(acceptRoute).toContain('response.cookies.delete(INVITE_TOKEN_COOKIE)')
  })

  it('accepts invite tokens from either request body or cookie fallback', () => {
    expect(acceptRoute).toContain("request.cookies.get(INVITE_TOKEN_COOKIE)?.value")
    expect(acceptRoute).toContain('explicitToken || request.cookies.get')
  })

  it('lets login and signup continue a cookie-backed invite flow', () => {
    expect(loginPage).toContain('cookieInviteActive')
    expect(loginPage).toContain('inviteActive')
    expect(loginPage).toContain('inviteAcceptPath()')
    expect(signupPage).toContain('cookieInviteActive')
    expect(signupPage).toContain('emailRedirectTo')
    expect(signupPage).toContain('/invite/accept')
  })

  it('lets the accept page validate from cookie when the URL token is missing', () => {
    expect(acceptPage).toContain('body: JSON.stringify(token ? { token } : {})')
    expect(acceptPage).not.toContain('Invite token is required')
  })
})
