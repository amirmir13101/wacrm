import { createHash } from 'node:crypto'

import { supabaseAdmin } from '@/lib/automations/admin-client'
import {
  prepareRagKnowledgeSource,
  RAG_KNOWLEDGE_CHARACTER_LIMIT,
} from './knowledge'

export interface RagKnowledgeListItem {
  readonly id: string
  readonly title: string
  readonly sourceType: 'manual'
  readonly status: 'draft' | 'active' | 'archived' | 'failed'
  readonly createdAt: string
  readonly updatedAt: string
  readonly characterCount: number
  readonly chunkCount: number
  readonly readyEmbeddingCount: number
  readonly failedEmbeddingCount: number
  readonly embeddingStatus: 'not_embedded' | 'ready' | 'failed' | 'partial'
}

export interface RagKnowledgeDetail extends RagKnowledgeListItem {
  readonly content: string
}

interface RagKnowledgeSourceRow {
  readonly id: string
  readonly title: string
  readonly source_type: string
  readonly status: string
  readonly cleaned_content: string
  readonly created_at: string
  readonly updated_at: string
  readonly metadata?: Record<string, unknown> | null
}

interface RagKnowledgeChunkCountRow {
  readonly source_id: string
}

interface RagKnowledgeEmbeddingCountRow {
  readonly embedding_status: string
  readonly rag_knowledge_chunks:
    | {
        readonly source_id: string
      }
    | ReadonlyArray<{
        readonly source_id: string
      }>
    | null
}

export function safeRagKnowledgeTitle(title: string): string {
  return title.replace(/[\u0000-\u001F\u007F]/g, '').trim()
}

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function normalizeStatus(status: string): RagKnowledgeListItem['status'] {
  if (status === 'draft' || status === 'active' || status === 'archived' || status === 'failed') {
    return status
  }
  return 'active'
}

function toListItem(
  row: RagKnowledgeSourceRow,
  chunkCounts: ReadonlyMap<string, number>,
  embeddingCounts: ReadonlyMap<string, { readonly ready: number; readonly failed: number }>,
): RagKnowledgeListItem {
  const metadataCount =
    typeof row.metadata?.character_count === 'number'
      ? row.metadata.character_count
      : row.cleaned_content.length
  const chunkCount = chunkCounts.get(row.id) ?? 0
  const sourceEmbeddings = embeddingCounts.get(row.id) ?? { ready: 0, failed: 0 }
  const embeddedCount = sourceEmbeddings.ready + sourceEmbeddings.failed
  const embeddingStatus =
    chunkCount === 0 || embeddedCount === 0
      ? 'not_embedded'
      : sourceEmbeddings.ready === chunkCount
        ? 'ready'
        : sourceEmbeddings.ready === 0 && sourceEmbeddings.failed > 0
          ? 'failed'
          : 'partial'

  return {
    id: row.id,
    title: row.title,
    sourceType: 'manual',
    status: normalizeStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    characterCount: metadataCount,
    chunkCount,
    readyEmbeddingCount: sourceEmbeddings.ready,
    failedEmbeddingCount: sourceEmbeddings.failed,
    embeddingStatus,
  }
}

async function chunkCountsBySource(
  workspaceId: string,
  sourceIds: ReadonlyArray<string>,
): Promise<Map<string, number>> {
  if (sourceIds.length === 0) return new Map()

  const { data, error } = await supabaseAdmin()
    .from('rag_knowledge_chunks')
    .select('source_id')
    .eq('workspace_id', workspaceId)
    .in('source_id', [...sourceIds])
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as RagKnowledgeChunkCountRow[]) {
    counts.set(row.source_id, (counts.get(row.source_id) ?? 0) + 1)
  }
  return counts
}

async function embeddingCountsBySource(
  workspaceId: string,
  sourceIds: ReadonlyArray<string>,
): Promise<Map<string, { ready: number; failed: number }>> {
  if (sourceIds.length === 0) return new Map()

  const { data, error } = await supabaseAdmin()
    .from('rag_embeddings')
    .select('embedding_status, rag_knowledge_chunks!inner(source_id)')
    .eq('workspace_id', workspaceId)
    .in('rag_knowledge_chunks.source_id', [...sourceIds])
    .is('rag_knowledge_chunks.deleted_at', null)

  if (error) throw new Error(error.message)

  const counts = new Map<string, { ready: number; failed: number }>()
  for (const row of (data ?? []) as unknown as RagKnowledgeEmbeddingCountRow[]) {
    const joinedChunk = Array.isArray(row.rag_knowledge_chunks)
      ? row.rag_knowledge_chunks[0]
      : row.rag_knowledge_chunks
    const sourceId = joinedChunk?.source_id
    if (!sourceId) continue
    const current = counts.get(sourceId) ?? { ready: 0, failed: 0 }
    counts.set(sourceId, {
      ready: current.ready + (row.embedding_status === 'ready' ? 1 : 0),
      failed: current.failed + (row.embedding_status === 'failed' ? 1 : 0),
    })
  }
  return counts
}

export async function listRagKnowledgeSources(
  workspaceId: string,
): Promise<ReadonlyArray<RagKnowledgeListItem>> {
  const { data, error } = await supabaseAdmin()
    .from('rag_knowledge_sources')
    .select('id, title, source_type, status, cleaned_content, created_at, updated_at, metadata')
    .eq('workspace_id', workspaceId)
    .eq('source_type', 'manual')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as RagKnowledgeSourceRow[]
  const sourceIds = rows.map((row) => row.id)
  const [chunkCounts, embeddingCounts] = await Promise.all([
    chunkCountsBySource(workspaceId, sourceIds),
    embeddingCountsBySource(workspaceId, sourceIds),
  ])
  return rows.map((row) => toListItem(row, chunkCounts, embeddingCounts))
}

export async function getRagKnowledgeSource(args: {
  readonly workspaceId: string
  readonly sourceId: string
}): Promise<RagKnowledgeDetail | null> {
  const { data, error } = await supabaseAdmin()
    .from('rag_knowledge_sources')
    .select('id, title, source_type, status, cleaned_content, created_at, updated_at, metadata')
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.sourceId)
    .eq('source_type', 'manual')
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as RagKnowledgeSourceRow
  const [chunkCounts, embeddingCounts] = await Promise.all([
    chunkCountsBySource(args.workspaceId, [row.id]),
    embeddingCountsBySource(args.workspaceId, [row.id]),
  ])
  return {
    ...toListItem(row, chunkCounts, embeddingCounts),
    content: row.cleaned_content,
  }
}

export async function createRagManualKnowledge(args: {
  readonly workspaceId: string
  readonly userId: string
  readonly title: string
  readonly content: string
}): Promise<RagKnowledgeDetail> {
  const title = safeRagKnowledgeTitle(args.title)
  const prepared = prepareRagKnowledgeSource({
    workspaceId: args.workspaceId,
    title,
    content: args.content,
    sourceType: 'manual',
  })

  const { data: source, error: sourceError } = await supabaseAdmin()
    .from('rag_knowledge_sources')
    .insert({
      workspace_id: args.workspaceId,
      title: prepared.source.title,
      source_type: 'manual',
      status: 'active',
      raw_content: prepared.source.rawContent,
      cleaned_content: prepared.source.cleanedContent,
      created_by: args.userId,
      metadata: {
        character_count: prepared.source.cleanedContent.length,
        source: 'manual_dashboard',
        version: 1,
        embedding_status: 'not_embedded',
      },
    })
    .select('id')
    .single()

  if (sourceError) throw new Error(sourceError.message)
  await replaceRagKnowledgeChunks(args.workspaceId, source.id as string, prepared.chunks)

  const detail = await getRagKnowledgeSource({
    workspaceId: args.workspaceId,
    sourceId: source.id as string,
  })
  if (!detail) throw new Error('Knowledge source was not created.')
  return detail
}

export async function updateRagManualKnowledge(args: {
  readonly workspaceId: string
  readonly sourceId: string
  readonly title: string
  readonly content: string
  readonly status?: 'active' | 'archived'
}): Promise<RagKnowledgeDetail> {
  const existing = await getRagKnowledgeSource({
    workspaceId: args.workspaceId,
    sourceId: args.sourceId,
  })
  if (!existing) throw new Error('Knowledge source not found.')

  const title = safeRagKnowledgeTitle(args.title)
  const prepared = prepareRagKnowledgeSource({
    workspaceId: args.workspaceId,
    title,
    content: args.content,
    sourceType: 'manual',
  })

  const { error } = await supabaseAdmin()
    .from('rag_knowledge_sources')
    .update({
      title: prepared.source.title,
      raw_content: prepared.source.rawContent,
      cleaned_content: prepared.source.cleanedContent,
      status: args.status ?? 'active',
      metadata: {
        character_count: prepared.source.cleanedContent.length,
        source: 'manual_dashboard',
        version: 1,
        embedding_status: 'not_embedded',
        updated_via: 'manual_dashboard',
      },
    })
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.sourceId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
  await replaceRagKnowledgeChunks(args.workspaceId, args.sourceId, prepared.chunks)

  const detail = await getRagKnowledgeSource({
    workspaceId: args.workspaceId,
    sourceId: args.sourceId,
  })
  if (!detail) throw new Error('Knowledge source was not updated.')
  return detail
}

export async function archiveRagKnowledgeSource(args: {
  readonly workspaceId: string
  readonly sourceId: string
}): Promise<void> {
  const now = new Date().toISOString()
  const admin = supabaseAdmin()
  const { error: sourceError } = await admin
    .from('rag_knowledge_sources')
    .update({ status: 'archived', deleted_at: now })
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.sourceId)
    .is('deleted_at', null)

  if (sourceError) throw new Error(sourceError.message)

  const { error: chunkError } = await admin
    .from('rag_knowledge_chunks')
    .update({ deleted_at: now })
    .eq('workspace_id', args.workspaceId)
    .eq('source_id', args.sourceId)
    .is('deleted_at', null)

  if (chunkError) throw new Error(chunkError.message)
}

async function replaceRagKnowledgeChunks(
  workspaceId: string,
  sourceId: string,
  chunks: ReturnType<typeof prepareRagKnowledgeSource>['chunks'],
): Promise<void> {
  const admin = supabaseAdmin()
  const { error: deleteError } = await admin
    .from('rag_knowledge_chunks')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('source_id', sourceId)

  if (deleteError) throw new Error(deleteError.message)

  if (chunks.length === 0) return

  const { error: insertError } = await admin.from('rag_knowledge_chunks').insert(
    chunks.map((chunk) => ({
      workspace_id: workspaceId,
      source_id: sourceId,
      chunk_index: chunk.index,
      chunk_text: chunk.content,
      content_hash: contentHash(chunk.content),
      source_url: null,
      metadata: {
        ...(chunk.metadata ?? {}),
        embedding_status: 'not_embedded',
        character_limit: RAG_KNOWLEDGE_CHARACTER_LIMIT,
      },
    })),
  )

  if (insertError) throw new Error(insertError.message)
}
