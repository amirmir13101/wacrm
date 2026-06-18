import { NextResponse } from 'next/server'

import { getWorkspaceTrialStatus } from '@/lib/billing/trial'
import { resolveFirecrawlApiKey, startFirecrawlWebsiteCrawl } from '@/lib/ai/firecrawl'
import {
  normalizeWebsiteUrl,
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
    .select('id, website_url, normalized_origin, status, page_limit, pages_found, pages_imported, pages_skipped, pages_failed, duplicate_pages, draft_title, draft_content, published_source_id, error_message, crawl_provider, external_crawl_id, credits_used, provider_status, created_at, completed_at')
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

  const apiKey = await resolveFirecrawlApiKey(workspace.workspaceId)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Add and test your Firecrawl API key before importing a website.' },
      { status: 503 },
    )
  }

  let crawlId: string
  try {
    const crawl = await startFirecrawlWebsiteCrawl({
      apiKey,
      url: normalizedUrl,
      pageLimit: pageLimit.limit,
    })
    crawlId = crawl.id
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start Firecrawl website import.' },
      { status: 502 },
    )
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
      crawl_provider: 'firecrawl',
      external_crawl_id: crawlId,
      provider_status: 'scraping',
    })
    .select('id, website_url, normalized_origin, status, page_limit, pages_found, pages_imported, pages_skipped, pages_failed, duplicate_pages, draft_title, draft_content, error_message, crawl_provider, external_crawl_id, credits_used, provider_status, created_at, completed_at')
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? 'Failed to create import job.' }, { status: 500 })
  }

  return NextResponse.json({
    job,
    pages: [],
    qualityWarnings: [],
    limits: {
      appliedPageLimit: pageLimit.limit,
      trialPreview: plan.isTrial && !plan.isActivePro,
    },
  })
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value || min)))
}
