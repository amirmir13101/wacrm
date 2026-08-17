import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireWorkspacePermission } from '@/lib/team/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

const ACTIVE_BROADCAST_DELETE_STATUSES = new Set(['queued', 'sending'])

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params
  const workspaceResult = await requireWorkspacePermission('pause_resume_cancel_broadcasts')
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspaceId = workspaceResult.workspace.workspaceId
  const supabase = supabaseAdmin()
  const { data: broadcast, error: fetchError } = await supabase
    .from('broadcasts')
    .select('id, status')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!broadcast) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })

  if (ACTIVE_BROADCAST_DELETE_STATUSES.has(broadcast.status)) {
    return NextResponse.json(
      { error: 'Cannot delete while a broadcast is queued or actively sending. Pause or cancel it first.' },
      { status: 400 },
    )
  }

  const { error: deleteError } = await supabase
    .from('broadcasts')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ ok: true, deleted: true, broadcastId: id })
}
