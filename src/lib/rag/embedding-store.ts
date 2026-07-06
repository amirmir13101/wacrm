import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { generateRagEmbedding } from './embeddings'
import { DEFAULT_RAG_PROVIDER_CONFIG, resolveRagProviderConfig } from './provider'
import { sanitizeProviderError } from './security'
import { isRagProviderType } from './settings'
import type { RagProviderType, RagResolvedProviderConfig } from './types'

const RAG_EMBEDDING_DIMENSIONS = 1536
const ZERO_EMBEDDING = Array.from({ length: RAG_EMBEDDING_DIMENSIONS }, () => 0)
export const RAG_AUTO_EMBED_CHUNK_LIMIT = 0
export const RAG_EMBEDDING_BATCH_SIZE = 50
export const RAG_EMBEDDING_MAX_BATCH_CHARACTERS = 20_000
export const RAG_EMBEDDING_MAX_CHUNK_CHARACTERS = 8_000
export const RAG_EMBEDDING_DB_ID_BATCH_SIZE = 75
const FALLBACK_EMBEDDING_MODEL = 'embedding-not-configured'

type EmbeddingRunStatus = 'ready' | 'partial' | 'failed' | 'not_configured' | 'skipped'
export type RagEmbeddingErrorCategory =
  | 'provider_missing_key'
  | 'provider_invalid_key'
  | 'provider_billing_error'
  | 'provider_rate_limited'
  | 'provider_base_url_error'
  | 'provider_network_error'
  | 'embedding_payload_too_large'
  | 'embedding_model_error'
  | 'unknown_embedding_error'

interface RagProviderSettingsRow {
  readonly provider: string | null
  readonly encrypted_api_key: string | null
  readonly enabled: boolean | null
  readonly backend_config?: Record<string, unknown> | null
}

interface RagKnowledgeSourceRow {
  readonly id: string
  readonly source_type: string | null
  readonly cleaned_content?: string | null
  readonly metadata?: Record<string, unknown> | null
}

interface RagKnowledgeChunkRow {
  readonly id: string
  readonly chunk_text: string
  readonly content_hash: string | null
}

interface RagEmbeddingRow {
  readonly chunk_id: string
  readonly embedding_status: string
  readonly error_message: string | null
}

export interface RagEmbeddingSummary {
  readonly chunksProcessed: number
  readonly embeddingsCreated: number
  readonly embeddingsSkipped: number
  readonly embeddingsFailed: number
  readonly totalChunks: number
  readonly readyChunks: number
  readonly processedThisBatch: number
  readonly remainingChunks: number
  readonly percentComplete: number
  readonly batchChunkCount: number
  readonly batchTotalCharacters: number
  readonly totalSourceCharacters: number | null
  readonly status: EmbeddingRunStatus
  readonly message: string
  readonly embeddingsReady: boolean
  readonly embeddingErrorCategory: RagEmbeddingErrorCategory | null
  readonly userMessage: string
  readonly provider: RagProviderType | null
  readonly embeddingModel: string | null
}

function fallbackProvider(provider: string | null | undefined): RagProviderType {
  return isRagProviderType(provider ?? '') ? provider as RagProviderType : 'openai'
}

function fallbackEmbeddingModel(provider: RagProviderType): string {
  return DEFAULT_RAG_PROVIDER_CONFIG[provider].embeddingModel || FALLBACK_EMBEDDING_MODEL
}

function safeBaseUrlHost(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  try {
    return new URL(value).host
  } catch {
    return '[custom-url]'
  }
}

function readSafeErrorField(error: unknown, field: string): string {
  if (typeof error !== 'object' || error === null) return ''
  const value = (error as Record<string, unknown>)[field]
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null) {
    const nested = value as Record<string, unknown>
    const nestedMessage = nested.message
    const nestedCode = nested.code
    return [
      typeof nestedCode === 'string' || typeof nestedCode === 'number' ? String(nestedCode) : '',
      typeof nestedMessage === 'string' ? nestedMessage : '',
    ].filter(Boolean).join(' ')
  }
  return ''
}

function safeEmbeddingErrorSignal(error: unknown): string {
  const parts = [
    error instanceof Error ? error.message : String(error ?? ''),
    readSafeErrorField(error, 'name'),
    readSafeErrorField(error, 'code'),
    readSafeErrorField(error, 'status'),
    readSafeErrorField(error, 'statusCode'),
    readSafeErrorField(error, 'responseBody'),
    readSafeErrorField(error, 'body'),
    readSafeErrorField(error, 'data'),
    readSafeErrorField(error, 'cause'),
  ]
  return parts
    .join(' ')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .slice(0, 2_000)
}

export function categorizeRagEmbeddingError(error: unknown): RagEmbeddingErrorCategory {
  const message = safeEmbeddingErrorSignal(error)
  if (/embedding model is not configured|please select an embedding model|does not support embeddings|embedding-capable provider|embedding model dimension/i.test(message)) {
    return 'embedding_model_error'
  }
  if (/missing|not configured|required|add your api key|api key is required/i.test(message)) {
    return 'provider_missing_key'
  }
  if (/402|payment required|insufficient[_\s-]*(quota|funds|credits)|quota[_\s-]*exceeded|out of credits|no credits|low balance|balance|billing|credits|credit balance|account has insufficient funds/i.test(message)) {
    return 'provider_billing_error'
  }
  if (/429|rate limit|rate_limit|too many requests|limit reached|requests per/i.test(message)) {
    return 'provider_rate_limited'
  }
  if (/401|403|unauthorized|forbidden|authentication|invalid api key|incorrect api key|provider rejected/i.test(message)) {
    return 'provider_invalid_key'
  }
  if (/embedding provider must return|wrong dimensions|dimension|embedding model|model_not_found|does not exist|unsupported/i.test(message)) {
    return 'embedding_model_error'
  }
  if (/context length|input too large|maximum tokens|max tokens|payload too large|request entity too large|413|token limit|too many tokens/i.test(message)) {
    return 'embedding_payload_too_large'
  }
  if (/invalid url|enotfound|econnrefused|connection refused|dns|no such host|getaddrinfo|base url|baseurl/i.test(message)) {
    return 'provider_base_url_error'
  }
  if (/fetch failed|network|econnreset|etimedout|timeout|could not connect|connection|temporarily unavailable|service unavailable|503|504/i.test(message)) {
    return 'provider_network_error'
  }
  return 'unknown_embedding_error'
}

export function ragEmbeddingUserMessage(category: RagEmbeddingErrorCategory | null): string {
  if (category === 'provider_missing_key') {
    return 'AI provider is not configured. Add your API key before embeddings can be created.'
  }
  if (category === 'provider_invalid_key') {
    return 'Embedding failed because the AI provider API key appears invalid. Please update your API key.'
  }
  if (category === 'provider_billing_error') {
    return 'Embedding failed because the AI provider account may have low balance, no credits, or billing is not active. Please check your provider billing/credits.'
  }
  if (category === 'provider_rate_limited') {
    return 'Embedding provider rate limit reached. Please try again later or use a provider account with higher limits.'
  }
  if (category === 'provider_base_url_error') {
    return 'Could not connect to the embedding provider. Please check the provider base URL.'
  }
  if (category === 'provider_network_error') {
    return 'Could not connect to the embedding provider right now. Please try again.'
  }
  if (category === 'embedding_payload_too_large') {
    return 'Embedding failed because the knowledge chunk is too large for the provider. Please reduce the content size or split the knowledge.'
  }
  if (category === 'embedding_model_error') {
    return 'Selected provider does not support embeddings. Please choose an embedding-capable provider/model.'
  }
  return 'Chunks ready. Embeddings could not be created automatically. Please check your AI provider settings.'
}

function safeLogMessage(error: unknown): string {
  return safeEmbeddingErrorSignal(error).replace(/\s+/g, ' ').trim().slice(0, 240)
}

function logEmbeddingFailure(
  category: RagEmbeddingErrorCategory,
  context: string,
  details: Record<string, unknown> = {},
): void {
  console.warn('rag_embedding_failure', { category, context, ...details })
}

function sourceCharacterCount(source: RagKnowledgeSourceRow): number | null {
  if (typeof source.metadata?.character_count === 'number') return source.metadata.character_count
  if (typeof source.cleaned_content === 'string') return source.cleaned_content.length
  return null
}

function chunkCharacters(chunks: ReadonlyArray<RagKnowledgeChunkRow>): number {
  return chunks.reduce((total, chunk) => total + chunk.chunk_text.length, 0)
}

function chunkCharacterStats(chunks: ReadonlyArray<RagKnowledgeChunkRow>): {
  readonly minChunkCharacters: number
  readonly maxChunkCharacters: number
  readonly averageChunkCharacters: number
} {
  if (chunks.length === 0) {
    return {
      minChunkCharacters: 0,
      maxChunkCharacters: 0,
      averageChunkCharacters: 0,
    }
  }
  const lengths = chunks.map((chunk) => chunk.chunk_text.length)
  return {
    minChunkCharacters: Math.min(...lengths),
    maxChunkCharacters: Math.max(...lengths),
    averageChunkCharacters: Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length),
  }
}

function isTerminalEmbeddingFailure(row: RagEmbeddingRow | undefined): boolean {
  if (row?.embedding_status !== 'failed') return false
  return /single chunk is too large|chunk is too large|payload too large|maximum tokens|too many tokens|token limit/i.test(row.error_message ?? '')
}

function selectAdaptiveEmbeddingBatch(
  chunks: ReadonlyArray<RagKnowledgeChunkRow>,
): ReadonlyArray<RagKnowledgeChunkRow> {
  for (const size of [RAG_EMBEDDING_BATCH_SIZE, 25, 10, 5, 2, 1]) {
    const batch = chunks.slice(0, size)
    if (batch.length === 0) return []
    if (chunkCharacters(batch) <= RAG_EMBEDDING_MAX_BATCH_CHARACTERS || size === 1) {
      return batch
    }
  }
  return chunks.slice(0, 1)
}

function progressPercent(readyChunks: number, totalChunks: number): number {
  if (totalChunks <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((readyChunks / totalChunks) * 100)))
}

function sourceEmbeddingChunkState(source: RagKnowledgeSourceRow): 'freshly_created' | 'reused_current_chunks' {
  return source.metadata?.embedding_status === 'not_embedded' ? 'freshly_created' : 'reused_current_chunks'
}

function chunkArray<T>(values: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push([...values.slice(index, index + size)])
  }
  return chunks
}

function safeProviderConfig(row: RagProviderSettingsRow | null): {
  readonly config: RagResolvedProviderConfig | null
  readonly provider: RagProviderType
  readonly embeddingModel: string
  readonly baseUrlHost: string | null
  readonly error: string | null
  readonly errorCategory: RagEmbeddingErrorCategory | null
} {
  const provider = fallbackProvider(row?.provider)
  const embeddingModel = fallbackEmbeddingModel(provider)
  const backend = row?.backend_config ?? {}
  const configuredBaseUrl = typeof backend.baseUrl === 'string' ? backend.baseUrl : DEFAULT_RAG_PROVIDER_CONFIG[provider].baseUrl

  if (!row?.encrypted_api_key || row.enabled !== true) {
    return {
      config: null,
      provider,
      embeddingModel,
      baseUrlHost: safeBaseUrlHost(configuredBaseUrl),
      error: 'AI provider is not configured. Add your API key before embeddings can be created.',
      errorCategory: 'provider_missing_key',
    }
  }

  try {
    const apiKey = decrypt(row.encrypted_api_key)
    const config = resolveRagProviderConfig({
      provider,
      apiKey,
      baseUrl: typeof backend.baseUrl === 'string' ? backend.baseUrl : null,
      chatModel: typeof backend.chatModel === 'string' ? backend.chatModel : null,
      embeddingModel: typeof backend.embeddingModel === 'string' ? backend.embeddingModel : null,
      embeddingDimensions: typeof backend.embeddingDimensions === 'number' ? backend.embeddingDimensions : null,
    })
    if (config.embeddingDimensions !== RAG_EMBEDDING_DIMENSIONS) {
      return {
        config: null,
        provider,
        embeddingModel: config.embeddingModel,
        baseUrlHost: safeBaseUrlHost(config.baseUrl),
        error: 'Embedding model dimension does not match the vector database configuration. Please use the supported embedding model.',
        errorCategory: 'embedding_model_error',
      }
    }
    return {
      config,
      provider,
      embeddingModel: config.embeddingModel,
      baseUrlHost: safeBaseUrlHost(config.baseUrl),
      error: null,
      errorCategory: null,
    }
  } catch (error) {
    const sanitized = sanitizeProviderError(error)
    return {
      config: null,
      provider,
      embeddingModel,
      baseUrlHost: safeBaseUrlHost(configuredBaseUrl),
      error: sanitized,
      errorCategory: categorizeRagEmbeddingError(sanitized),
    }
  }
}

async function getEmbeddableSource(
  workspaceId: string,
  sourceId: string,
): Promise<RagKnowledgeSourceRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('rag_knowledge_sources')
    .select('id, source_type, cleaned_content, metadata')
    .eq('workspace_id', workspaceId)
    .eq('id', sourceId)
    .in('source_type', ['manual', 'website', 'faq', 'note'])
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as RagKnowledgeSourceRow | null
}

async function getProviderSettings(workspaceId: string): Promise<RagProviderSettingsRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('rag_provider_settings')
    .select('provider, encrypted_api_key, enabled, backend_config')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as RagProviderSettingsRow | null
}

async function getSourceChunks(
  workspaceId: string,
  sourceId: string,
): Promise<ReadonlyArray<RagKnowledgeChunkRow>> {
  const { data, error } = await supabaseAdmin()
    .from('rag_knowledge_chunks')
    .select('id, chunk_text, content_hash')
    .eq('workspace_id', workspaceId)
    .eq('source_id', sourceId)
    .is('deleted_at', null)
    .order('chunk_index', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as RagKnowledgeChunkRow[]
}

async function getExistingEmbeddings(args: {
  readonly workspaceId: string
  readonly chunkIds: ReadonlyArray<string>
  readonly embeddingModel: string
}): Promise<ReadonlyMap<string, RagEmbeddingRow>> {
  if (args.chunkIds.length === 0) return new Map()

  const rows = new Map<string, RagEmbeddingRow>()
  const idBatches = chunkArray(args.chunkIds, RAG_EMBEDDING_DB_ID_BATCH_SIZE)
  for (const chunkIds of idBatches) {
    const { data, error } = await supabaseAdmin()
      .from('rag_embeddings')
      .select('chunk_id, embedding_status, error_message')
      .eq('workspace_id', args.workspaceId)
      .eq('embedding_model', args.embeddingModel)
      .in('chunk_id', [...chunkIds])

    if (error) throw new Error(error.message)

    for (const row of (data ?? []) as RagEmbeddingRow[]) {
      rows.set(row.chunk_id, row)
    }
  }
  return rows
}

async function upsertEmbedding(args: {
  readonly workspaceId: string
  readonly chunkId: string
  readonly embeddingModel: string
  readonly embedding: ReadonlyArray<number>
  readonly status: 'ready' | 'failed'
  readonly errorMessage: string | null
}): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('rag_embeddings')
    .upsert(
      {
        workspace_id: args.workspaceId,
        chunk_id: args.chunkId,
        embedding: [...args.embedding],
        embedding_model: args.embeddingModel,
        embedding_dimensions: RAG_EMBEDDING_DIMENSIONS,
        embedding_status: args.status,
        embedded_at: new Date().toISOString(),
        error_message: args.errorMessage,
      },
      { onConflict: 'chunk_id,embedding_model' },
    )

  if (error) throw new Error(error.message)
}

async function resetRetriableFailedEmbeddings(args: {
  readonly workspaceId: string
  readonly embeddingModel: string
  readonly existing: ReadonlyMap<string, RagEmbeddingRow>
}): Promise<number> {
  const retryableFailedChunkIds = [...args.existing.entries()]
    .filter(([, row]) => row.embedding_status === 'failed' && !isTerminalEmbeddingFailure(row))
    .map(([chunkId]) => chunkId)

  if (retryableFailedChunkIds.length === 0) return 0

  let deleted = 0
  for (const chunkIds of chunkArray(retryableFailedChunkIds, RAG_EMBEDDING_DB_ID_BATCH_SIZE)) {
    const { count, error } = await supabaseAdmin()
      .from('rag_embeddings')
      .delete({ count: 'exact' })
      .eq('workspace_id', args.workspaceId)
      .eq('embedding_model', args.embeddingModel)
      .in('chunk_id', [...chunkIds])

    if (error) throw new Error(error.message)
    deleted += count ?? chunkIds.length
  }
  return deleted
}

async function updateSourceEmbeddingMetadata(args: {
  readonly workspaceId: string
  readonly sourceId: string
  readonly existingMetadata: Record<string, unknown> | null | undefined
  readonly summary: RagEmbeddingSummary
}): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('rag_knowledge_sources')
    .update({
      metadata: {
        ...(args.existingMetadata ?? {}),
        embedding_status: args.summary.status,
        embedding_summary: {
          chunksProcessed: args.summary.chunksProcessed,
          embeddingsCreated: args.summary.embeddingsCreated,
          embeddingsSkipped: args.summary.embeddingsSkipped,
          embeddingsFailed: args.summary.embeddingsFailed,
          totalChunks: args.summary.totalChunks,
          readyChunks: args.summary.readyChunks,
          processedThisBatch: args.summary.processedThisBatch,
          remainingChunks: args.summary.remainingChunks,
          percentComplete: args.summary.percentComplete,
          batchChunkCount: args.summary.batchChunkCount,
          batchTotalCharacters: args.summary.batchTotalCharacters,
          totalSourceCharacters: args.summary.totalSourceCharacters,
          embeddingsReady: args.summary.embeddingsReady,
          embeddingErrorCategory: args.summary.embeddingErrorCategory,
          userMessage: args.summary.userMessage,
          provider: args.summary.provider,
          embeddingModel: args.summary.embeddingModel,
        },
        embedding_updated_at: new Date().toISOString(),
      },
    })
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.sourceId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
}

function summarize(args: {
  readonly chunksProcessed: number
  readonly embeddingsCreated: number
  readonly embeddingsSkipped: number
  readonly embeddingsFailed: number
  readonly totalChunks?: number
  readonly readyChunks?: number
  readonly processedThisBatch?: number
  readonly remainingChunks?: number
  readonly percentComplete?: number
  readonly batchChunkCount?: number
  readonly batchTotalCharacters?: number
  readonly totalSourceCharacters?: number | null
  readonly status: EmbeddingRunStatus
  readonly message?: string
  readonly embeddingErrorCategory?: RagEmbeddingErrorCategory | null
  readonly provider?: RagProviderType | null
  readonly embeddingModel?: string | null
}): RagEmbeddingSummary {
  const errorCategory = args.embeddingErrorCategory ?? null
  const message = args.message ?? (
    args.status === 'ready'
      ? 'Embeddings ready. Knowledge is ready for chatbot answers.'
    : args.status === 'partial'
        ? 'Creating embeddings automatically. Some chunks still need embeddings.'
        : args.status === 'skipped'
          ? 'Chunks ready. Embeddings will be created automatically after saving.'
          : ragEmbeddingUserMessage(errorCategory)
  )
  return {
    chunksProcessed: args.chunksProcessed,
    embeddingsCreated: args.embeddingsCreated,
    embeddingsSkipped: args.embeddingsSkipped,
    embeddingsFailed: args.embeddingsFailed,
    totalChunks: args.totalChunks ?? args.chunksProcessed,
    readyChunks: args.readyChunks ?? args.embeddingsSkipped + args.embeddingsCreated,
    processedThisBatch: args.processedThisBatch ?? args.embeddingsCreated + args.embeddingsFailed,
    remainingChunks: args.remainingChunks ?? Math.max(0, args.chunksProcessed - (args.embeddingsSkipped + args.embeddingsCreated)),
    percentComplete: args.percentComplete ?? progressPercent(args.embeddingsSkipped + args.embeddingsCreated, args.chunksProcessed),
    batchChunkCount: args.batchChunkCount ?? args.embeddingsCreated + args.embeddingsFailed,
    batchTotalCharacters: args.batchTotalCharacters ?? 0,
    totalSourceCharacters: args.totalSourceCharacters ?? null,
    status: args.status,
    message,
    embeddingsReady: args.status === 'ready',
    embeddingErrorCategory: errorCategory,
    userMessage: message,
    provider: args.provider ?? null,
    embeddingModel: args.embeddingModel ?? null,
  }
}

export function shouldAutoEmbedRagKnowledge(chunkCount: number): boolean {
  return RAG_AUTO_EMBED_CHUNK_LIMIT > 0 && chunkCount > 0 && chunkCount <= RAG_AUTO_EMBED_CHUNK_LIMIT
}

export function createSkippedRagEmbeddingSummary(chunkCount: number): RagEmbeddingSummary {
  return summarize({
    chunksProcessed: chunkCount,
    embeddingsCreated: 0,
    embeddingsSkipped: chunkCount,
    embeddingsFailed: 0,
    status: 'skipped',
    message: `Chunks ready. ${chunkCount.toLocaleString()} chunks were created. Embeddings will be created automatically after saving.`,
  })
}

export function createFailedRagEmbeddingSummary(error: unknown): RagEmbeddingSummary {
  const category = categorizeRagEmbeddingError(error)
  return summarize({
    chunksProcessed: 0,
    embeddingsCreated: 0,
    embeddingsSkipped: 0,
    embeddingsFailed: 0,
    status: 'failed',
    message: 'Knowledge saved, but embeddings could not be created. Check AI provider settings.',
    embeddingErrorCategory: category,
  })
}

export async function recordFailedRagEmbeddingSummary(args: {
  readonly workspaceId: string
  readonly sourceId: string
  readonly error: unknown
}): Promise<RagEmbeddingSummary> {
  const category = categorizeRagEmbeddingError(args.error)
  let chunksProcessed = 0
  let sourceMetadata: Record<string, unknown> | null | undefined
  let provider: RagProviderType | null = null
  let embeddingModel: string | null = null

  try {
    const [source, chunks, providerSettings] = await Promise.all([
      getEmbeddableSource(args.workspaceId, args.sourceId),
      getSourceChunks(args.workspaceId, args.sourceId),
      getProviderSettings(args.workspaceId),
    ])
    sourceMetadata = source?.metadata
    chunksProcessed = chunks.length
    provider = fallbackProvider(providerSettings?.provider)
    embeddingModel = fallbackEmbeddingModel(provider)
    const backend = providerSettings?.backend_config ?? {}
    if (typeof backend.embeddingModel === 'string' && backend.embeddingModel.trim()) {
      embeddingModel = backend.embeddingModel.trim()
    }
  } catch (countError) {
    console.warn('rag_embedding_failure_summary_count_failed', {
      category: categorizeRagEmbeddingError(countError),
      sourceId: args.sourceId,
      workspaceId: args.workspaceId,
    })
  }

  const summary = summarize({
    chunksProcessed,
    embeddingsCreated: 0,
    embeddingsSkipped: 0,
    embeddingsFailed: 0,
    status: 'failed',
    message: ragEmbeddingUserMessage(category),
    embeddingErrorCategory: category,
    provider,
    embeddingModel,
  })

  try {
    await updateSourceEmbeddingMetadata({
      workspaceId: args.workspaceId,
      sourceId: args.sourceId,
      existingMetadata: sourceMetadata,
      summary,
    })
  } catch (metadataError) {
    console.warn('rag_embedding_failure_summary_metadata_failed', {
      category: categorizeRagEmbeddingError(metadataError),
      sourceId: args.sourceId,
      workspaceId: args.workspaceId,
    })
  }

  return summary
}

export async function embedRagManualKnowledgeSource(args: {
  readonly workspaceId: string
  readonly sourceId: string
}): Promise<RagEmbeddingSummary> {
  const source = await getEmbeddableSource(args.workspaceId, args.sourceId)
  if (!source) throw new Error('Knowledge source not found.')

  const chunks = await getSourceChunks(args.workspaceId, args.sourceId)
  if (chunks.length === 0) {
    return summarize({
      chunksProcessed: 0,
      embeddingsCreated: 0,
      embeddingsSkipped: 0,
      embeddingsFailed: 0,
      status: 'failed',
      message: 'No readable knowledge chunks were found.',
      embeddingErrorCategory: 'unknown_embedding_error',
    })
  }

  const providerSettings = await getProviderSettings(args.workspaceId)
  const providerConfig = safeProviderConfig(providerSettings)
  const existing = await getExistingEmbeddings({
    workspaceId: args.workspaceId,
    chunkIds: chunks.map((chunk) => chunk.id),
    embeddingModel: providerConfig.embeddingModel,
  })

  let created = 0
  let skipped = 0
  let failed = 0

  if (!providerConfig.config) {
    const category = providerConfig.errorCategory ?? categorizeRagEmbeddingError(providerConfig.error)
    const readyChunkIds = new Set(
      chunks
        .filter((chunk) => existing.get(chunk.id)?.embedding_status === 'ready')
        .map((chunk) => chunk.id),
    )
  skipped = readyChunkIds.size
  const chunksNeedingEmbeddings = chunks.filter((chunk) => !readyChunkIds.has(chunk.id))
  const batchCount = Math.max(1, Math.ceil(chunksNeedingEmbeddings.length / RAG_EMBEDDING_BATCH_SIZE))
  const batch = selectAdaptiveEmbeddingBatch(chunksNeedingEmbeddings)
  const remainingAfterBatch = Math.max(0, chunksNeedingEmbeddings.length - batch.length)
  const batchTotalCharacters = chunkCharacters(batch)
  const totalSourceCharacters = sourceCharacterCount(source)
  const chunkStats = chunkCharacterStats(chunks)

    logEmbeddingFailure(category, 'provider_config', {
      workspaceId: args.workspaceId,
      sourceId: args.sourceId,
      sourceType: source.source_type ?? 'unknown',
      chunkState: sourceEmbeddingChunkState(source),
      totalSourceCharacters,
      ...chunkStats,
      embeddingLookupBatchSize: RAG_EMBEDDING_DB_ID_BATCH_SIZE,
      embeddingLookupBatches: Math.ceil(chunks.length / RAG_EMBEDDING_DB_ID_BATCH_SIZE),
      provider: providerConfig.provider,
      baseUrlHost: providerConfig.baseUrlHost,
      embeddingModel: providerConfig.embeddingModel,
      chunkCount: chunks.length,
      chunksToProcess: chunksNeedingEmbeddings.length,
      batchSize: RAG_EMBEDDING_BATCH_SIZE,
      batchChunkCount: batch.length,
      batchTotalCharacters,
      batchCount,
      currentBatch: 1,
      sanitizedError: providerConfig.error,
    })

    for (const chunk of batch) {
      await upsertEmbedding({
        workspaceId: args.workspaceId,
        chunkId: chunk.id,
        embeddingModel: providerConfig.embeddingModel,
        embedding: ZERO_EMBEDDING,
        status: 'failed',
        errorMessage: providerConfig.error,
      })
      failed += 1
    }

    const providerMessage = category === 'embedding_model_error' && providerConfig.error
      ? providerConfig.error
      : ragEmbeddingUserMessage(category)
    const summary = summarize({
      chunksProcessed: chunks.length,
      embeddingsCreated: created,
      embeddingsSkipped: skipped,
      embeddingsFailed: failed,
      totalChunks: chunks.length,
      readyChunks: skipped + created,
      processedThisBatch: created + failed,
      remainingChunks: Math.max(0, chunks.length - skipped - created),
      percentComplete: progressPercent(skipped + created, chunks.length),
      batchChunkCount: batch.length,
      batchTotalCharacters,
      totalSourceCharacters,
      status: 'not_configured',
      message: remainingAfterBatch > 0
        ? `${providerMessage} ${remainingAfterBatch.toLocaleString()} chunks were not processed in this batch.`
        : providerMessage,
      embeddingErrorCategory: category,
      provider: providerConfig.provider,
      embeddingModel: providerConfig.embeddingModel,
    })
    await updateSourceEmbeddingMetadata({
      workspaceId: args.workspaceId,
      sourceId: args.sourceId,
      existingMetadata: source.metadata,
      summary,
    })
    return summary
  }

  let firstFailureCategory: RagEmbeddingErrorCategory | null = null
  let lastEmbeddingDimension: number | null = null

  const readyChunkIds = new Set(
    chunks
      .filter((chunk) => existing.get(chunk.id)?.embedding_status === 'ready')
      .map((chunk) => chunk.id),
  )
  const terminalFailedChunkIds = new Set(
    chunks
      .filter((chunk) => isTerminalEmbeddingFailure(existing.get(chunk.id)))
      .map((chunk) => chunk.id),
  )
  skipped = readyChunkIds.size
  failed = terminalFailedChunkIds.size
  const retriableFailedRowsReset = await resetRetriableFailedEmbeddings({
    workspaceId: args.workspaceId,
    embeddingModel: providerConfig.config.embeddingModel,
    existing,
  })
  const chunksNeedingEmbeddings = chunks.filter((chunk) => !readyChunkIds.has(chunk.id) && !terminalFailedChunkIds.has(chunk.id))
  const batchCount = Math.max(1, Math.ceil(chunksNeedingEmbeddings.length / RAG_EMBEDDING_BATCH_SIZE))
  const batch = selectAdaptiveEmbeddingBatch(chunksNeedingEmbeddings)
  const remainingAfterBatch = Math.max(0, chunksNeedingEmbeddings.length - batch.length)
  const batchTotalCharacters = chunkCharacters(batch)
  const totalSourceCharacters = sourceCharacterCount(source)
  const chunkStats = chunkCharacterStats(chunks)

  if (chunksNeedingEmbeddings.length > 0) {
    await updateSourceEmbeddingMetadata({
      workspaceId: args.workspaceId,
      sourceId: args.sourceId,
      existingMetadata: source.metadata,
      summary: summarize({
        chunksProcessed: chunks.length,
        embeddingsCreated: 0,
        embeddingsSkipped: skipped,
        embeddingsFailed: failed,
        totalChunks: chunks.length,
        readyChunks: skipped,
        processedThisBatch: 0,
        remainingChunks: Math.max(0, chunks.length - skipped),
        percentComplete: progressPercent(skipped, chunks.length),
        batchChunkCount: 0,
        batchTotalCharacters: 0,
        totalSourceCharacters,
        status: 'partial',
        message: 'Getting your knowledge ready for the chatbot. We are preparing the saved content in safe batches.',
        embeddingErrorCategory: null,
        provider: providerConfig.config.provider,
        embeddingModel: providerConfig.config.embeddingModel,
      }),
    })
  }

  console.info('rag_embedding_run_started', {
    workspaceId: args.workspaceId,
    sourceId: args.sourceId,
    sourceType: source.source_type ?? 'unknown',
    chunkState: sourceEmbeddingChunkState(source),
    totalSourceCharacters,
    ...chunkStats,
    provider: providerConfig.config.provider,
    baseUrlHost: providerConfig.baseUrlHost,
    embeddingModel: providerConfig.config.embeddingModel,
    chunkCount: chunks.length,
    chunksToProcess: chunksNeedingEmbeddings.length,
    batchSize: RAG_EMBEDDING_BATCH_SIZE,
    batchChunkCount: batch.length,
    batchTotalCharacters,
    maxBatchCharacters: RAG_EMBEDDING_MAX_BATCH_CHARACTERS,
    embeddingLookupBatchSize: RAG_EMBEDDING_DB_ID_BATCH_SIZE,
    embeddingLookupBatches: Math.ceil(chunks.length / RAG_EMBEDDING_DB_ID_BATCH_SIZE),
    readyChunkCountBeforeRetry: readyChunkIds.size,
    retriableFailedRowsReset,
    terminalFailedChunks: terminalFailedChunkIds.size,
    batchCount,
    currentBatch: 1,
  })

  for (const chunk of batch) {
    try {
      if (chunk.chunk_text.length > RAG_EMBEDDING_MAX_CHUNK_CHARACTERS) {
        throw new Error(`A single chunk is too large for safe embedding (${chunk.chunk_text.length.toLocaleString()} characters).`)
      }
      const embedding = await generateRagEmbedding(chunk.chunk_text, providerConfig.config)
      lastEmbeddingDimension = embedding.length
      if (embedding.length !== RAG_EMBEDDING_DIMENSIONS) {
        throw new Error('Embedding provider returned the wrong dimensions.')
      }
      await upsertEmbedding({
        workspaceId: args.workspaceId,
        chunkId: chunk.id,
        embeddingModel: providerConfig.config.embeddingModel,
        embedding,
        status: 'ready',
        errorMessage: null,
      })
      created += 1
    } catch (error) {
      const category = categorizeRagEmbeddingError(error)
      firstFailureCategory ??= category
      logEmbeddingFailure(category, 'chunk_embedding', {
        workspaceId: args.workspaceId,
        sourceId: args.sourceId,
        chunkId: chunk.id,
        provider: providerConfig.config.provider,
        baseUrlHost: providerConfig.baseUrlHost,
        embeddingModel: providerConfig.config.embeddingModel,
        chunkCount: chunks.length,
        batchSize: RAG_EMBEDDING_BATCH_SIZE,
        batchChunkCount: batch.length,
        batchTotalCharacters,
        chunkCharacters: chunk.chunk_text.length,
        currentBatch: 1,
        embeddingDimensionReceived: lastEmbeddingDimension,
        sanitizedError: safeLogMessage(error),
      })
      await upsertEmbedding({
        workspaceId: args.workspaceId,
        chunkId: chunk.id,
        embeddingModel: providerConfig.config.embeddingModel,
        embedding: ZERO_EMBEDDING,
        status: 'failed',
        errorMessage: sanitizeProviderError(error),
      })
      failed += 1
    }
  }

  const readyAfterBatch = skipped + created
  const remainingChunks = Math.max(0, chunks.length - readyAfterBatch)
  const failedThisBatch = Math.max(0, failed - terminalFailedChunkIds.size)
  const status: EmbeddingRunStatus =
    failed === 0 && remainingChunks === 0
      ? 'ready'
      : remainingAfterBatch > 0 && (created > 0 || skipped > 0 || failed > 0)
        ? 'partial'
        : failed > 0
          ? 'failed'
          : 'partial'

  const summary = summarize({
    chunksProcessed: chunks.length,
    embeddingsCreated: created,
    embeddingsSkipped: skipped,
    embeddingsFailed: failed,
    totalChunks: chunks.length,
    readyChunks: readyAfterBatch,
    processedThisBatch: created + failedThisBatch,
    remainingChunks,
    percentComplete: progressPercent(readyAfterBatch, chunks.length),
    batchChunkCount: batch.length,
    batchTotalCharacters,
    totalSourceCharacters,
    status,
    message: status === 'ready'
      ? 'Embeddings ready. Knowledge is ready for chatbot answers.'
      : status === 'partial' && remainingAfterBatch > 0
        ? `Prepared ${created.toLocaleString()} embeddings in this batch. ${remainingChunks.toLocaleString()} chunks remain.`
      : ragEmbeddingUserMessage(firstFailureCategory),
    embeddingErrorCategory: status === 'ready' ? null : firstFailureCategory,
    provider: providerConfig.config.provider,
    embeddingModel: providerConfig.config.embeddingModel,
  })
  console.info('rag_embedding_run_completed', {
    workspaceId: args.workspaceId,
    sourceId: args.sourceId,
    sourceType: source.source_type ?? 'unknown',
    chunkState: sourceEmbeddingChunkState(source),
    totalSourceCharacters,
    ...chunkStats,
    provider: providerConfig.config.provider,
    baseUrlHost: providerConfig.baseUrlHost,
    embeddingModel: providerConfig.config.embeddingModel,
    chunkCount: chunks.length,
    batchSize: RAG_EMBEDDING_BATCH_SIZE,
    batchChunkCount: batch.length,
    batchTotalCharacters,
    maxBatchCharacters: RAG_EMBEDDING_MAX_BATCH_CHARACTERS,
    embeddingLookupBatchSize: RAG_EMBEDDING_DB_ID_BATCH_SIZE,
    embeddingLookupBatches: Math.ceil(chunks.length / RAG_EMBEDDING_DB_ID_BATCH_SIZE),
    totalBatches: batchCount,
    currentBatch: 1,
    embeddingsReturned: created,
    rowsUpserted: created + failedThisBatch,
    embeddingsCreated: created,
    embeddingsSkipped: skipped,
    embeddingsFailed: failed,
    readyChunkCountBeforeRetry: readyChunkIds.size,
    readyChunkCountAfterRetry: readyAfterBatch,
    retriableFailedRowsReset,
    terminalFailedChunks: terminalFailedChunkIds.size,
    embeddingDimensionReceived: lastEmbeddingDimension,
    remainingAfterBatch,
    remainingChunks,
    percentComplete: summary.percentComplete,
    status,
    sanitizedFailureReason: firstFailureCategory ? ragEmbeddingUserMessage(firstFailureCategory) : null,
  })
  await updateSourceEmbeddingMetadata({
    workspaceId: args.workspaceId,
    sourceId: args.sourceId,
    existingMetadata: source.metadata,
    summary,
  })
  return summary
}
