import type { SupabaseClient } from '@supabase/supabase-js'

import type { AiKnowledgeSourceType } from '@/lib/ai/chatbot'
import { semanticChunkText, type SemanticChunk } from '@/lib/ai/chunking'
import { embedNewChunks } from '@/lib/ai/embedding-backfill'
import { buildChunkSearchMetadata } from '@/lib/ai/retrieval'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export { chunkTextByCharacter, semanticChunkText } from '@/lib/ai/chunking'
export type { SemanticChunk, SemanticChunkOptions } from '@/lib/ai/chunking'

export async function findWebsiteKnowledgeSourceForUrl(args: {
  readonly workspaceId: string
  readonly url: string
  readonly client?: SupabaseClient
}): Promise<string | null> {
  const admin = args.client ?? supabaseAdmin()
  const target = new URL(args.url)
  const { data, error } = await admin
    .from('ai_knowledge_sources')
    .select('id, content')
    .eq('workspace_id', args.workspaceId)
    .eq('source_type', 'website')
    .eq('status', 'active')
  if (error) throw new Error(error.message)
  for (const source of data ?? []) {
    const urls = [...source.content.matchAll(/https?:\/\/[^\s)\]>"']+/gi)].map((match) => match[0])
    if (urls.some((value) => {
      try {
        const candidate = new URL(value)
        return candidate.hostname.replace(/^www\./, '') === target.hostname.replace(/^www\./, '')
      } catch {
        return false
      }
    })) return source.id
  }
  return null
}

export async function saveKnowledgeSourceWithChunks(args: {
  readonly workspaceId: string
  readonly sourceType: AiKnowledgeSourceType
  readonly title: string
  readonly content: string
}) {
  const admin = supabaseAdmin()
  const { data: source, error: sourceError } = await admin
    .from('ai_knowledge_sources')
    .insert({
      workspace_id: args.workspaceId,
      source_type: args.sourceType,
      title: args.title,
      content: args.content,
      status: 'active',
    })
    .select('*')
    .single()

  if (sourceError || !source) {
    throw new Error(sourceError?.message ?? 'Failed to save knowledge.')
  }

  const chunks = semanticChunkText(args.content)
  if (chunks.length > 0) {
    const { data: insertedChunks, error: chunksError } = await admin.from('ai_knowledge_chunks').insert(
      chunks.map((chunk, index) => ({
        ...chunkSearchRow(chunk, index, args.title),
        workspace_id: args.workspaceId,
        source_id: source.id,
        chunk_text: chunk.text,
      })),
    ).select('id')
    if (chunksError) throw new Error(chunksError.message)
    embedNewChunks(args.workspaceId, (insertedChunks ?? []).map((chunk) => chunk.id), admin)
  }

  return source
}

export async function replaceKnowledgeSourceWithChunks(args: {
  readonly workspaceId: string
  readonly sourceId: string
  readonly title: string
  readonly content: string
  readonly client?: SupabaseClient
}) {
  const admin = args.client ?? supabaseAdmin()
  const { data: source, error: sourceError } = await admin
    .from('ai_knowledge_sources')
    .update({ title: args.title, content: args.content, status: 'active' })
    .eq('id', args.sourceId)
    .eq('workspace_id', args.workspaceId)
    .select('*')
    .maybeSingle()
  if (sourceError || !source) throw new Error(sourceError?.message ?? 'Knowledge source not found.')

  const chunks = semanticChunkText(args.content)
  const { data: oldChunks, error: oldError } = await admin
    .from('ai_knowledge_chunks')
    .select('id')
    .eq('source_id', args.sourceId)
    .eq('workspace_id', args.workspaceId)
  if (oldError) throw new Error(oldError.message)
  const oldIds = (oldChunks ?? []).map((chunk) => chunk.id)
  const { data: inserted, error: insertError } = await admin
    .from('ai_knowledge_chunks')
    .insert(buildKnowledgeChunkRows({
      chunks,
      workspaceId: args.workspaceId,
      sourceId: args.sourceId,
      title: args.title,
      sourceType: 'website',
    }))
    .select('id')
  if (insertError) throw new Error(insertError.message)
  if (oldIds.length > 0) {
    const { error: deleteError } = await admin
      .from('ai_knowledge_chunks')
      .delete()
      .eq('workspace_id', args.workspaceId)
      .eq('source_id', args.sourceId)
      .in('id', oldIds)
    if (deleteError) throw new Error(deleteError.message)
  }
  const ids = (inserted ?? []).map((chunk) => chunk.id)
  embedNewChunks(args.workspaceId, ids, admin)
  return source
}

export async function rechunkKnowledgeSource(args: {
  readonly workspaceId: string
  readonly sourceId: string
  readonly client?: SupabaseClient
}): Promise<{ readonly oldChunkCount: number; readonly newChunkCount: number; readonly chunkIds: readonly string[] }> {
  const admin = args.client ?? supabaseAdmin()
  const { data: source, error: sourceError } = await admin
    .from('ai_knowledge_sources')
    .select('id, title, content')
    .eq('id', args.sourceId)
    .eq('workspace_id', args.workspaceId)
    .maybeSingle()
  if (sourceError) throw new Error(sourceError.message)
  if (!source) throw new Error('Knowledge source not found.')

  const { data: oldChunks, error: countError } = await admin
    .from('ai_knowledge_chunks')
    .select('id')
    .eq('source_id', args.sourceId)
    .eq('workspace_id', args.workspaceId)
  if (countError) throw new Error(countError.message)
  const oldChunkIds = (oldChunks ?? []).map((chunk) => chunk.id)

  const chunks = semanticChunkText(source.content)
  if (chunks.length === 0) {
    return { oldChunkCount: oldChunkIds.length, newChunkCount: 0, chunkIds: [] }
  }

  const { data: inserted, error: insertError } = await admin
    .from('ai_knowledge_chunks')
    .insert(chunks.map((chunk, index) => ({
      ...chunkSearchRow(chunk, index, source.title),
      workspace_id: args.workspaceId,
      source_id: args.sourceId,
      chunk_text: chunk.text,
    })))
    .select('id')
  if (insertError) throw new Error(insertError.message)
  const chunkIds = (inserted ?? []).map((chunk) => chunk.id)
  if (oldChunkIds.length > 0) {
    const { error: deleteError } = await admin
      .from('ai_knowledge_chunks')
      .delete()
      .eq('source_id', args.sourceId)
      .eq('workspace_id', args.workspaceId)
      .in('id', oldChunkIds)
    if (deleteError) throw new Error(deleteError.message)
  }
  embedNewChunks(args.workspaceId, chunkIds, admin)
  return { oldChunkCount: oldChunkIds.length, newChunkCount: chunks.length, chunkIds }
}

export function buildKnowledgeChunkRows(args: {
  readonly chunks: readonly SemanticChunk[]
  readonly workspaceId: string
  readonly sourceId: string
  readonly title: string
  readonly sourceType?: AiKnowledgeSourceType
}): ReadonlyArray<Record<string, unknown>> {
  return args.chunks.map((chunk, index) => ({
    ...chunkSearchRow(chunk, index, args.title, args.sourceType),
    workspace_id: args.workspaceId,
    source_id: args.sourceId,
    chunk_text: chunk.text,
  }))
}

function chunkSearchRow(chunk: SemanticChunk, index: number, title: string, sourceType?: AiKnowledgeSourceType) {
  const metadata = buildChunkSearchMetadata(chunk.text, index)
  const headingPath = chunk.headingPath.length > 0 ? chunk.headingPath.join(' > ') : title
  return {
    search_text: chunk.text,
    content_hash: metadata.content_hash,
    token_count: metadata.token_count,
    source_url: metadata.source_url,
    heading_path: headingPath,
    chunk_index: index,
    structured_facts: metadata.structured_facts,
    embedding_status: 'pending',
    metadata: { title, source_type: sourceType, index, heading_path: headingPath, ...metadata },
  }
}
