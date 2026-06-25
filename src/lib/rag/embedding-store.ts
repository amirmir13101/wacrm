import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { generateRagEmbedding } from './embeddings'
import { DEFAULT_RAG_PROVIDER_CONFIG, resolveRagProviderConfig } from './provider'
import { sanitizeProviderError } from './security'
import { isRagProviderType } from './settings'
import type { RagProviderType, RagResolvedProviderConfig } from './types'

const RAG_EMBEDDING_DIMENSIONS = 1536
const ZERO_EMBEDDING = Array.from({ length: RAG_EMBEDDING_DIMENSIONS }, () => 0)

type EmbeddingRunStatus = 'ready' | 'partial' | 'failed' | 'not_configured'

interface RagProviderSettingsRow {
  readonly provider: string | null
  readonly encrypted_api_key: string | null
  readonly enabled: boolean | null
}

interface RagKnowledgeSourceRow {
  readonly id: string
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
}

export interface RagEmbeddingSummary {
  readonly chunksProcessed: number
  readonly embeddingsCreated: number
  readonly embeddingsSkipped: number
  readonly embeddingsFailed: number
  readonly status: EmbeddingRunStatus
  readonly message: string
}

function fallbackProvider(provider: string | null | undefined): RagProviderType {
  return isRagProviderType(provider ?? '') ? provider as RagProviderType : 'openai'
}

function fallbackEmbeddingModel(provider: RagProviderType): string {
  return DEFAULT_RAG_PROVIDER_CONFIG[provider].embeddingModel
}

function safeProviderConfig(row: RagProviderSettingsRow | null): {
  readonly config: RagResolvedProviderConfig | null
  readonly provider: RagProviderType
  readonly embeddingModel: string
  readonly error: string | null
} {
  const provider = fallbackProvider(row?.provider)
  const embeddingModel = fallbackEmbeddingModel(provider)

  if (!row?.encrypted_api_key || row.enabled !== true) {
    return {
      config: null,
      provider,
      embeddingModel,
      error: 'Embedding API key is not configured.',
    }
  }

  try {
    const apiKey = decrypt(row.encrypted_api_key)
    const config = resolveRagProviderConfig({ provider, apiKey })
    if (config.embeddingDimensions !== RAG_EMBEDDING_DIMENSIONS) {
      return {
        config: null,
        provider,
        embeddingModel: config.embeddingModel,
        error: 'Embedding provider must return 1536 dimensions.',
      }
    }
    return {
      config,
      provider,
      embeddingModel: config.embeddingModel,
      error: null,
    }
  } catch (error) {
    return {
      config: null,
      provider,
      embeddingModel,
      error: sanitizeProviderError(error),
    }
  }
}

async function getEmbeddableSource(
  workspaceId: string,
  sourceId: string,
): Promise<RagKnowledgeSourceRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('rag_knowledge_sources')
    .select('id, metadata')
    .eq('workspace_id', workspaceId)
    .eq('id', sourceId)
    .in('source_type', ['manual', 'website'])
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as RagKnowledgeSourceRow | null
}

async function getProviderSettings(workspaceId: string): Promise<RagProviderSettingsRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('rag_provider_settings')
    .select('provider, encrypted_api_key, enabled')
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

  const { data, error } = await supabaseAdmin()
    .from('rag_embeddings')
    .select('chunk_id, embedding_status')
    .eq('workspace_id', args.workspaceId)
    .eq('embedding_model', args.embeddingModel)
    .in('chunk_id', [...args.chunkIds])

  if (error) throw new Error(error.message)

  const rows = new Map<string, RagEmbeddingRow>()
  for (const row of (data ?? []) as RagEmbeddingRow[]) {
    rows.set(row.chunk_id, row)
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
  readonly status: EmbeddingRunStatus
  readonly message?: string
}): RagEmbeddingSummary {
  return {
    chunksProcessed: args.chunksProcessed,
    embeddingsCreated: args.embeddingsCreated,
    embeddingsSkipped: args.embeddingsSkipped,
    embeddingsFailed: args.embeddingsFailed,
    status: args.status,
    message: args.message ?? (
      args.status === 'ready'
        ? 'Knowledge is prepared for chatbot.'
        : args.status === 'partial'
          ? 'Some knowledge was prepared, but a few chunks failed.'
          : 'Knowledge could not be prepared yet.'
    ),
  }
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
    for (const chunk of chunks) {
      const current = existing.get(chunk.id)
      if (current?.embedding_status === 'ready') {
        skipped += 1
        continue
      }

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

    const summary = summarize({
      chunksProcessed: chunks.length,
      embeddingsCreated: created,
      embeddingsSkipped: skipped,
      embeddingsFailed: failed,
      status: 'not_configured',
      message: providerConfig.error ?? 'Embedding provider is not configured.',
    })
    await updateSourceEmbeddingMetadata({
      workspaceId: args.workspaceId,
      sourceId: args.sourceId,
      existingMetadata: source.metadata,
      summary,
    })
    return summary
  }

  for (const chunk of chunks) {
    const current = existing.get(chunk.id)
    if (current?.embedding_status === 'ready') {
      skipped += 1
      continue
    }

    try {
      const embedding = await generateRagEmbedding(chunk.chunk_text, providerConfig.config)
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

  const status: EmbeddingRunStatus =
    failed === 0
      ? 'ready'
      : created > 0 || skipped > 0
        ? 'partial'
        : 'failed'

  const summary = summarize({
    chunksProcessed: chunks.length,
    embeddingsCreated: created,
    embeddingsSkipped: skipped,
    embeddingsFailed: failed,
    status,
  })
  await updateSourceEmbeddingMetadata({
    workspaceId: args.workspaceId,
    sourceId: args.sourceId,
    existingMetadata: source.metadata,
    summary,
  })
  return summary
}
