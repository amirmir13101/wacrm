import { NextResponse } from 'next/server'

import { getWorkspaceTrialStatus } from '@/lib/billing/trial'
import {
  crawlWebsiteForKnowledge,
  normalizeWebsiteUrl,
  type WebsiteImportPage,
} from '@/lib/ai/website-import'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

const DEFAULT_IMPORT_LIMIT = 50
const TRIAL_IMPORT_LIMIT = 5

export async function GET() {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'view_ai_chatbot')) {
    return NextResponse.json({ error: 'Permission required' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin()
    .from('ai_website_import_jobs')
    .select('id, website_url, normalized_origin, status, page_limit, pages_found, pages_imported, pages_skipped, pages_failed, duplicate_pages, draft_title, draft_content, published_source_id, error_message, created_at, completed_at')
    .eq('workspace_id', workspace.workspaceId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data ?? [] })
}

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }

  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot import AI Chatbot knowledge' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const requestedUrl = typeof body.url === 'string' ? body.url : ''
  let normalizedUrl: string
  try {
    normalizedUrl = normalizeWebsiteUrl(requestedUrl)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Enter a valid website URL.' },
      { status: 400 },
    )
  }

  const plan = await getWorkspaceTrialStatus(workspace.workspaceId)
  const requestedLimit = typeof body.page_limit === 'number' ? body.page_limit : DEFAULT_IMPORT_LIMIT
  const pageLimit = resolveAllowedPageLimit({
    requestedLimit,
    isActivePro: plan.isActivePro,
    isTrial: plan.isTrial,
  })
  if (!pageLimit.allowed) {
    return NextResponse.json({ error: pageLimit.reason }, { status: 402 })
  }

  const parsed = new URL(normalizedUrl)
  const admin = supabaseAdmin()
  const { data: job, error: jobError } = await admin
    .from('ai_website_import_jobs')
    .insert({
      workspace_id: workspace.workspaceId,
      created_by_user_id: workspace.userId,
      website_url: normalizedUrl,
      normalized_origin: parsed.origin,
      status: 'running',
      page_limit: pageLimit.limit,
    })
    .select('id')
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? 'Failed to create import job.' }, { status: 500 })
  }

  try {
    const result = await crawlWebsiteForKnowledge({
      startUrl: normalizedUrl,
      pageLimit: pageLimit.limit,
    })

    const pageRows = result.pages.map((page) => toPageRow(page, workspace.workspaceId, job.id))
    if (pageRows.length > 0) {
      const { error: pagesError } = await admin.from('ai_website_import_pages').insert(pageRows)
      if (pagesError) throw new Error(pagesError.message)
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
        error_message: result.pagesImported > 0 ? null : 'No useful website text could be imported.',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('workspace_id', workspace.workspaceId)
      .select('id, website_url, normalized_origin, status, page_limit, pages_found, pages_imported, pages_skipped, pages_failed, duplicate_pages, draft_title, draft_content, error_message, created_at, completed_at')
      .single()

    if (updateError || !updatedJob) throw new Error(updateError?.message ?? 'Failed to update import job.')

    return NextResponse.json({
      job: updatedJob,
      pages: result.pages.map((page) => ({
        url: page.url,
        canonical_url: page.canonicalUrl,
        title: page.title,
        status: page.status,
        skip_reason: page.skipReason,
        http_status: page.httpStatus,
      })),
      limits: {
        appliedPageLimit: pageLimit.limit,
        trialPreview: plan.isTrial && !plan.isActivePro,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Website import failed.'
    await admin
      .from('ai_website_import_jobs')
      .update({
        status: 'failed',
        error_message: message.slice(0, 500),
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('workspace_id', workspace.workspaceId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function resolveAllowedPageLimit(args: {
  requestedLimit: number
  isActivePro: boolean
  isTrial: boolean
}): { allowed: true; limit: number } | { allowed: false; reason: string } {
  if (args.isActivePro) {
    return { allowed: true, limit: clamp(args.requestedLimit, 1, Number(process.env.AI_WEBSITE_IMPORT_PAGE_LIMIT ?? DEFAULT_IMPORT_LIMIT)) }
  }
  if (args.isTrial) {
    return { allowed: true, limit: clamp(args.requestedLimit, 1, TRIAL_IMPORT_LIMIT) }
  }
  return {
    allowed: false,
    reason: 'Website knowledge import requires an active Pro monthly or yearly plan. Trial workspaces can run a small preview import.',
  }
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value || min)))
}
