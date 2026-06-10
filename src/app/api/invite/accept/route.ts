import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { INVITE_TOKEN_COOKIE, friendlyInviteError, acceptInvitation } from '@/lib/team/invitations'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return NextResponse.json({ error: 'Please login to accept this invitation' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const explicitToken = typeof body.token === 'string' ? body.token : ''
  const token = explicitToken || request.cookies.get(INVITE_TOKEN_COOKIE)?.value || ''
  const result = await acceptInvitation({
    token,
    userId: user.id,
    email: user.email,
  })

  if (!result.ok) {
    const response = NextResponse.json(
      { error: friendlyInviteError(result.error), invited_email: result.invitedEmail },
      { status: result.status },
    )
    if (result.status !== 403) response.cookies.delete(INVITE_TOKEN_COOKIE)
    return response
  }

  const response = NextResponse.json({ success: true, workspace_id: result.workspaceId })
  response.cookies.delete(INVITE_TOKEN_COOKIE)
  return response
}
