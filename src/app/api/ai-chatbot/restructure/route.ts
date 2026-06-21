import { NextResponse } from 'next/server'

import { resolveAiStructuringSettings } from '@/lib/ai/provider'
import { enhanceWebsiteImportWithAiStructuring } from '@/lib/ai/structuring'
import { hashContent, type WebsiteImportPage, type WebsiteImportResult } from '@/lib/ai/website-import'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { hasWorkspacePermission } from '@/lib/team/permissions'
import { requireCurrentWorkspace } from '@/lib/team/server'

export async function POST(request: Request) {
  const workspaceResult = await requireCurrentWorkspace()
  if (!workspaceResult.ok) {
    return NextResponse.json({ error: workspaceResult.error }, { status: workspaceResult.status })
  }
  const workspace = workspaceResult.workspace
  if (!hasWorkspacePermission(workspace, 'manage_ai_chatbot')) {
    return NextResponse.json({ error: 'You cannot manage AI Chatbot knowledge' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const sourceId = typeof body.source_id === 'string' ? body.source_id.trim() : ''
  if (!sourceId) return NextResponse.json({ error: 'source_id is required.' }, { status: 400 })

  const admin = supabaseAdmin()
  const { data: source, error: sourceError } = await admin
    .from('ai_knowledge_sources')
    .select('id, title, content, source_type, status')
    .eq('workspace_id', workspace.workspaceId)
    .eq('id', sourceId)
    .maybeSingle()
  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 })
  if (!source || source.source_type !== 'website') {
    return NextResponse.json({ error: 'Website knowledge source not found.' }, { status: 404 })
  }

  const pages = pagesFromPublishedWebsiteSource(String(source.content ?? ''), String(source.title ?? 'Website knowledge'))
  if (pages.length === 0) return NextResponse.json({ error: 'No website pages were found in this source.' }, { status: 400 })

  const origin = inferOrigin(pages[0]?.canonicalUrl ?? pages[0]?.url ?? '')
  const baseResult: WebsiteImportResult = {
    startUrl: pages[0]?.canonicalUrl ?? pages[0]?.url ?? 'about:blank',
    normalizedOrigin: origin,
    pages,
    draftTitle: `${source.title} restructured draft`,
    draftContent: String(source.content ?? ''),
    qualityWarnings: ['Existing knowledge was copied into a new review draft. Published knowledge is unchanged until you publish this draft.'],
    pagesFound: pages.length,
    pagesImported: pages.length,
    pagesSkipped: 0,
    pagesFailed: 0,
    duplicatePages: 0,
  }
  const structuringSettings = await resolveAiStructuringSettings(workspace.workspaceId)
  const result = await enhanceWebsiteImportWithAiStructuring({
    workspaceId: workspace.workspaceId,
    result: baseResult,
    settings: structuringSettings,
  })

  const { data: job, error: jobError } = await admin
    .from('ai_website_import_jobs')
    .insert({
      workspace_id: workspace.workspaceId,
      created_by_user_id: workspace.userId,
      website_url: result.startUrl,
      normalized_origin: result.normalizedOrigin,
      status: 'draft_ready',
      page_limit: pages.length,
      pages_found: result.pagesFound,
      pages_imported: result.pagesImported,
      pages_skipped: result.pagesSkipped,
      pages_failed: result.pagesFailed,
      duplicate_pages: result.duplicatePages,
      draft_title: result.draftTitle,
      draft_content: result.draftContent,
      crawl_provider: 'firecrawl',
      provider_status: 'restructure_existing',
      import_kind: 'restructure_existing',
      restructure_source_id: sourceId,
      ai_structuring_enabled: result.aiStructuring?.enabled ?? false,
      ai_structuring_status: result.aiStructuring?.status ?? (structuringSettings.enabled ? 'failed' : 'disabled'),
      ai_structuring_call_cap: result.aiStructuring?.callCap ?? structuringSettings.callCap,
      ai_structuring_pages_attempted: result.aiStructuring?.pagesAttempted ?? 0,
      ai_structuring_pages_succeeded: result.aiStructuring?.pagesSucceeded ?? 0,
      ai_structuring_pages_failed: result.aiStructuring?.pagesFailed ?? 0,
      ai_structuring_fields_kept: result.aiStructuring?.fieldsKept ?? 0,
      ai_structuring_fields_dropped: result.aiStructuring?.fieldsDropped ?? 0,
      ai_structuring_summary: result.aiStructuring ?? {},
      completed_at: new Date().toISOString(),
    })
    .select('id, website_url, normalized_origin, status, page_limit, pages_found, pages_imported, pages_skipped, pages_failed, duplicate_pages, draft_title, draft_content, published_source_id, error_message, crawl_provider, external_crawl_id, credits_used, provider_status, import_kind, restructure_source_id, ai_structuring_enabled, ai_structuring_status, ai_structuring_call_cap, ai_structuring_pages_attempted, ai_structuring_pages_succeeded, ai_structuring_pages_failed, ai_structuring_fields_kept, ai_structuring_fields_dropped, ai_structuring_summary, created_at, completed_at')
    .single()
  if (jobError || !job) return NextResponse.json({ error: jobError?.message ?? 'Failed to create re-structure draft.' }, { status: 500 })

  const pageRows = result.pages.map((page) => ({
    workspace_id: workspace.workspaceId,
    import_job_id: job.id,
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
    structured_facts: page.structuredFacts ?? null,
    structuring_source: page.structuringSource ?? 'deterministic',
    structuring_grounding: page.structuringGrounding ?? {},
  }))
  const { error: pagesError } = await admin.from('ai_website_import_pages').insert(pageRows)
  if (pagesError) return NextResponse.json({ error: pagesError.message }, { status: 500 })

  return NextResponse.json({ job, pages: pageRows, qualityWarnings: result.qualityWarnings })
}

function pagesFromPublishedWebsiteSource(content: string, title: string): WebsiteImportPage[] {
  const parts = content.split(/\n(?=### Page:\s+)/g).filter((part) => part.trim())
  return parts.map((part, index) => {
    const url = part.match(/\bURL:\s*(https?:\/\/[^\s]+)/i)?.[1] ?? `published-source://page-${index + 1}`
    const pageTitle = part.match(/^### Page:\s*(.+)$/m)?.[1]?.trim() ?? `${title} page ${index + 1}`
    const cleanedText = part.trim()
    return {
      url,
      canonicalUrl: url.startsWith('http') ? url : null,
      title: pageTitle,
      metaDescription: null,
      rawText: cleanedText,
      cleanedText,
      contentHash: hashContent(cleanedText),
      status: 'imported',
      skipReason: null,
      httpStatus: 200,
    }
  })
}

function inferOrigin(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    return 'published-source://local'
  }
}
