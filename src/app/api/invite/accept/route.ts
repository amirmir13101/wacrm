import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { acceptInvitation } from '@/lib/team/invitations'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return NextResponse.json({ error: 'Please login to accept this invitation' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token : ''
  const result = await acceptInvitation({
    token,
    userId: user.id,
    email: user.email,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, invited_email: result.invitedEmail },
      { status: result.status },
    )
  }

  return NextResponse.json({ success: true, workspace_id: result.workspaceId })
}
