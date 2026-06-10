import { NextResponse, type NextRequest } from 'next/server'

import {
  INVITE_COOKIE_MAX_AGE_SECONDS,
  INVITE_TOKEN_COOKIE,
  friendlyInviteError,
  validateInvitationToken,
} from '@/lib/team/invitations'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const explicitToken = typeof body.token === 'string' ? body.token : ''
  const cookieToken = request.cookies.get(INVITE_TOKEN_COOKIE)?.value ?? ''
  const token = explicitToken || cookieToken
  const result = await validateInvitationToken(token)

  if (!result.ok) {
    const response = NextResponse.json(
      { error: friendlyInviteError(result.error), has_invite_cookie: Boolean(cookieToken) },
      { status: 400 },
    )
    response.cookies.delete(INVITE_TOKEN_COOKIE)
    return response
  }

  const response = NextResponse.json({
    invitation: result.invitation,
    token_source: explicitToken ? 'query' : 'cookie',
  })
  response.cookies.set(INVITE_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: INVITE_COOKIE_MAX_AGE_SECONDS,
  })
  return response
}
