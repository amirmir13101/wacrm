import { NextResponse } from 'next/server'

import { calculateNextRunAt, clampPageLimit, parseScheduleFrequency } from '@/lib/ai/scrape-schedules'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage scrape schedules' }, { status: 403 })
  }
  const { id } = await context.params
  const admin = supabaseAdmin()
  const { data: existing, error: lookupError } = await admin
    .from('ai_scrape_schedules')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspace.workspaceId)
    .maybeSingle()
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Schedule not found.' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const frequency = body.frequency === undefined ? existing.frequency : parseScheduleFrequency(body.frequency)
  if (!frequency) return NextResponse.json({ error: 'Invalid schedule frequency.' }, { status: 400 })
  const hourUtc = body.hour_utc === undefined ? existing.hour_utc : clamp(body.hour_utc, 0, 23, existing.hour_utc)
  const dayOfWeek = frequency === 'weekly'
    ? (body.day_of_week === undefined ? existing.day_of_week ?? 0 : clamp(body.day_of_week, 0, 6, 0))
    : null
  const isActive = body.is_active === undefined ? existing.is_active : Boolean(body.is_active)
  const { data, error } = await admin
    .from('ai_scrape_schedules')
    .update({
      frequency,
      hour_utc: hourUtc,
      day_of_week: dayOfWeek,
      auto_publish: body.auto_publish === undefined ? existing.auto_publish : Boolean(body.auto_publish),
      page_limit: body.page_limit === undefined ? existing.page_limit : clampPageLimit(body.page_limit),
      is_active: isActive,
      next_run_at: isActive ? calculateNextRunAt({ frequency, dayOfWeek, hourUtc }) : null,
    })
    .eq('id', id)
    .eq('workspace_id', workspace.workspaceId)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ schedule: data })
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage scrape schedules' }, { status: 403 })
  }
  const { id } = await context.params
  const { error } = await supabaseAdmin()
    .from('ai_scrape_schedules')
    .update({ is_active: false, next_run_at: null })
    .eq('id', id)
    .eq('workspace_id', workspace.workspaceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' ? Math.max(min, Math.min(max, Math.floor(value))) : fallback
}
