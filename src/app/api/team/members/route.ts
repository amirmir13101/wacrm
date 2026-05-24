import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireCurrentWorkspace, listWorkspaceMembers } from '@/lib/team/server'
import { canManageTeam } from '@/lib/team/assignment'

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    )
  }

  const members = await listWorkspaceMembers(workspaceResult.workspace.workspaceId)
  return NextResponse.json({
    workspace_id: workspaceResult.workspace.workspaceId,
    current_user_id: workspaceResult.workspace.userId,
    current_role: workspaceResult.workspace.role,
    can_manage_team: canManageTeam(workspaceResult.workspace.role),
    members,
  })
}

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json(
      { error: workspaceResult.error },
      { status: workspaceResult.status },
    )
  }
  if (!canManageTeam(workspaceResult.workspace.role)) {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = typeof body.role === 'string' ? body.role : 'agent'

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }
  if (!['admin', 'manager', 'agent'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('user_id, approval_status')
    .ilike('email', email)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }
  if (!profile) {
    return NextResponse.json(
      { error: 'No approved CRM user found with that email.' },
      { status: 404 },
    )
  }
  if (profile.approval_status !== 'approved') {
    return NextResponse.json(
      { error: 'User must be approved before joining a workspace.' },
      { status: 400 },
    )
  }

  const { error } = await admin.from('workspace_members').upsert(
    {
      workspace_id: workspaceResult.workspace.workspaceId,
      user_id: profile.user_id,
      role,
      status: 'active',
      joined_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,user_id' },
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await admin.from('agent_status').upsert(
    {
      workspace_id: workspaceResult.workspace.workspaceId,
      user_id: profile.user_id,
      availability: 'online',
    },
    { onConflict: 'workspace_id,user_id' },
  )

  return NextResponse.json({ success: true })
}
