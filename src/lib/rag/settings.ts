import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt, encrypt } from '@/lib/whatsapp/encryption'
import { resolveRagProviderConfig } from './provider'
import { getSecretLast4, maskSecret, sanitizeProviderError } from './security'
import { RAG_PROVIDER_TYPES, type RagProviderType } from './types'

export type RagConnectionStatus = 'not_tested' | 'success' | 'failed'

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v2'
const FIRECRAWL_REQUEST_TIMEOUT_MS = 30_000

export interface RagProviderSettingsView {
  readonly configured: boolean
  readonly provider: RagProviderType
  readonly keyLast4: string | null
  readonly maskedKey: string | null
  readonly enabled: boolean
  readonly baseUrl: string | null
  readonly chatModel: string | null
  readonly embeddingModel: string | null
  readonly embeddingDimensions: number | null
  readonly lastTestedAt: string | null
  readonly lastTestStatus: RagConnectionStatus | null
  readonly lastTestError: string | null
}

export interface RagFirecrawlSettingsView {
  readonly configured: boolean
  readonly keyLast4: string | null
  readonly maskedKey: string | null
  readonly enabled: boolean
  readonly lastTestedAt: string | null
  readonly lastTestStatus: RagConnectionStatus | null
  readonly lastTestError: string | null
  readonly creditUsage?: RagFirecrawlCreditUsage | null
}

export interface RagFirecrawlCreditUsage {
  readonly remainingCredits: number | null
  readonly totalCredits: number | null
  readonly usedCredits: number | null
  readonly plan: string | null
  readonly limit: number | null
  readonly lastUpdatedAt: string
}

interface RagProviderSettingsRow {
  readonly provider?: string | null
  readonly encrypted_api_key?: string | null
  readonly api_key_last4?: string | null
  readonly enabled?: boolean | null
  readonly backend_config?: Record<string, unknown> | null
  readonly last_tested_at?: string | null
  readonly last_test_status?: string | null
  readonly last_test_error?: string | null
}

interface RagFirecrawlSettingsRow {
  readonly encrypted_api_key?: string | null
  readonly api_key_last4?: string | null
  readonly enabled?: boolean | null
  readonly last_tested_at?: string | null
  readonly last_test_status?: string | null
  readonly last_test_error?: string | null
}

export function isRagProviderType(value: string): value is RagProviderType {
  return (RAG_PROVIDER_TYPES as readonly string[]).includes(value)
}

function safeStatus(value: string | null | undefined): RagConnectionStatus | null {
  if (value === 'not_tested' || value === 'success' || value === 'failed') return value
  return null
}

function toProviderView(row: RagProviderSettingsRow | null): RagProviderSettingsView {
  const provider = isRagProviderType(row?.provider ?? '') ? row!.provider as RagProviderType : 'openai'
  const keyLast4 = row?.api_key_last4 ?? getSecretLast4(row?.encrypted_api_key)
  const backend = row?.backend_config ?? {}
  const baseUrl = typeof backend.baseUrl === 'string' ? backend.baseUrl : null
  const chatModel = typeof backend.chatModel === 'string' ? backend.chatModel : null
  const embeddingModel = typeof backend.embeddingModel === 'string' ? backend.embeddingModel : null
  const embeddingDimensions = typeof backend.embeddingDimensions === 'number' ? backend.embeddingDimensions : null

  return {
    configured: Boolean(row?.encrypted_api_key),
    provider,
    keyLast4,
    maskedKey: maskSecret(keyLast4),
    enabled: row?.enabled === true,
    baseUrl,
    chatModel,
    embeddingModel,
    embeddingDimensions,
    lastTestedAt: row?.last_tested_at ?? null,
    lastTestStatus: safeStatus(row?.last_test_status),
    lastTestError: row?.last_test_error ?? null,
  }
}

function toFirecrawlView(row: RagFirecrawlSettingsRow | null): RagFirecrawlSettingsView {
  const keyLast4 = row?.api_key_last4 ?? getSecretLast4(row?.encrypted_api_key)

  return {
    configured: Boolean(row?.encrypted_api_key),
    keyLast4,
    maskedKey: maskSecret(keyLast4),
    enabled: row?.enabled === true,
    lastTestedAt: row?.last_tested_at ?? null,
    lastTestStatus: safeStatus(row?.last_test_status),
    lastTestError: row?.last_test_error ?? null,
    creditUsage: null,
  }
}

export async function getRagProviderSettings(
  workspaceId: string,
): Promise<RagProviderSettingsView> {
  const { data, error } = await supabaseAdmin()
    .from('rag_provider_settings')
    .select('provider, encrypted_api_key, api_key_last4, enabled, backend_config, last_tested_at, last_test_status, last_test_error')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return toProviderView(data as RagProviderSettingsRow | null)
}

export async function saveRagProviderSettings(args: {
  readonly workspaceId: string
  readonly provider: RagProviderType
  readonly apiKey: string
  readonly baseUrl?: string | null
  readonly chatModel?: string | null
  readonly embeddingModel?: string | null
  readonly embeddingDimensions?: number | null
}): Promise<RagProviderSettingsView> {
  const apiKey = args.apiKey.trim()
  if (!apiKey) throw new Error('API key is required.')

  const resolved = resolveRagProviderConfig({
    provider: args.provider,
    apiKey,
    baseUrl: args.baseUrl,
    chatModel: args.chatModel,
    embeddingModel: args.embeddingModel,
    embeddingDimensions: args.embeddingDimensions,
  })

  const { error } = await supabaseAdmin()
    .from('rag_provider_settings')
    .upsert(
      {
        workspace_id: args.workspaceId,
        provider: args.provider,
        encrypted_api_key: encrypt(apiKey),
        api_key_last4: getSecretLast4(apiKey),
        api_key_configured_at: new Date().toISOString(),
        enabled: true,
        last_test_status: 'not_tested',
        last_test_error: null,
        backend_config: {
          baseUrl: resolved.baseUrl,
          chatModel: resolved.chatModel,
          embeddingModel: resolved.embeddingModel,
          embeddingDimensions: resolved.embeddingDimensions,
        },
      },
      { onConflict: 'workspace_id' },
    )

  if (error) throw new Error(error.message)
  return getRagProviderSettings(args.workspaceId)
}

export async function testRagProviderSettings(
  workspaceId: string,
): Promise<RagProviderSettingsView> {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('rag_provider_settings')
    .select('provider, encrypted_api_key, backend_config')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.encrypted_api_key) {
    await updateProviderTestStatus(workspaceId, 'failed', 'API key is not configured.')
    return getRagProviderSettings(workspaceId)
  }

  try {
    const provider = isRagProviderType(data.provider ?? '') ? data.provider : 'openai'
    const apiKey = decrypt(data.encrypted_api_key)
    const backend = (data as RagProviderSettingsRow).backend_config ?? {}
    resolveRagProviderConfig({
      provider,
      apiKey,
      baseUrl: typeof backend.baseUrl === 'string' ? backend.baseUrl : null,
      chatModel: typeof backend.chatModel === 'string' ? backend.chatModel : null,
      embeddingModel: typeof backend.embeddingModel === 'string' ? backend.embeddingModel : null,
      embeddingDimensions: typeof backend.embeddingDimensions === 'number' ? backend.embeddingDimensions : null,
    })
    await updateProviderTestStatus(workspaceId, 'success', null)
  } catch (error) {
    await updateProviderTestStatus(workspaceId, 'failed', sanitizeProviderError(error))
  }

  return getRagProviderSettings(workspaceId)
}

async function updateProviderTestStatus(
  workspaceId: string,
  status: RagConnectionStatus,
  error: string | null,
): Promise<void> {
  const { error: updateError } = await supabaseAdmin()
    .from('rag_provider_settings')
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_status: status,
      last_test_error: error,
    })
    .eq('workspace_id', workspaceId)

  if (updateError) throw new Error(updateError.message)
}

export async function getRagFirecrawlSettings(
  workspaceId: string,
): Promise<RagFirecrawlSettingsView> {
  const { data, error } = await supabaseAdmin()
    .from('rag_firecrawl_settings')
    .select('encrypted_api_key, api_key_last4, enabled, last_tested_at, last_test_status, last_test_error')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return toFirecrawlView(data as RagFirecrawlSettingsRow | null)
}

export async function saveRagFirecrawlSettings(args: {
  readonly workspaceId: string
  readonly apiKey: string
}): Promise<RagFirecrawlSettingsView> {
  const apiKey = args.apiKey.trim()
  if (!apiKey) throw new Error('Firecrawl API key is required.')

  const { error } = await supabaseAdmin()
    .from('rag_firecrawl_settings')
    .upsert(
      {
        workspace_id: args.workspaceId,
        encrypted_api_key: encrypt(apiKey),
        api_key_last4: getSecretLast4(apiKey),
        api_key_configured_at: new Date().toISOString(),
        enabled: true,
        last_test_status: 'not_tested',
        last_test_error: null,
      },
      { onConflict: 'workspace_id' },
    )

  if (error) throw new Error(error.message)
  return getRagFirecrawlSettings(args.workspaceId)
}

export async function testRagFirecrawlSettings(
  workspaceId: string,
): Promise<RagFirecrawlSettingsView> {
  const { data, error } = await supabaseAdmin()
    .from('rag_firecrawl_settings')
    .select('encrypted_api_key')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.encrypted_api_key) {
    await updateFirecrawlTestStatus(workspaceId, 'failed', 'Firecrawl API key is not configured.')
    return getRagFirecrawlSettings(workspaceId)
  }

  try {
    const apiKey = decrypt(data.encrypted_api_key)
    if (apiKey.trim().length < 8) throw new Error('Firecrawl API key looks too short.')
    const creditUsage = await testFirecrawlAccount(apiKey)
    await updateFirecrawlTestStatus(workspaceId, 'success', null)
    const settings = await getRagFirecrawlSettings(workspaceId)
    return {
      ...settings,
      creditUsage,
    }
  } catch (error) {
    await updateFirecrawlTestStatus(workspaceId, 'failed', sanitizeProviderError(error))
  }

  return getRagFirecrawlSettings(workspaceId)
}

async function updateFirecrawlTestStatus(
  workspaceId: string,
  status: RagConnectionStatus,
  error: string | null,
): Promise<void> {
  const { error: updateError } = await supabaseAdmin()
    .from('rag_firecrawl_settings')
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_status: status,
      last_test_error: error,
    })
    .eq('workspace_id', workspaceId)

  if (updateError) throw new Error(updateError.message)
}

function readNumber(payload: Record<string, unknown>, names: ReadonlyArray<string>): number | null {
  for (const name of names) {
    const value = payload[name]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return null
}

function readString(payload: Record<string, unknown>, names: ReadonlyArray<string>): string | null {
  for (const name of names) {
    const value = payload[name]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function normalizeFirecrawlCreditUsage(payload: Record<string, unknown>): RagFirecrawlCreditUsage {
  const nested = (
    typeof payload.data === 'object' && payload.data !== null
      ? payload.data
      : typeof payload.team === 'object' && payload.team !== null
        ? payload.team
        : payload
  ) as Record<string, unknown>

  const remainingCredits = readNumber(nested, [
    'remainingCredits',
    'remaining_credits',
    'creditsRemaining',
    'credits_remaining',
    'remaining',
    'creditsLeft',
    'credits_left',
  ])
  const totalCredits = readNumber(nested, [
    'totalCredits',
    'total_credits',
    'creditLimit',
    'credit_limit',
    'creditsLimit',
    'credits_limit',
    'limit',
  ])
  const usedCredits = readNumber(nested, [
    'usedCredits',
    'used_credits',
    'creditsUsed',
    'credits_used',
    'used',
  ]) ?? (remainingCredits !== null && totalCredits !== null ? Math.max(totalCredits - remainingCredits, 0) : null)

  return {
    remainingCredits,
    totalCredits,
    usedCredits,
    plan: readString(nested, ['plan', 'planName', 'plan_name', 'tier']),
    limit: totalCredits,
    lastUpdatedAt: new Date().toISOString(),
  }
}

async function testFirecrawlAccount(apiKey: string): Promise<RagFirecrawlCreditUsage> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FIRECRAWL_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/team/credit-usage`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({})) as Record<string, unknown> & { readonly error?: string; readonly message?: string }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('Firecrawl API key is missing, invalid, or rejected.')
      if (response.status === 402) throw new Error('Firecrawl credits or billing issue. Please check your Firecrawl account.')
      if (response.status === 429) throw new Error('Firecrawl rate limit reached. Please try again later.')
      throw new Error(payload.error ?? payload.message ?? `Firecrawl returned HTTP ${response.status}.`)
    }
    return normalizeFirecrawlCreditUsage(payload)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Firecrawl request timed out.')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function getRagKnowledgeCounts(workspaceId: string): Promise<{
  readonly sources: number
  readonly chunks: number
  readonly readyEmbeddings: number
  readonly failedEmbeddings: number
}> {
  const admin = supabaseAdmin()
  const [sources, chunks, readyEmbeddings, failedEmbeddings] = await Promise.all([
    admin
      .from('rag_knowledge_sources')
      .select('id', { head: true, count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .is('deleted_at', null),
    admin
      .from('rag_knowledge_chunks')
      .select('id, rag_knowledge_sources!inner(id)', { head: true, count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('rag_knowledge_sources.workspace_id', workspaceId)
      .eq('rag_knowledge_sources.status', 'active')
      .is('rag_knowledge_sources.deleted_at', null)
      .is('deleted_at', null),
    admin
      .from('rag_embeddings')
      .select('id, rag_knowledge_chunks!inner(id, rag_knowledge_sources!inner(id))', { head: true, count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('embedding_status', 'ready')
      .eq('rag_knowledge_chunks.workspace_id', workspaceId)
      .is('rag_knowledge_chunks.deleted_at', null)
      .eq('rag_knowledge_chunks.rag_knowledge_sources.workspace_id', workspaceId)
      .eq('rag_knowledge_chunks.rag_knowledge_sources.status', 'active')
      .is('rag_knowledge_chunks.rag_knowledge_sources.deleted_at', null),
    admin
      .from('rag_embeddings')
      .select('id, rag_knowledge_chunks!inner(id, rag_knowledge_sources!inner(id))', { head: true, count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('embedding_status', 'failed')
      .eq('rag_knowledge_chunks.workspace_id', workspaceId)
      .is('rag_knowledge_chunks.deleted_at', null)
      .eq('rag_knowledge_chunks.rag_knowledge_sources.workspace_id', workspaceId)
      .eq('rag_knowledge_chunks.rag_knowledge_sources.status', 'active')
      .is('rag_knowledge_chunks.rag_knowledge_sources.deleted_at', null),
  ])

  if (sources.error) throw new Error(sources.error.message)
  if (chunks.error) throw new Error(chunks.error.message)
  if (readyEmbeddings.error) throw new Error(readyEmbeddings.error.message)
  if (failedEmbeddings.error) throw new Error(failedEmbeddings.error.message)

  return {
    sources: sources.count ?? 0,
    chunks: chunks.count ?? 0,
    readyEmbeddings: readyEmbeddings.count ?? 0,
    failedEmbeddings: failedEmbeddings.count ?? 0,
  }
}
