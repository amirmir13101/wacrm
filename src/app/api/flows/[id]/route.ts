import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireWorkspacePermission } from '@/lib/team/server'

async function requireFlow(
  flowId: string,
  permission: 'view_flows' | 'edit_flows',
): Promise<
  | { ok: true; workspaceId: string; userId: string }
  | { ok: false; status: number; error: string }
> {
  const guard = await requireWorkspacePermission(permission)
  if (!guard.ok) return guard

  const { data: flow, error } = await supabaseAdmin()
    .from('flows')
    .select('id')
    .eq('id', flowId)
    .eq('workspace_id', guard.workspace.workspaceId)
    .maybeSingle()

  if (error) return { ok: false, status: 500, error: error.message }
  if (!flow) return { ok: false, status: 404, error: 'Not found' }

  return {
    ok: true,
    workspaceId: guard.workspace.workspaceId,
    userId: guard.workspace.userId,
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const guard = await requireFlow(id, 'view_flows')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = supabaseAdmin()
  const [{ data: flow }, { data: nodes }] = await Promise.all([
    admin
      .from('flows')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', guard.workspaceId)
      .maybeSingle(),
    admin
      .from('flow_nodes')
      .select('*')
      .eq('flow_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!flow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ flow, nodes: nodes ?? [] })
}

interface PutBody {
  name?: string
  description?: string | null
  trigger_type?: 'keyword' | 'first_inbound_message' | 'manual'
  trigger_config?: Record<string, unknown>
  entry_node_id?: string | null
  fallback_policy?: Record<string, unknown>
  nodes?: Array<{
    node_key: string
    node_type: string
    config: Record<string, unknown>
    position_x?: number
    position_y?: number
  }>
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const guard = await requireFlow(id, 'edit_flows')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = (await request.json().catch(() => null)) as PutBody | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const flowPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) flowPatch.name = body.name.trim()
  if (body.description !== undefined) flowPatch.description = body.description
  if (body.trigger_type !== undefined) flowPatch.trigger_type = body.trigger_type
  if (body.trigger_config !== undefined) flowPatch.trigger_config = body.trigger_config
  if (body.entry_node_id !== undefined) flowPatch.entry_node_id = body.entry_node_id
  if (body.fallback_policy !== undefined) flowPatch.fallback_policy = body.fallback_policy

  const { error: updateError } = await admin
    .from('flows')
    .update(flowPatch)
    .eq('id', id)
    .eq('workspace_id', guard.workspaceId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if (body.nodes !== undefined) {
    const { error: deleteError } = await admin.from('flow_nodes').delete().eq('flow_id', id)
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    if (body.nodes.length > 0) {
      const { error: insertError } = await admin.from('flow_nodes').insert(
        body.nodes.map((node) => ({
          flow_id: id,
          node_key: node.node_key,
          node_type: node.node_type,
          config: node.config,
          position_x: node.position_x ?? 0,
          position_y: node.position_y ?? 0,
        })),
      )
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }
  }

  const [{ data: flow }, { data: nodes }] = await Promise.all([
    admin.from('flows').select('*').eq('id', id).eq('workspace_id', guard.workspaceId).maybeSingle(),
    admin.from('flow_nodes').select('*').eq('flow_id', id).order('created_at', { ascending: true }),
  ])

  return NextResponse.json({ flow, nodes: nodes ?? [] })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const guard = await requireFlow(id, 'edit_flows')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { error } = await supabaseAdmin()
    .from('flows')
    .delete()
    .eq('id', id)
    .eq('workspace_id', guard.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
