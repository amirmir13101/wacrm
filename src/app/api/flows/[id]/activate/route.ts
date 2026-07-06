import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { validateFlowForActivation } from '@/lib/flows/validate'
import { requireWorkspacePermission } from '@/lib/team/server'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const guard = await requireWorkspacePermission('activate_deactivate_flows')
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = (await request.json().catch(() => null)) as
    | { status?: 'draft' | 'active' | 'archived' }
    | null
  const status = body?.status
  if (!status || !['draft', 'active', 'archived'].includes(status)) {
    return NextResponse.json(
      { error: "status must be one of 'draft' | 'active' | 'archived'" },
      { status: 400 },
    )
  }

  const admin = supabaseAdmin()
  const { data: existing, error: existingError } = await admin
    .from('flows')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', guard.workspace.workspaceId)
    .maybeSingle()

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (status === 'active') {
    const [{ data: flow }, { data: nodes }] = await Promise.all([
      admin
        .from('flows')
        .select('name, trigger_type, trigger_config, entry_node_id')
        .eq('id', id)
        .eq('workspace_id', guard.workspace.workspaceId)
        .maybeSingle(),
      admin.from('flow_nodes').select('node_key, node_type, config').eq('flow_id', id),
    ])

    if (!flow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const issues = validateFlowForActivation(
      flow as {
        name: string
        trigger_type: 'keyword' | 'first_inbound_message' | 'manual'
        trigger_config: Record<string, unknown>
        entry_node_id: string | null
      },
      (nodes ?? []) as Array<{
        node_key: string
        node_type: string
        config: Record<string, unknown>
      }>,
    )
    const blockers = issues.filter((issue) => issue.severity === 'error')
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot activate flow — fix the issues below first.',
          issues,
        },
        { status: 422 },
      )
    }
  }

  const { data: updated, error } = await admin
    .from('flows')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', guard.workspace.workspaceId)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flow: updated })
}
