import { NextResponse } from 'next/server'

import { calculateNextRunAt, clampPageLimit, parseScheduleFrequency } from '@/lib/ai/scrape-schedules'
import { findWebsiteKnowledgeSourceForUrl } from '@/lib/ai/knowledge'
import { normalizeWebsiteUrl } from '@/lib/ai/website-import'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'view_ai_chatbot')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }
  const { data, error } = await supabaseAdmin()
    .from('ai_scrape_schedules')
    .select('*')
    .eq('workspace_id', workspace.workspaceId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ schedules: data ?? [] })
}

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage scrape schedules' }, { status: 403 })
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const frequency = parseScheduleFrequency(body.frequency)
  if (!frequency) return NextResponse.json({ error: 'Invalid schedule frequency.' }, { status: 400 })
  let url: string
  try {
    url = normalizeWebsiteUrl(typeof body.url === 'string' ? body.url : '')
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid website URL.' }, { status: 400 })
  }
  const hourUtc = readInteger(body.hour_utc, 3, 0, 23)
  const dayOfWeek = frequency === 'weekly' ? readInteger(body.day_of_week, 0, 0, 6) : null
  const admin = supabaseAdmin()
  let sourceId = typeof body.source_id === 'string' && body.source_id ? body.source_id : null
  if (sourceId) {
    const { data: source } = await admin
      .from('ai_knowledge_sources')
      .select('id')
      .eq('id', sourceId)
      .eq('workspace_id', workspace.workspaceId)
      .maybeSingle()
    if (!source) return NextResponse.json({ error: 'Knowledge source not found in this workspace.' }, { status: 400 })
  } else {
    sourceId = await findWebsiteKnowledgeSourceForUrl({
      workspaceId: workspace.workspaceId,
      url,
      client: admin,
    })
  }
  const { data: duplicate } = await admin
    .from('ai_scrape_schedules')
    .select('id')
    .eq('workspace_id', workspace.workspaceId)
    .eq('url', url)
    .eq('is_active', true)
    .maybeSingle()
  if (duplicate) return NextResponse.json({ error: 'An active schedule already exists for this URL.' }, { status: 409 })

  const { data, error } = await admin
    .from('ai_scrape_schedules')
    .insert({
      workspace_id: workspace.workspaceId,
      source_id: sourceId,
      url,
      frequency,
      day_of_week: dayOfWeek,
      hour_utc: hourUtc,
      auto_publish: Boolean(body.auto_publish),
      page_limit: clampPageLimit(body.page_limit),
      next_run_at: calculateNextRunAt({ frequency, dayOfWeek, hourUtc }),
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ schedule: data }, { status: 201 })
}

function readInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const number = typeof value === 'number' ? Math.floor(value) : fallback
  return Math.max(minimum, Math.min(maximum, number))
}
