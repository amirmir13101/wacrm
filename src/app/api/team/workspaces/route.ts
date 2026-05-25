import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { createClient } from '@/lib/supabase/server'
import { listCurrentUserWorkspaces } from '@/lib/team/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaces = await listCurrentUserWorkspaces(user.id)
  return NextResponse.json({ workspaces })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''
  if (!workspaceId) return NextResponse.json({ error: 'Workspace is required' }, { status: 400 })

  const admin = supabaseAdmin()
  const { data: member, error } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!member) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const { error: updateError } = await admin
    .from('profiles')
    .update({ active_workspace_id: workspaceId })
    .eq('user_id', user.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
