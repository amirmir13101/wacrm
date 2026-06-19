import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function GET(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'view_ai_chatbot')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }
  const url = new URL(request.url)
  const limit = clamp(url.searchParams.get('limit'), 20, 1, 100)
  const offset = clamp(url.searchParams.get('offset'), 0, 0, 100_000)
  let query = supabaseAdmin()
    .from('ai_import_history')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspace.workspaceId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  const sourceId = url.searchParams.get('source_id')
  const scheduleId = url.searchParams.get('schedule_id')
  if (sourceId) query = query.eq('source_id', sourceId)
  if (scheduleId) query = query.eq('schedule_id', scheduleId)
  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = data ?? []
  const crawlIds = rows.map((row) => row.firecrawl_job_id).filter((value): value is string => Boolean(value))
  const importJobs = crawlIds.length > 0
    ? await supabaseAdmin()
      .from('ai_website_import_jobs')
      .select('id, external_crawl_id')
      .eq('workspace_id', workspace.workspaceId)
      .in('external_crawl_id', crawlIds)
    : { data: [], error: null }
  const jobByCrawlId = new Map((importJobs.data ?? []).map((job) => [job.external_crawl_id, job.id]))
  return NextResponse.json({
    history: rows.map((row) => ({ ...row, import_job_id: jobByCrawlId.get(row.firecrawl_job_id) ?? null })),
    total: count ?? 0,
    limit,
    offset,
  })
}

function clamp(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback
}
