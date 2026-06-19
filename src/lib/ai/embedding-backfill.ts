import type { SupabaseClient } from '@supabase/supabase-js'

import { generateEmbedding, resolveEmbeddingConfig } from '@/lib/ai/embeddings'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export interface EmbeddingBackfillResult {
  readonly ok: boolean
  readonly message: string
  readonly workspaceId: string
  readonly batchSize: number
  readonly processed: number
  readonly updated: number
  readonly failed: number
  readonly remaining: number
}

interface BackfillChunkRow {
  readonly id: string
  readonly workspace_id: string
  readonly chunk_text: string
  readonly content_hash: string | null
}

export async function backfillWorkspaceEmbeddings(args: {
  readonly workspaceId: string
  readonly batchSize?: number
  readonly client?: SupabaseClient
}): Promise<EmbeddingBackfillResult> {
  const client = args.client ?? supabaseAdmin()
  const batchSize = Math.max(1, Math.min(25, Math.floor(args.batchSize ?? 10)))
  const config = await resolveEmbeddingConfig(args.workspaceId)
  if (!config.supported || !config.apiKey) {
    return {
      ok: false,
      message: config.reason ?? 'Embedding API key is not configured.',
      workspaceId: args.workspaceId,
      batchSize,
      processed: 0,
      updated: 0,
      failed: 0,
      remaining: await countPending(client, args.workspaceId),
    }
  }

  const { data, error } = await client
    .from('ai_knowledge_chunks')
    .select('id, workspace_id, chunk_text, content_hash')
    .eq('workspace_id', args.workspaceId)
    .eq('embedding_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (error) throw new Error(error.message)
  const chunks = (data ?? []) as BackfillChunkRow[]
  let updated = 0
  let failed = 0

  for (const chunk of chunks) {
    try {
      const result = await generateEmbedding(chunk.chunk_text, config)
      if (!result) throw new Error(config.reason ?? 'Embedding API key is not configured.')
      const { error: updateError } = await client
        .from('ai_knowledge_chunks')
        .update({
          embedding: `[${result.embedding.join(',')}]`,
          embedding_model: result.model,
          embedding_status: 'ready',
          embedded_at: new Date().toISOString(),
        })
        .eq('id', chunk.id)
        .eq('workspace_id', args.workspaceId)
      if (updateError) throw new Error(updateError.message)
      updated += 1
    } catch {
      failed += 1
      await client
        .from('ai_knowledge_chunks')
        .update({
          embedding_status: 'failed',
          embedded_at: null,
        })
        .eq('id', chunk.id)
        .eq('workspace_id', args.workspaceId)
    }
  }

  return {
    ok: true,
    message: chunks.length === 0 ? 'No pending chunks need embedding backfill.' : 'Embedding backfill batch completed.',
    workspaceId: args.workspaceId,
    batchSize,
    processed: chunks.length,
    updated,
    failed,
    remaining: await countPending(client, args.workspaceId),
  }
}

export function embedNewChunks(workspaceId: string, chunkIds: readonly string[], client?: SupabaseClient): void {
  const uniqueChunkIds = [...new Set(chunkIds.filter(Boolean))].slice(0, 50)
  if (uniqueChunkIds.length === 0) return
  void embedChunkIds({ workspaceId, chunkIds: uniqueChunkIds, client: client ?? supabaseAdmin() })
    .then((result) => {
      if (result.processed > 0) {
        console.info('[ai-embeddings] new chunk embedding completed', {
          workspaceId,
          processed: result.processed,
          updated: result.updated,
          failed: result.failed,
        })
      }
    })
    .catch((error) => {
      console.warn('[ai-embeddings] new chunk embedding skipped', {
        workspaceId,
        error: error instanceof Error ? error.message : 'unknown_error',
      })
    })
}

export async function embedChunkIds(args: {
  readonly workspaceId: string
  readonly chunkIds: readonly string[]
  readonly client?: SupabaseClient
}): Promise<{ readonly processed: number; readonly updated: number; readonly failed: number }> {
  const client = args.client ?? supabaseAdmin()
  const config = await resolveEmbeddingConfig(args.workspaceId)
  if (!config.supported || !config.apiKey || args.chunkIds.length === 0) {
    return { processed: 0, updated: 0, failed: 0 }
  }

  const { data, error } = await client
    .from('ai_knowledge_chunks')
    .select('id, workspace_id, chunk_text, content_hash')
    .eq('workspace_id', args.workspaceId)
    .in('id', args.chunkIds)

  if (error) throw new Error(error.message)
  const chunks = (data ?? []) as BackfillChunkRow[]
  let updated = 0
  let failed = 0

  for (const chunk of chunks) {
    try {
      const result = await generateEmbedding(chunk.chunk_text, config)
      if (!result) throw new Error(config.reason ?? 'Embedding API key is not configured.')
      const { error: updateError } = await client
        .from('ai_knowledge_chunks')
        .update({
          embedding: `[${result.embedding.join(',')}]`,
          embedding_model: result.model,
          embedding_status: 'ready',
          embedded_at: new Date().toISOString(),
        })
        .eq('id', chunk.id)
        .eq('workspace_id', args.workspaceId)
      if (updateError) throw new Error(updateError.message)
      updated += 1
    } catch {
      failed += 1
      await client
        .from('ai_knowledge_chunks')
        .update({
          embedding_status: 'failed',
          embedded_at: null,
        })
        .eq('id', chunk.id)
        .eq('workspace_id', args.workspaceId)
    }
  }

  return { processed: chunks.length, updated, failed }
}

async function countPending(client: SupabaseClient, workspaceId: string): Promise<number> {
  const { count, error } = await client
    .from('ai_knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('embedding_status', 'pending')
  if (error) throw new Error(error.message)
  return count ?? 0
}
