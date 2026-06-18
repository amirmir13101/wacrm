import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt, encrypt } from '@/lib/whatsapp/encryption'

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v2'
const FIRECRAWL_REQUEST_TIMEOUT_MS = 30_000
const DEFAULT_FIRECRAWL_MAX_RUNTIME_MS = 60 * 60 * 1_000

const FIRECRAWL_EXCLUDE_PATHS = [
  '(^|/)(login|log-in|signin|sign-in)(/|$)',
  '(^|/)(admin|wp-admin)(/|$)',
  '(^|/)(account|my-account)(/|$)',
  '(^|/)(cart|basket)(/|$)',
  '(^|/)(checkout)(/|$)',
]

export interface FirecrawlPublicSettings {
  readonly apiKeyConfigured: boolean
  readonly apiKeyMasked: string | null
  readonly apiKeyConfiguredAt: string | null
  readonly lastTestedAt: string | null
  readonly lastTestStatus: 'success' | 'failed' | 'not_tested' | null
  readonly lastTestError: string | null
  readonly remainingCredits: number | null
  readonly planCredits: number | null
  readonly billingPeriodStart: string | null
  readonly billingPeriodEnd: string | null
  readonly maxConcurrency: number | null
}

export interface FirecrawlCrawlPage {
  readonly markdown?: string
  readonly html?: string
  readonly rawHtml?: string
  readonly links?: readonly string[]
  readonly metadata?: Readonly<Record<string, unknown>>
}

export interface FirecrawlCrawlStatus {
  readonly status: 'scraping' | 'completed' | 'failed' | 'cancelled'
  readonly total: number
  readonly completed: number
  readonly creditsUsed: number
  readonly data: readonly FirecrawlCrawlPage[]
  readonly errors: readonly FirecrawlCrawlError[]
  readonly robotsBlocked: readonly string[]
  readonly createdAt: string | null
  readonly completedAt: string | null
  readonly durationSeconds: number | null
}

export interface FirecrawlCrawlError {
  readonly url: string
  readonly error: string
}

interface FirecrawlAccountUsage {
  readonly remainingCredits: number | null
  readonly planCredits: number | null
  readonly billingPeriodStart: string | null
  readonly billingPeriodEnd: string | null
  readonly maxConcurrency: number | null
}

interface FirecrawlSettingsRow {
  readonly encrypted_api_key: string | null
  readonly api_key_last4: string | null
  readonly api_key_configured_at: string | null
  readonly last_tested_at: string | null
  readonly last_test_status: 'success' | 'failed' | 'not_tested' | null
  readonly last_test_error: string | null
  readonly remaining_credits: number | null
  readonly plan_credits: number | null
  readonly billing_period_start: string | null
  readonly billing_period_end: string | null
  readonly max_concurrency: number | null
}

export function maskFirecrawlApiKey(last4: string | null | undefined): string | null {
  return last4 ? `•••• ${last4}` : null
}

export async function getPublicFirecrawlSettings(workspaceId: string): Promise<FirecrawlPublicSettings> {
  const { data, error } = await supabaseAdmin()
    .from('ai_firecrawl_settings')
    .select('encrypted_api_key, api_key_last4, api_key_configured_at, last_tested_at, last_test_status, last_test_error, remaining_credits, plan_credits, billing_period_start, billing_period_end, max_concurrency')
    .eq('workspace_id', workspaceId)
    .maybeSingle<FirecrawlSettingsRow>()

  if (error) throw new Error(error.message)
  return toPublicSettings(data ?? null)
}

export async function saveFirecrawlApiKey(workspaceId: string, apiKey: string): Promise<FirecrawlPublicSettings> {
  const normalized = apiKey.trim()
  if (normalized.length < 10) throw new Error('Enter a valid Firecrawl API key.')

  const { error } = await supabaseAdmin().from('ai_firecrawl_settings').upsert(
    {
      workspace_id: workspaceId,
      encrypted_api_key: encrypt(normalized),
      api_key_last4: normalized.slice(-4),
      api_key_configured_at: new Date().toISOString(),
      last_test_status: 'not_tested',
      last_test_error: null,
    },
    { onConflict: 'workspace_id' },
  )
  if (error) throw new Error(error.message)
  return getPublicFirecrawlSettings(workspaceId)
}

export async function resolveFirecrawlApiKey(workspaceId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('ai_firecrawl_settings')
    .select('encrypted_api_key')
    .eq('workspace_id', workspaceId)
    .maybeSingle<{ encrypted_api_key: string | null }>()

  if (error) throw new Error(error.message)
  return data?.encrypted_api_key ? decrypt(data.encrypted_api_key) : null
}

export async function testFirecrawlConnection(workspaceId: string): Promise<{
  readonly ok: boolean
  readonly message: string
  readonly settings: FirecrawlPublicSettings
}> {
  const apiKey = await resolveFirecrawlApiKey(workspaceId)
  if (!apiKey) {
    await markFirecrawlTest(workspaceId, false, 'Firecrawl API key is not configured.')
    return {
      ok: false,
      message: 'Firecrawl API key is not configured.',
      settings: await getPublicFirecrawlSettings(workspaceId),
    }
  }

  try {
    const usage = await fetchFirecrawlAccountUsage(apiKey)
    await updateFirecrawlUsage(workspaceId, usage, {
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: 'success',
      lastTestError: null,
    })
    return {
      ok: true,
      message: 'Firecrawl connection works.',
      settings: await getPublicFirecrawlSettings(workspaceId),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Firecrawl connection failed.'
    await markFirecrawlTest(workspaceId, false, message)
    return { ok: false, message, settings: await getPublicFirecrawlSettings(workspaceId) }
  }
}

export async function refreshFirecrawlAccountUsage(
  workspaceId: string,
  apiKey: string,
): Promise<FirecrawlPublicSettings> {
  const usage = await fetchFirecrawlAccountUsage(apiKey)
  await updateFirecrawlUsage(workspaceId, usage, {
    lastTestedAt: new Date().toISOString(),
    lastTestStatus: 'success',
    lastTestError: null,
  })
  return getPublicFirecrawlSettings(workspaceId)
}

export async function startFirecrawlWebsiteCrawl(args: {
  readonly apiKey: string
  readonly url: string
  readonly pageLimit: number
}): Promise<{ readonly id: string }> {
  const response = await firecrawlRequest('/crawl', args.apiKey, {
    method: 'POST',
    body: JSON.stringify({
      url: args.url,
      limit: args.pageLimit,
      sitemap: 'include',
      crawlEntireDomain: true,
      allowExternalLinks: false,
      allowSubdomains: false,
      ignoreQueryParameters: true,
      deduplicateSimilarURLs: true,
      excludePaths: FIRECRAWL_EXCLUDE_PATHS,
      maxConcurrency: Math.min(5, args.pageLimit),
      scrapeOptions: {
        formats: ['markdown', 'rawHtml', 'links'],
        onlyMainContent: false,
        removeBase64Images: true,
        blockAds: true,
        proxy: 'auto',
        storeInCache: true,
        parsers: [],
      },
    }),
  })
  const id = readString(response.id)
  if (!id) throw new Error('Firecrawl did not return a crawl job ID.')
  return { id }
}

export async function getFirecrawlCrawlStatus(apiKey: string, crawlId: string): Promise<FirecrawlCrawlStatus> {
  const firstStatus = await firecrawlRequest(`/crawl/${encodeURIComponent(crawlId)}`, apiKey)
  const status = readString(firstStatus.status)
  if (!status || !['scraping', 'completed', 'failed', 'cancelled'].includes(status)) {
    throw new Error('Firecrawl returned an unknown crawl status.')
  }

  const pages: FirecrawlCrawlPage[] = []
  if (Array.isArray(firstStatus.data)) {
    pages.push(...firstStatus.data.filter(isRecord).map((page) => page as FirecrawlCrawlPage))
  }

  if (status === 'completed') {
    let nextUrl = readString(firstStatus.next)
    const visited = new Set<string>()
    while (nextUrl && !visited.has(nextUrl) && visited.size < 100) {
      visited.add(nextUrl)
      const response = await firecrawlRequest(nextUrl, apiKey)
      if (Array.isArray(response.data)) {
        pages.push(...response.data.filter(isRecord).map((page) => page as FirecrawlCrawlPage))
      }
      nextUrl = readString(response.next)
    }
  }

  const crawlErrors =
    status === 'completed' || status === 'failed' || status === 'cancelled'
      ? await getFirecrawlCrawlErrors(apiKey, crawlId)
      : { errors: [], robotsBlocked: [] }

  return {
    status: status as FirecrawlCrawlStatus['status'],
    total: readNumber(firstStatus.total) ?? pages.length,
    completed: readNumber(firstStatus.completed) ?? pages.length,
    creditsUsed: readNumber(firstStatus.creditsUsed) ?? 0,
    data: pages,
    errors: crawlErrors.errors,
    robotsBlocked: crawlErrors.robotsBlocked,
    createdAt: readString(firstStatus.createdAt),
    completedAt: readString(firstStatus.completedAt),
    durationSeconds: readNumber(firstStatus.duration),
  }
}

export async function cancelFirecrawlCrawl(apiKey: string, crawlId: string): Promise<void> {
  await firecrawlRequest(`/crawl/${encodeURIComponent(crawlId)}`, apiKey, { method: 'DELETE' })
}

export function isFirecrawlJobStalled(
  createdAt: string | null | undefined,
  nowMs = Date.now(),
  maxRuntimeMs = getFirecrawlMaxRuntimeMs(),
): boolean {
  if (!createdAt) return false
  const createdAtMs = Date.parse(createdAt)
  return Number.isFinite(createdAtMs) && nowMs - createdAtMs >= maxRuntimeMs
}

export function getFirecrawlMaxRuntimeMs(): number {
  const configuredMinutes = Number(process.env.AI_FIRECRAWL_MAX_RUNTIME_MINUTES ?? 60)
  const safeMinutes = Number.isFinite(configuredMinutes)
    ? Math.max(10, Math.min(180, Math.floor(configuredMinutes)))
    : DEFAULT_FIRECRAWL_MAX_RUNTIME_MS / 60_000
  return safeMinutes * 60_000
}

async function getFirecrawlCrawlErrors(
  apiKey: string,
  crawlId: string,
): Promise<{ errors: FirecrawlCrawlError[]; robotsBlocked: string[] }> {
  try {
    const response = await firecrawlRequest(`/crawl/${encodeURIComponent(crawlId)}/errors`, apiKey)
    const errors = Array.isArray(response.errors)
      ? response.errors
          .filter(isRecord)
          .map((item) => ({
            url: readString(item.url) ?? '',
            error: readString(item.error) ?? 'Firecrawl could not scrape this page.',
          }))
          .filter((item) => item.url)
      : []
    const robotsBlocked = Array.isArray(response.robotsBlocked)
      ? response.robotsBlocked.map(readString).filter((value): value is string => Boolean(value))
      : []
    return { errors, robotsBlocked }
  } catch {
    // Crawl content remains usable if Firecrawl's optional diagnostics endpoint fails.
    return { errors: [], robotsBlocked: [] }
  }
}

async function firecrawlRequest(
  pathOrUrl: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FIRECRAWL_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(pathOrUrl.startsWith('http') ? pathOrUrl : `${FIRECRAWL_BASE_URL}${pathOrUrl}`, {
      ...init,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        ...init.headers,
      },
      signal: controller.signal,
    })
    const body: unknown = await response.json().catch(() => ({}))
    if (!response.ok) {
      const record = asRecord(body)
      const detail = readString(record.error) ?? readString(record.message)
      const retryAfter = response.headers.get('retry-after')
      if (response.status === 429) {
        throw new Error(`Firecrawl rate or concurrency limit reached${retryAfter ? `; retry after ${retryAfter} seconds` : ''}.`)
      }
      throw new Error(detail ?? `Firecrawl returned HTTP ${response.status}.`)
    }
    return asRecord(body)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Firecrawl request timed out.')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function markFirecrawlTest(workspaceId: string, ok: boolean, error: string | null): Promise<void> {
  await supabaseAdmin()
    .from('ai_firecrawl_settings')
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_status: ok ? 'success' : 'failed',
      last_test_error: error?.slice(0, 500) ?? null,
    })
    .eq('workspace_id', workspaceId)
}

async function fetchFirecrawlAccountUsage(apiKey: string): Promise<FirecrawlAccountUsage> {
  const [creditsResponse, queueResponse] = await Promise.all([
    firecrawlRequest('/team/credit-usage', apiKey),
    firecrawlRequest('/team/queue-status', apiKey),
  ])
  const credits = asRecord(creditsResponse.data)
  const queue = asRecord(queueResponse)
  return {
    remainingCredits: readNumber(credits.remainingCredits),
    planCredits: readNumber(credits.planCredits),
    billingPeriodStart: readString(credits.billingPeriodStart),
    billingPeriodEnd: readString(credits.billingPeriodEnd),
    maxConcurrency: readNumber(queue.maxConcurrency),
  }
}

async function updateFirecrawlUsage(
  workspaceId: string,
  usage: FirecrawlAccountUsage,
  testState?: {
    readonly lastTestedAt: string
    readonly lastTestStatus: 'success'
    readonly lastTestError: null
  },
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('ai_firecrawl_settings')
    .update({
      ...(testState
        ? {
            last_tested_at: testState.lastTestedAt,
            last_test_status: testState.lastTestStatus,
            last_test_error: testState.lastTestError,
          }
        : {}),
      remaining_credits: usage.remainingCredits,
      plan_credits: usage.planCredits,
      billing_period_start: usage.billingPeriodStart,
      billing_period_end: usage.billingPeriodEnd,
      max_concurrency: usage.maxConcurrency,
    })
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(error.message)
}

function toPublicSettings(data: FirecrawlSettingsRow | null): FirecrawlPublicSettings {
  return {
    apiKeyConfigured: Boolean(data?.encrypted_api_key),
    apiKeyMasked: maskFirecrawlApiKey(data?.api_key_last4),
    apiKeyConfiguredAt: data?.api_key_configured_at ?? null,
    lastTestedAt: data?.last_tested_at ?? null,
    lastTestStatus: data?.last_test_status ?? null,
    lastTestError: data?.last_test_error ?? null,
    remainingCredits: data?.remaining_credits ?? null,
    planCredits: data?.plan_credits ?? null,
    billingPeriodStart: data?.billing_period_start ?? null,
    billingPeriodEnd: data?.billing_period_end ?? null,
    maxConcurrency: data?.max_concurrency ?? null,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
