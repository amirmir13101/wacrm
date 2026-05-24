import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { canManageTeam } from '@/lib/team/assignment'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const update: Record<string, unknown> = {}

  if (typeof body.role === 'string') {
    if (!['owner', 'admin', 'manager', 'agent'].includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (body.role === 'owner') {
      return NextResponse.json({ error: 'Owner role cannot be assigned here' }, { status: 400 })
    }
    update.role = body.role
  }

  if (typeof body.status === 'string') {
    if (!['active', 'invited', 'suspended'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    update.status = body.status
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin()
    .from('workspace_members')
    .select('role, user_id')
    .eq('id', id)
    .eq('workspace_id', workspaceResult.workspace.workspaceId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (existing.role === 'owner') {
    return NextResponse.json({ error: 'Workspace owner cannot be changed here' }, { status: 400 })
  }

  const { error } = await supabaseAdmin()
    .from('workspace_members')
    .update(update)
    .eq('id', id)
    .eq('workspace_id', workspaceResult.workspace.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
