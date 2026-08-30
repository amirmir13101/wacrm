import { supabaseAdmin } from '@/lib/automations/admin-client'
import { createRagWebsiteKnowledge } from './knowledge-store'
import type { RagWebsiteImportDraft, RagWebsiteImportPage, RagWebsiteImportStats } from './website-import'

export interface RagWebsiteImportJobView {
  readonly id: string
  readonly websiteUrl: string
  readonly normalizedOrigin: string | null
  readonly status: 'running' | 'draft_ready' | 'published' | 'failed' | 'discarded'
  readonly pageLimit: number
  readonly pagesFound: number
  readonly pagesImported: number
  readonly pagesSkipped: number
  readonly pagesFailed: number
  readonly duplicatePages: number
  readonly rawCharacters: number
  readonly savedCharacters: number
  readonly capped: boolean
  readonly crawlProvider: string
  readonly creditsUsed: number | null
  readonly providerStatus: string | null
  readonly draftTitle: string | null
  readonly draftContent: string | null
  readonly publishedSourceId: string | null
  readonly qualityWarnings: ReadonlyArray<string>
  readonly stats: RagWebsiteImportStats | null
  readonly errorMessage: string | null
  readonly createdAt: string
  readonly completedAt: string | null
}

interface RagWebsiteImportJobRow {
  readonly id: string
  readonly website_url: string
  readonly normalized_origin: string | null
  readonly status: string
  readonly page_limit: number
  readonly pages_found: number
  readonly pages_imported: number
  readonly pages_skipped: number
  readonly pages_failed: number
  readonly duplicate_pages: number
  readonly raw_characters: number
  readonly saved_characters: number
  readonly capped: boolean
  readonly crawl_provider: string
  readonly credits_used: number | null
  readonly provider_status: string | null
  readonly draft_title: string | null
  readonly draft_content: string | null
  readonly published_source_id: string | null
  readonly quality_warnings: unknown
  readonly stats: unknown
  readonly error_message: string | null
  readonly created_at: string
  readonly completed_at: string | null
}

export interface RagWebsiteImportPageView {
  readonly id: string
  readonly url: string
  readonly canonicalUrl: string | null
  readonly title: string | null
  readonly status: string
  readonly skipReason: string | null
  readonly contentHash: string | null
  readonly characterCount: number
}

interface RagWebsiteImportPageRow {
  readonly id: string
  readonly url: string
  readonly canonical_url: string | null
  readonly title: string | null
  readonly status: string
  readonly skip_reason: string | null
  readonly content_hash: string | null
  readonly character_count: number
}

export interface RagImportHistoryItem {
  readonly id: string
  readonly url: string | null
  readonly triggerType: string
  readonly status: string
  readonly pagesFound: number
  readonly pagesImported: number
  readonly pagesSkipped: number
  readonly pagesFailed: number
  readonly duplicatePages: number
  readonly creditsUsed: number | null
  readonly changeSummary: string | null
  readonly errorMessage: string | null
  readonly createdAt: string
}

interface RagImportHistoryRow {
  readonly id: string
  readonly url: string | null
  readonly trigger_type: string
  readonly status: string
  readonly pages_found: number
  readonly pages_imported: number
  readonly pages_skipped: number
  readonly pages_failed: number
  readonly duplicate_pages: number
  readonly credits_used: number | null
  readonly rag_website_import_jobs?: {
    readonly credits_used?: number | null
    readonly stats?: unknown
  } | null
  readonly change_summary: string | null
  readonly error_message: string | null
  readonly created_at: string
}

export interface RagScrapeScheduleView {
  readonly id: string
  readonly url: string
  readonly frequency: 'daily' | 'weekly' | 'monthly'
  readonly pageLimit: number
  readonly dayOfWeek: number | null
  readonly hourUtc: number | null
  readonly autoPublish: boolean
  readonly isActive: boolean
  readonly nextRunAt: string | null
  readonly lastRunAt: string | null
  readonly lastRunStatus: string | null
  readonly createdAt: string
}

interface RagScrapeScheduleRow {
  readonly id: string
  readonly url: string
  readonly frequency: string
  readonly page_limit: number
  readonly day_of_week: number | null
  readonly hour_utc: number | null
  readonly auto_publish: boolean
  readonly is_active: boolean
  readonly next_run_at: string | null
  readonly last_run_at: string | null
  readonly last_run_status: string | null
  readonly created_at: string
}

export interface RagKnowledgeGapView {
  readonly id: string
  readonly question: string
  readonly channel: string
  readonly reason: string
  readonly count: number
  readonly suggestedAction: string | null
  readonly languageName: string | null
  readonly lastAskedAt: string
  readonly resolvedAt: string | null
}

interface RagKnowledgeGapRow {
  readonly id: string
  readonly question: string
  readonly channel: string
  readonly reason: string
  readonly count: number
  readonly suggested_action: string | null
  readonly language_name: string | null
  readonly last_asked_at: string
  readonly resolved_at: string | null
}

function toStringArray(value: unknown): ReadonlyArray<string> {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function normalizeJobStatus(value: string): RagWebsiteImportJobView['status'] {
  if (value === 'running' || value === 'draft_ready' || value === 'published' || value === 'failed' || value === 'discarded') return value
  return 'failed'
}

function toImportJob(row: RagWebsiteImportJobRow): RagWebsiteImportJobView {
  return {
    id: row.id,
    websiteUrl: row.website_url,
    normalizedOrigin: row.normalized_origin,
    status: normalizeJobStatus(row.status),
    pageLimit: row.page_limit,
    pagesFound: row.pages_found,
    pagesImported: row.pages_imported,
    pagesSkipped: row.pages_skipped,
    pagesFailed: row.pages_failed,
    duplicatePages: row.duplicate_pages,
    rawCharacters: row.raw_characters,
    savedCharacters: row.saved_characters,
    capped: row.capped,
    crawlProvider: row.crawl_provider,
    creditsUsed: row.credits_used,
    providerStatus: row.provider_status,
    draftTitle: row.draft_title,
    draftContent: row.draft_content,
    publishedSourceId: row.published_source_id,
    qualityWarnings: toStringArray(row.quality_warnings),
    stats: typeof row.stats === 'object' && row.stats ? row.stats as RagWebsiteImportStats : null,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }
}

function toImportPage(row: RagWebsiteImportPageRow): RagWebsiteImportPageView {
  return {
    id: row.id,
    url: row.url,
    canonicalUrl: row.canonical_url,
    title: row.title,
    status: row.status,
    skipReason: row.skip_reason,
    contentHash: row.content_hash,
    characterCount: row.character_count,
  }
}

function toHistoryItem(row: RagImportHistoryRow): RagImportHistoryItem {
  return {
    id: row.id,
    url: row.url,
    triggerType: row.trigger_type,
    status: row.status,
    pagesFound: row.pages_found,
    pagesImported: row.pages_imported,
    pagesSkipped: row.pages_skipped,
    pagesFailed: row.pages_failed,
    duplicatePages: row.duplicate_pages,
    creditsUsed: readHistoryCreditsUsed(row),
    changeSummary: row.change_summary,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }
}

function readNumberField(source: unknown, names: ReadonlyArray<string>): number | null {
  if (typeof source !== 'object' || source === null) return null
  const record = source as Record<string, unknown>
  for (const name of names) {
    const value = record[name]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return null
}

function readHistoryCreditsUsed(row: RagImportHistoryRow): number | null {
  if (typeof row.credits_used === 'number') return row.credits_used
  const linkedJob = row.rag_website_import_jobs
  if (typeof linkedJob?.credits_used === 'number') return linkedJob.credits_used
  return readNumberField(linkedJob?.stats, [
    'creditsUsed',
    'credits_used',
    'firecrawlCreditsUsed',
    'firecrawl_credits_used',
    'usedCredits',
    'used_credits',
  ])
}

function toSchedule(row: RagScrapeScheduleRow): RagScrapeScheduleView {
  return {
    id: row.id,
    url: row.url,
    frequency: row.frequency === 'daily' || row.frequency === 'monthly' ? row.frequency : 'weekly',
    pageLimit: row.page_limit,
    dayOfWeek: row.day_of_week,
    hourUtc: row.hour_utc,
    autoPublish: row.auto_publish,
    isActive: row.is_active,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status,
    createdAt: row.created_at,
  }
}

function toGap(row: RagKnowledgeGapRow): RagKnowledgeGapView {
  return {
    id: row.id,
    question: row.question,
    channel: row.channel,
    reason: row.reason,
    count: row.count,
    suggestedAction: row.suggested_action,
    languageName: row.language_name,
    lastAskedAt: row.last_asked_at,
    resolvedAt: row.resolved_at,
  }
}

export async function createRagWebsiteImportJob(args: {
  readonly workspaceId: string
  readonly userId: string
  readonly draft: RagWebsiteImportDraft
}): Promise<{ readonly job: RagWebsiteImportJobView; readonly pages: ReadonlyArray<RagWebsiteImportPageView> }> {
  const admin = supabaseAdmin()
  const stats = args.draft.stats
  const { data: job, error: jobError } = await admin
    .from('rag_website_import_jobs')
    .insert({
      workspace_id: args.workspaceId,
      website_url: args.draft.sourceUrl,
      normalized_origin: stats.normalizedOrigin,
      status: 'draft_ready',
      page_limit: stats.pageLimit,
      pages_found: stats.pagesFound,
      pages_imported: stats.pagesImported,
      pages_skipped: stats.pagesSkipped,
      pages_failed: stats.pagesFailed,
      duplicate_pages: stats.duplicatePages,
      raw_characters: stats.rawCharacters,
      saved_characters: stats.savedCharacters,
      capped: stats.capped,
      crawl_provider: 'firecrawl',
      credits_used: stats.creditsUsed ?? null,
      draft_title: args.draft.title,
      draft_content: args.draft.content,
      quality_warnings: stats.warnings,
      stats,
      created_by: args.userId,
      completed_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (jobError) throw new Error(jobError.message)

  const jobId = (job as RagWebsiteImportJobRow).id
  if (stats.pages.length > 0) {
    const { error: pagesError } = await admin
      .from('rag_website_import_pages')
      .insert(stats.pages.map((page: RagWebsiteImportPage) => ({
        workspace_id: args.workspaceId,
        import_job_id: jobId,
        url: page.url,
        canonical_url: page.canonicalUrl,
        title: page.title,
        status: page.status,
        skip_reason: page.skipReason,
        content_hash: page.contentHash,
        character_count: page.characterCount,
        metadata: {
          metaDescription: page.metaDescription,
        },
      })))

    if (pagesError) throw new Error(pagesError.message)
  }

  await admin.from('rag_import_history').insert({
    workspace_id: args.workspaceId,
    import_job_id: jobId,
    url: args.draft.sourceUrl,
    trigger_type: 'manual',
    status: 'draft_ready',
    pages_found: stats.pagesFound,
    pages_imported: stats.pagesImported,
    pages_skipped: stats.pagesSkipped,
    pages_failed: stats.pagesFailed,
    duplicate_pages: stats.duplicatePages,
    credits_used: stats.creditsUsed ?? null,
    change_summary: args.draft.message,
  })

  return getRagWebsiteImportJob({ workspaceId: args.workspaceId, jobId })
}

export async function getRagWebsiteImportJob(args: {
  readonly workspaceId: string
  readonly jobId: string
}): Promise<{ readonly job: RagWebsiteImportJobView; readonly pages: ReadonlyArray<RagWebsiteImportPageView> }> {
  const admin = supabaseAdmin()
  const [jobResult, pagesResult] = await Promise.all([
    admin
      .from('rag_website_import_jobs')
      .select('*')
      .eq('workspace_id', args.workspaceId)
      .eq('id', args.jobId)
      .maybeSingle(),
    admin
      .from('rag_website_import_pages')
      .select('id, url, canonical_url, title, status, skip_reason, content_hash, character_count')
      .eq('workspace_id', args.workspaceId)
      .eq('import_job_id', args.jobId)
      .order('created_at', { ascending: true }),
  ])

  if (jobResult.error) throw new Error(jobResult.error.message)
  if (pagesResult.error) throw new Error(pagesResult.error.message)
  if (!jobResult.data) throw new Error('Website import draft not found.')

  return {
    job: toImportJob(jobResult.data as RagWebsiteImportJobRow),
    pages: ((pagesResult.data ?? []) as RagWebsiteImportPageRow[]).map(toImportPage),
  }
}

export async function getLatestPendingRagWebsiteImportJob(
  workspaceId: string,
): Promise<{
  readonly job: RagWebsiteImportJobView
  readonly pages: ReadonlyArray<RagWebsiteImportPageView>
} | null> {
  const { data, error } = await supabaseAdmin()
    .from('rag_website_import_jobs')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'draft_ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const jobId = typeof data?.id === 'string' ? data.id : null
  if (!jobId) return null
  return getRagWebsiteImportJob({ workspaceId, jobId })
}

export async function publishRagWebsiteImportJob(args: {
  readonly workspaceId: string
  readonly userId: string
  readonly jobId: string
  readonly title?: string
  readonly content?: string
}): Promise<{ readonly job: RagWebsiteImportJobView; readonly pages: ReadonlyArray<RagWebsiteImportPageView>; readonly sourceId: string }> {
  const current = await getRagWebsiteImportJob({
    workspaceId: args.workspaceId,
    jobId: args.jobId,
  })
  if (current.job.status !== 'draft_ready') throw new Error('Only draft website imports can be published.')
  const title = args.title?.trim() || current.job.draftTitle || 'Website knowledge'
  const content = args.content?.trim() || current.job.draftContent || ''
  if (!content) throw new Error('Draft content is empty.')

  const source = await createRagWebsiteKnowledge({
    workspaceId: args.workspaceId,
    userId: args.userId,
    title,
    content,
    sourceUrl: current.job.websiteUrl,
    finalUrl: current.job.websiteUrl,
  })

  const { error } = await supabaseAdmin()
    .from('rag_website_import_jobs')
    .update({
      status: 'published',
      draft_title: title,
      draft_content: content,
      published_source_id: source.id,
      completed_at: new Date().toISOString(),
    })
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.jobId)

  if (error) throw new Error(error.message)

  await supabaseAdmin()
    .from('rag_import_history')
    .update({
      status: 'published',
      source_id: source.id,
      change_summary: 'Website draft was published to the knowledge base.',
    })
    .eq('workspace_id', args.workspaceId)
    .eq('import_job_id', args.jobId)

  const updated = await getRagWebsiteImportJob({
    workspaceId: args.workspaceId,
    jobId: args.jobId,
  })
  return { ...updated, sourceId: source.id }
}

export async function discardRagWebsiteImportJob(args: {
  readonly workspaceId: string
  readonly jobId: string
}): Promise<{ readonly job: RagWebsiteImportJobView; readonly pages: ReadonlyArray<RagWebsiteImportPageView> }> {
  const { error } = await supabaseAdmin()
    .from('rag_website_import_jobs')
    .update({
      status: 'discarded',
      completed_at: new Date().toISOString(),
    })
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.jobId)
    .eq('status', 'draft_ready')

  if (error) throw new Error(error.message)

  await supabaseAdmin()
    .from('rag_import_history')
    .update({
      status: 'discarded',
      change_summary: 'Website draft was discarded before publishing.',
    })
    .eq('workspace_id', args.workspaceId)
    .eq('import_job_id', args.jobId)

  return getRagWebsiteImportJob(args)
}

export async function updateRagWebsiteImportDraft(args: {
  readonly workspaceId: string
  readonly jobId: string
  readonly title: string
  readonly content: string
}): Promise<{ readonly job: RagWebsiteImportJobView; readonly pages: ReadonlyArray<RagWebsiteImportPageView> }> {
  const { error } = await supabaseAdmin()
    .from('rag_website_import_jobs')
    .update({
      draft_title: args.title.trim() || 'Website knowledge',
      draft_content: args.content,
    })
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.jobId)
    .eq('status', 'draft_ready')

  if (error) throw new Error(error.message)
  return getRagWebsiteImportJob({ workspaceId: args.workspaceId, jobId: args.jobId })
}

export async function listRagImportHistory(workspaceId: string): Promise<ReadonlyArray<RagImportHistoryItem>> {
  const { data, error } = await supabaseAdmin()
    .from('rag_import_history')
    .select('id, url, trigger_type, status, pages_found, pages_imported, pages_skipped, pages_failed, duplicate_pages, credits_used, change_summary, error_message, created_at, rag_website_import_jobs(credits_used, stats)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) throw new Error(error.message)
  return ((data ?? []) as RagImportHistoryRow[]).map(toHistoryItem)
}

export async function listRagScrapeSchedules(workspaceId: string): Promise<ReadonlyArray<RagScrapeScheduleView>> {
  const { data, error } = await supabaseAdmin()
    .from('rag_scrape_schedules')
    .select('id, url, frequency, page_limit, day_of_week, hour_utc, auto_publish, is_active, next_run_at, last_run_at, last_run_status, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as RagScrapeScheduleRow[]).map(toSchedule)
}

export async function saveRagScrapeSchedule(args: {
  readonly workspaceId: string
  readonly userId: string
  readonly id?: string | null
  readonly url: string
  readonly frequency: 'daily' | 'weekly' | 'monthly'
  readonly pageLimit: number
  readonly dayOfWeek?: number | null
  readonly hourUtc?: number | null
  readonly autoPublish: boolean
  readonly isActive: boolean
}): Promise<RagScrapeScheduleView> {
  const payload = {
    workspace_id: args.workspaceId,
    url: args.url.trim(),
    frequency: args.frequency,
    page_limit: Math.max(5, Math.min(100, Math.floor(args.pageLimit || 25))),
    day_of_week: args.dayOfWeek ?? null,
    hour_utc: args.hourUtc ?? null,
    auto_publish: args.autoPublish,
    is_active: args.isActive,
    created_by: args.userId,
  }
  if (!payload.url) throw new Error('Schedule URL is required.')

  const query = args.id
    ? supabaseAdmin()
      .from('rag_scrape_schedules')
      .update(payload)
      .eq('workspace_id', args.workspaceId)
      .eq('id', args.id)
      .select('*')
      .single()
    : supabaseAdmin()
      .from('rag_scrape_schedules')
      .insert(payload)
      .select('*')
      .single()

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return toSchedule(data as RagScrapeScheduleRow)
}

export async function deleteRagScrapeSchedule(args: {
  readonly workspaceId: string
  readonly id: string
}): Promise<{ readonly deleted: true; readonly id: string }> {
  const { error } = await supabaseAdmin()
    .from('rag_scrape_schedules')
    .delete()
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.id)

  if (error) throw new Error(error.message)
  return { deleted: true, id: args.id }
}

export async function listRagKnowledgeGaps(workspaceId: string): Promise<ReadonlyArray<RagKnowledgeGapView>> {
  const { data, error } = await supabaseAdmin()
    .from('rag_knowledge_gaps')
    .select('id, question, channel, reason, count, suggested_action, language_name, last_asked_at, resolved_at')
    .eq('workspace_id', workspaceId)
    .is('resolved_at', null)
    .order('last_asked_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return ((data ?? []) as RagKnowledgeGapRow[]).map(toGap)
}
