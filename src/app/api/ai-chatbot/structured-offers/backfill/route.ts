import { NextResponse } from 'next/server'

import { backfillStructuredPricingOffers, countStructuredOfferPopulation } from '@/lib/ai/knowledge'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'view_ai_chatbot')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }

  const counts = await countStructuredOfferPopulation({
    workspaceId: workspace.workspaceId,
    client: supabaseAdmin(),
  })
  return NextResponse.json({ counts })
}

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const batchSize = typeof body.batch_size === 'number' ? body.batch_size : undefined
  const result = await backfillStructuredPricingOffers({
    workspaceId: workspace.workspaceId,
    batchSize,
    client: supabaseAdmin(),
  })

  return NextResponse.json(result)
}
