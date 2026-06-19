import type { SupabaseClient } from '@supabase/supabase-js'
import { pathToFileURL } from 'node:url'

import { detectChanges } from '@/lib/ai/change-detection'
import {
  getFirecrawlCrawlStatus,
  refreshFirecrawlAccountUsage,
  resolveFirecrawlApiKey,
  startFirecrawlWebsiteCrawl,
} from '@/lib/ai/firecrawl'
import { replaceKnowledgeSourceWithChunks, saveKnowledgeSourceWithChunks } from '@/lib/ai/knowledge'
import { calculateNextRunAt, calculateRetryAt, type ScrapeFrequency } from '@/lib/ai/scrape-schedules'
import { buildWebsiteImportFromFirecrawl } from '@/lib/ai/website-import'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export interface DueSchedule {
  readonly id: string
  readonly workspace_id: string
  readonly source_id: string | null
  readonly url: string
  readonly frequency: ScrapeFrequency
  readonly day_of_week: number | null
  readonly hour_utc: number
  readonly auto_publish: boolean
  readonly page_limit: number
}

export interface SchedulerDependencies {
  readonly client: SupabaseClient
  readonly resolveKey: typeof resolveFirecrawlApiKey
  readonly startCrawl: typeof startFirecrawlWebsiteCrawl
  readonly getStatus: typeof getFirecrawlCrawlStatus
  readonly sleep: (milliseconds: number) => Promise<void>
}

const POLL_INTERVAL_MS = 5 * 60 * 1_000
const CRAWL_POLL_MS = 5_000
const MAX_CRAWL_POLLS = 720

export async function recoverStaleRuns(client: SupabaseClient, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1_000).toISOString()
  const { data, error } = await client
    .from('ai_import_history')
    .update({ status: 'failed', error_message: 'worker_restart', completed_at: now.toISOString() })
    .eq('status', 'running')
    .lt('started_at', cutoff)
    .select('id')
  if (error) throw new Error(error.message)
  return (data ?? []).length
}

export async function processDueSchedules(dependencies: SchedulerDependencies): Promise<void> {
  const { data, error } = await dependencies.client
    .from('ai_scrape_schedules')
    .select('id, workspace_id, source_id, url, frequency, day_of_week, hour_utc, auto_publish, page_limit')
    .eq('is_active', true)
    .lte('next_run_at', new Date().toISOString())
    .order('next_run_at', { ascending: true })
    .limit(5)
  if (error) throw new Error(error.message)
  await Promise.allSettled(((data ?? []) as DueSchedule[]).map((schedule) => processSchedule(schedule, dependencies)))
}

export async function processSchedule(schedule: DueSchedule, dependencies: SchedulerDependencies): Promise<void> {
  const now = new Date()
  const nextRunAt = calculateNextRunAt({
    frequency: schedule.frequency,
    dayOfWeek: schedule.day_of_week,
    hourUtc: schedule.hour_utc,
  }, now)
  await dependencies.client
    .from('ai_scrape_schedules')
    .update({ next_run_at: nextRunAt })
    .eq('id', schedule.id)
    .eq('workspace_id', schedule.workspace_id)

  const history = await dependencies.client
    .from('ai_import_history')
    .insert({
      workspace_id: schedule.workspace_id,
      source_id: schedule.source_id,
      schedule_id: schedule.id,
      url: schedule.url,
      trigger: 'scheduled',
      status: 'running',
      started_at: now.toISOString(),
    })
    .select('id')
    .single()
  if (history.error || !history.data) throw new Error(history.error?.message ?? 'Failed to create import history.')
  const historyId = history.data.id as string
  console.info('[scrape-scheduler] started', { scheduleId: schedule.id, workspaceId: schedule.workspace_id })

  try {
    const apiKey = await dependencies.resolveKey(schedule.workspace_id)
    if (!apiKey) throw new SchedulerRunError('firecrawl_key_missing')
    let crawlId: string
    try {
      crawlId = (await dependencies.startCrawl({ apiKey, url: schedule.url, pageLimit: schedule.page_limit })).id
    } catch (error) {
      if (isRateLimitError(error)) throw new SchedulerRunError('firecrawl_credits_exhausted', true)
      throw error
    }
    await dependencies.client.from('ai_import_history').update({ firecrawl_job_id: crawlId }).eq('id', historyId)

    const importJob = await dependencies.client.from('ai_website_import_jobs').insert({
      workspace_id: schedule.workspace_id,
      created_by_user_id: null,
      website_url: schedule.url,
      normalized_origin: new URL(schedule.url).origin,
      status: 'running',
      page_limit: Math.min(100, schedule.page_limit),
      crawl_provider: 'firecrawl',
      external_crawl_id: crawlId,
      provider_status: 'scraping',
    }).select('id').single()
    if (importJob.error || !importJob.data) throw new Error(importJob.error?.message ?? 'Failed to create review job.')

    let status: Awaited<ReturnType<typeof getFirecrawlCrawlStatus>> | null = null
    for (let attempt = 0; attempt < MAX_CRAWL_POLLS; attempt += 1) {
      await dependencies.sleep(CRAWL_POLL_MS)
      try {
        status = await dependencies.getStatus(apiKey, crawlId)
      } catch (error) {
        if (isRateLimitError(error)) throw new SchedulerRunError('firecrawl_credits_exhausted', true)
        throw error
      }
      if (status.status !== 'scraping') break
    }
    if (!status || status.status !== 'completed') throw new Error(`firecrawl_${status?.status ?? 'timeout'}`)

    const result = buildWebsiteImportFromFirecrawl({
      startUrl: schedule.url,
      pages: status.data,
      errors: status.errors,
      robotsBlocked: status.robotsBlocked,
      pageLimit: schedule.page_limit,
    })
    if (result.pagesImported === 0) throw new Error('no_useful_content')
    const previous = schedule.source_id
      ? await dependencies.client.from('ai_knowledge_sources').select('content').eq('id', schedule.source_id).eq('workspace_id', schedule.workspace_id).maybeSingle()
      : { data: null, error: null }
    if (previous.error) throw new Error(previous.error.message)
    const changes = detectChanges(previous.data?.content ?? null, result.draftContent)

    let sourceId = schedule.source_id
    let finalStatus: 'published' | 'draft_ready' | 'no_changes' = 'no_changes'
    if (changes.hasChanges && schedule.auto_publish) {
      const source = sourceId
        ? await replaceKnowledgeSourceWithChunks({
            workspaceId: schedule.workspace_id,
            sourceId,
            title: result.draftTitle,
            content: result.draftContent,
            client: dependencies.client,
          })
        : await saveKnowledgeSourceWithChunks({
            workspaceId: schedule.workspace_id,
            sourceType: 'website',
            title: result.draftTitle,
            content: result.draftContent,
          })
      sourceId = source.id
      finalStatus = 'published'
      if (!schedule.source_id) {
        await dependencies.client.from('ai_scrape_schedules').update({ source_id: sourceId }).eq('id', schedule.id)
      }
    } else if (changes.hasChanges) {
      finalStatus = 'draft_ready'
    }

    await dependencies.client.from('ai_website_import_jobs').update({
      status: finalStatus === 'published' ? 'completed' : finalStatus === 'draft_ready' ? 'draft_ready' : 'completed',
      pages_found: result.pagesFound,
      pages_imported: result.pagesImported,
      pages_skipped: result.pagesSkipped,
      pages_failed: result.pagesFailed,
      duplicate_pages: result.duplicatePages,
      draft_title: result.draftTitle,
      draft_content: result.draftContent,
      published_source_id: finalStatus === 'published' ? sourceId : null,
      credits_used: status.creditsUsed,
      provider_status: status.status,
      completed_at: new Date().toISOString(),
    }).eq('id', importJob.data.id)
    await dependencies.client.from('ai_import_history').update({
      source_id: sourceId,
      status: finalStatus,
      pages_found: result.pagesFound,
      pages_imported: result.pagesImported,
      pages_failed: result.pagesFailed,
      pages_skipped: result.pagesSkipped,
      draft_length: result.draftContent.length,
      changes_detected: changes.hasChanges,
      change_summary: changes.summary,
      credits_used: status.creditsUsed,
      quality_warnings: result.qualityWarnings,
      completed_at: new Date().toISOString(),
      published_at: finalStatus === 'published' ? new Date().toISOString() : null,
    }).eq('id', historyId)
    await dependencies.client.from('ai_scrape_schedules').update({
      source_id: sourceId,
      last_run_at: new Date().toISOString(),
      last_run_status: finalStatus,
      last_run_job_id: importJob.data.id,
      last_run_pages_found: result.pagesFound,
      last_run_pages_imported: result.pagesImported,
      last_run_changes_detected: changes.hasChanges,
    }).eq('id', schedule.id)
    await refreshFirecrawlAccountUsage(schedule.workspace_id, apiKey).catch(() => undefined)
    console.info('[scrape-scheduler] completed', {
      scheduleId: schedule.id,
      workspaceId: schedule.workspace_id,
      status: finalStatus,
      pagesFound: result.pagesFound,
      pagesImported: result.pagesImported,
      creditsUsed: status.creditsUsed,
    })
  } catch (error) {
    const reason = error instanceof SchedulerRunError ? error.code : safeError(error)
    const retryAt = error instanceof SchedulerRunError && error.retryInSixHours ? calculateRetryAt() : nextRunAt
    await dependencies.client.from('ai_import_history').update({
      status: 'failed',
      error_message: reason,
      completed_at: new Date().toISOString(),
    }).eq('id', historyId)
    await dependencies.client.from('ai_scrape_schedules').update({
      next_run_at: reason === 'firecrawl_key_missing' ? null : retryAt,
      last_run_at: new Date().toISOString(),
      last_run_status: 'failed',
    }).eq('id', schedule.id)
    console.warn('[scrape-scheduler] failed', { scheduleId: schedule.id, workspaceId: schedule.workspace_id, status: 'failed', reason })
  }
}

class SchedulerRunError extends Error {
  constructor(readonly code: string, readonly retryInSixHours = false) {
    super(code)
  }
}

function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && /rate|429|credit|concurrency/i.test(error.message)
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : 'scheduled_import_failed').slice(0, 500)
}

async function main(): Promise<void> {
  const client = supabaseAdmin()
  await recoverStaleRuns(client)
  const dependencies: SchedulerDependencies = {
    client,
    resolveKey: resolveFirecrawlApiKey,
    startCrawl: startFirecrawlWebsiteCrawl,
    getStatus: getFirecrawlCrawlStatus,
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  }
  for (;;) {
    await processDueSchedules(dependencies).catch((error) => {
      console.error('[scrape-scheduler] poll failed', { error: safeError(error) })
    })
    await dependencies.sleep(POLL_INTERVAL_MS)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
