import { NextResponse } from 'next/server'

import { getFirecrawlCrawlStatus, resolveFirecrawlApiKey } from '@/lib/ai/firecrawl'
import { saveKnowledgeSourceWithChunks } from '@/lib/ai/knowledge'
import {
  MAX_WEBSITE_DRAFT_CONTENT_LENGTH,
  buildWebsiteImportFromFirecrawl,
  type WebsiteImportPage,
} from '@/lib/ai/website-import'
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
  const jobResult = await admin
    .from('ai_website_import_jobs')
    .select('id, website_url, normalized_origin, status, page_limit, pages_found, pages_imported, pages_skipped, pages_failed, duplicate_pages, draft_title, draft_content, published_source_id, error_message, crawl_provider, external_crawl_id, credits_used, provider_status, created_at, completed_at')
    .eq('id', id)
    .eq('workspace_id', workspace.workspaceId)
    .maybeSingle()
  let job = jobResult.data
  const jobError = jobResult.error

  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })
  if (!job) return NextResponse.json({ error: 'Import job not found.' }, { status: 404 })

  if (job.status === 'running' && job.crawl_provider === 'firecrawl' && job.external_crawl_id) {
    try {
      const apiKey = await resolveFirecrawlApiKey(workspace.workspaceId)
      if (!apiKey) throw new Error('Firecrawl API key is no longer configured.')
      const firecrawlStatus = await getFirecrawlCrawlStatus(apiKey, job.external_crawl_id)
      if (firecrawlStatus.status === 'completed') {
        const result = buildWebsiteImportFromFirecrawl({
          startUrl: job.website_url,
          pages: firecrawlStatus.data,
        })
        await admin
          .from('ai_website_import_pages')
          .delete()
          .eq('import_job_id', id)
          .eq('workspace_id', workspace.workspaceId)
        const pageRows = result.pages.map((page) => toPageRow(page, workspace.workspaceId, id))
        if (pageRows.length > 0) {
          const { error: pagesInsertError } = await admin.from('ai_website_import_pages').insert(pageRows)
          if (pagesInsertError) throw new Error(pagesInsertError.message)
        }
        const { data: updatedJob, error: updateError } = await admin
          .from('ai_website_import_jobs')
          .update({
            status: result.pagesImported > 0 ? 'draft_ready' : 'failed',
            pages_found: result.pagesFound,
            pages_imported: result.pagesImported,
            pages_skipped: result.pagesSkipped,
            pages_failed: result.pagesFailed,
            duplicate_pages: result.duplicatePages,
            draft_title: result.draftTitle,
            draft_content: result.draftContent,
            credits_used: firecrawlStatus.creditsUsed,
            provider_status: firecrawlStatus.status,
            error_message: result.pagesImported > 0 ? null : 'Firecrawl completed but no useful website text was found.',
            completed_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('workspace_id', workspace.workspaceId)
          .select('id, website_url, normalized_origin, status, page_limit, pages_found, pages_imported, pages_skipped, pages_failed, duplicate_pages, draft_title, draft_content, published_source_id, error_message, crawl_provider, external_crawl_id, credits_used, provider_status, created_at, completed_at')
          .single()
        if (updateError || !updatedJob) throw new Error(updateError?.message ?? 'Failed to finalize Firecrawl import.')
        job = updatedJob
      } else if (firecrawlStatus.status === 'failed' || firecrawlStatus.status === 'cancelled') {
        const { data: failedJob } = await admin
          .from('ai_website_import_jobs')
          .update({
            status: 'failed',
            credits_used: firecrawlStatus.creditsUsed,
            provider_status: firecrawlStatus.status,
            error_message: `Firecrawl crawl ${firecrawlStatus.status}.`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('workspace_id', workspace.workspaceId)
          .select('id, website_url, normalized_origin, status, page_limit, pages_found, pages_imported, pages_skipped, pages_failed, duplicate_pages, draft_title, draft_content, published_source_id, error_message, crawl_provider, external_crawl_id, credits_used, provider_status, created_at, completed_at')
          .single()
        if (failedJob) job = failedJob
      } else {
        const { data: runningJob } = await admin
          .from('ai_website_import_jobs')
          .update({
            pages_found: firecrawlStatus.total,
            pages_imported: firecrawlStatus.completed,
            credits_used: firecrawlStatus.creditsUsed,
            provider_status: firecrawlStatus.status,
          })
          .eq('id', id)
          .eq('workspace_id', workspace.workspaceId)
          .select('id, website_url, normalized_origin, status, page_limit, pages_found, pages_imported, pages_skipped, pages_failed, duplicate_pages, draft_title, draft_content, published_source_id, error_message, crawl_provider, external_crawl_id, credits_used, provider_status, created_at, completed_at')
          .single()
        if (runningJob) job = runningJob
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check Firecrawl import.'
      await admin
        .from('ai_website_import_jobs')
        .update({ provider_status: 'status_error', error_message: message.slice(0, 500) })
        .eq('id', id)
        .eq('workspace_id', workspace.workspaceId)
      return NextResponse.json({ error: message }, { status: 502 })
    }
  }

  const { data: pages, error: pagesError } = await admin
    .from('ai_website_import_pages')
    .select('id, url, canonical_url, title, status, skip_reason, http_status, created_at')
    .eq('import_job_id', id)
    .eq('workspace_id', workspace.workspaceId)
    .order('created_at', { ascending: true })

  if (pagesError) {
    return NextResponse.json({ error: pagesError.message }, { status: 500 })
  }

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

function toPageRow(page: WebsiteImportPage, workspaceId: string, importJobId: string) {
  return {
    workspace_id: workspaceId,
    import_job_id: importJobId,
    url: page.url,
    canonical_url: page.canonicalUrl,
    title: page.title,
    meta_description: page.metaDescription,
    raw_text: page.rawText,
    cleaned_text: page.cleanedText,
    content_hash: page.contentHash,
    status: page.status,
    skip_reason: page.skipReason,
    http_status: page.httpStatus,
  }
}
