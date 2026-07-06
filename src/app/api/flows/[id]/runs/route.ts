import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireWorkspacePermission } from '@/lib/team/server'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const guard = await requireWorkspacePermission('view_flows')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = supabaseAdmin()
  const { data: flow, error: flowError } = await admin
    .from('flows')
    .select('id, name')
    .eq('id', id)
    .eq('workspace_id', guard.workspace.workspaceId)
    .maybeSingle()

  if (flowError) return NextResponse.json({ error: flowError.message }, { status: 500 })
  if (!flow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: runs, error: runsError } = await admin
    .from('flow_runs')
    .select(
      'id, status, current_node_key, started_at, last_advanced_at, ended_at, end_reason, vars, reprompt_count, contact:contacts(id, name, phone)',
    )
    .eq('flow_id', id)
    .eq('workspace_id', guard.workspace.workspaceId)
    .order('started_at', { ascending: false })
    .limit(50)

  if (runsError) return NextResponse.json({ error: runsError.message }, { status: 500 })

  const runIds = (runs ?? []).map((run) => (run as { id: string }).id)
  let events: Array<{
    flow_run_id: string
    event_type: string
    node_key: string | null
    payload: Record<string, unknown>
    created_at: string
  }> = []

  if (runIds.length > 0) {
    const { data: eventRows, error: eventsError } = await admin
      .from('flow_run_events')
      .select('flow_run_id, event_type, node_key, payload, created_at')
      .in('flow_run_id', runIds)
      .order('created_at', { ascending: true })
    if (eventsError) {
      console.error('[flows-runs] events fetch failed:', eventsError.message)
    } else {
      events = (eventRows ?? []) as typeof events
    }
  }

  return NextResponse.json({ flow, runs: runs ?? [], events })
}
