import { NextResponse } from 'next/server'

import { saveKnowledgeSourceWithChunks } from '@/lib/ai/knowledge'
import { MAX_WEBSITE_DRAFT_CONTENT_LENGTH } from '@/lib/ai/website-import'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'view_ai_chatbot')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }

  const { id } = await context.params
  const admin = supabaseAdmin()
  const [{ data: job, error: jobError }, { data: pages, error: pagesError }] = await Promise.all([
    admin
      .from('ai_website_import_jobs')
      .select('id, website_url, normalized_origin, status, page_limit, pages_found, pages_imported, pages_skipped, pages_failed, duplicate_pages, draft_title, draft_content, published_source_id, error_message, created_at, completed_at')
      .eq('id', id)
      .eq('workspace_id', workspace.workspaceId)
      .maybeSingle(),
    admin
      .from('ai_website_import_pages')
      .select('id, url, canonical_url, title, status, skip_reason, http_status, created_at')
      .eq('import_job_id', id)
      .eq('workspace_id', workspace.workspaceId)
      .order('created_at', { ascending: true }),
  ])

  if (jobError || pagesError) {
    return NextResponse.json({ error: jobError?.message ?? pagesError?.message }, { status: 500 })
  }
  if (!job) return NextResponse.json({ error: 'Import job not found.' }, { status: 404 })

  return NextResponse.json({ job, pages: pages ?? [] })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage AI Chatbot imports' }, { status: 403 })
  }

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = typeof body.action === 'string' ? body.action : ''

  const admin = supabaseAdmin()
  const { data: job, error: jobError } = await admin
    .from('ai_website_import_jobs')
    .select('id, workspace_id, status, draft_title, draft_content')
    .eq('id', id)
    .eq('workspace_id', workspace.workspaceId)
    .maybeSingle()

  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })
  if (!job) return NextResponse.json({ error: 'Import job not found.' }, { status: 404 })

  if (action === 'discard') {
    const { data, error } = await admin
      .from('ai_website_import_jobs')
      .update({ status: 'discarded', completed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspace.workspaceId)
      .select('id, status')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ job: data })
  }

  if (action !== 'publish') {
    return NextResponse.json({ error: 'Unsupported import action.' }, { status: 400 })
  }

  if (job.status !== 'draft_ready') {
    return NextResponse.json({ error: 'Only draft-ready imports can be published.' }, { status: 400 })
  }

  const title = readLimitedText(body.title, job.draft_title ?? 'Website knowledge', 160)
  const content = readLimitedText(body.content, job.draft_content ?? '', MAX_WEBSITE_DRAFT_CONTENT_LENGTH)
  if (!title || !content) {
    return NextResponse.json({ error: 'Draft title and content are required.' }, { status: 400 })
  }

  try {
    const source = await saveKnowledgeSourceWithChunks({
      workspaceId: workspace.workspaceId,
      sourceType: 'website',
      title,
      content,
    })

    const { data: updatedJob, error: updateError } = await admin
      .from('ai_website_import_jobs')
      .update({
        status: 'completed',
        draft_title: title,
        draft_content: content,
        published_source_id: source.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', workspace.workspaceId)
      .select('id, status, published_source_id')
      .single()

    if (updateError) throw new Error(updateError.message)
    return NextResponse.json({ source, job: updatedJob })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish website knowledge.' },
      { status: 500 },
    )
  }
}

function readLimitedText(value: unknown, fallback: string, maxLength: number): string {
  const raw = typeof value === 'string' ? value : fallback
  const trimmed = raw.trim()
  return trimmed.slice(0, maxLength)
}
