import { NextResponse } from 'next/server'

import { validateInvitationToken } from '@/lib/team/invitations'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token : ''
  const result = await validateInvitationToken(token)

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Invalid invitation' }, { status: 400 })
  }

  return NextResponse.json({ invitation: result.invitation })
}
