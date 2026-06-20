import type { SupabaseClient } from '@supabase/supabase-js'

import type { AiKnowledgeSourceType } from '@/lib/ai/chatbot'
import { semanticChunkText, type SemanticChunk } from '@/lib/ai/chunking'
import { embedNewChunks } from '@/lib/ai/embedding-backfill'
import { buildChunkSearchMetadata } from '@/lib/ai/retrieval'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export { chunkTextByCharacter, semanticChunkText } from '@/lib/ai/chunking'
export type { SemanticChunk, SemanticChunkOptions } from '@/lib/ai/chunking'

export interface StructuredOfferPopulationCounts {
  readonly totalActiveChunks: number
  readonly chunksWithPricingOffers: number
  readonly chunksWithPrices: number
  readonly chunksWithPercentages: number
}

export interface StructuredOfferBackfillResult {
  readonly before: StructuredOfferPopulationCounts
  readonly after: StructuredOfferPopulationCounts
  readonly processed: number
  readonly updated: number
  readonly skipped: number
  readonly failed: number
}

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

export async function backfillStructuredPricingOffers(args: {
  readonly workspaceId: string
  readonly batchSize?: number
  readonly client?: SupabaseClient
}): Promise<StructuredOfferBackfillResult> {
  const admin = args.client ?? supabaseAdmin()
  const batchSize = Math.max(1, Math.min(25, Math.floor(args.batchSize ?? 10)))
  const before = await countStructuredOfferPopulation({ workspaceId: args.workspaceId, client: admin })
  const { data, error } = await admin
    .from('ai_knowledge_chunks')
    .select('id, chunk_text, structured_facts, source:ai_knowledge_sources!inner(status)')
    .eq('workspace_id', args.workspaceId)
    .eq('source.status', 'active')
  if (error) throw new Error(error.message)

  const candidates = (data ?? [])
    .filter((row) =>
      typeof row.id === 'string' &&
      typeof row.chunk_text === 'string' &&
      hasPricingSignalForStructuredOffer(row.chunk_text) &&
      !hasPersistedPricingOffers(row.structured_facts) &&
      !hasStructuredOfferBackfillChecked(row.structured_facts),
    )
    .slice(0, batchSize)

  let updated = 0
  let failed = 0
  let skipped = 0

  for (const row of candidates) {
    if (typeof row.id !== 'string' || typeof row.chunk_text !== 'string' || !row.chunk_text.trim()) {
      skipped += 1
      continue
    }
    const metadata = buildChunkSearchMetadata(row.chunk_text, 0)
    const structuredFacts = {
      ...(isRecord(metadata.structured_facts) ? metadata.structured_facts : {}),
      pricing_offer_backfill_checked: true,
    }
    if (!hasPersistedPricingOffers(structuredFacts)) {
      const { error: skippedUpdateError } = await admin
        .from('ai_knowledge_chunks')
        .update({
          structured_facts: {
            ...structuredFacts,
            pricing_offer_backfill_skipped_reason: 'no_structured_offer_detected',
          },
        })
        .eq('id', row.id)
        .eq('workspace_id', args.workspaceId)
      if (skippedUpdateError) failed += 1
      else skipped += 1
      continue
    }
    const { error: updateError } = await admin
      .from('ai_knowledge_chunks')
      .update({ structured_facts: structuredFacts })
      .eq('id', row.id)
      .eq('workspace_id', args.workspaceId)
    if (updateError) failed += 1
    else updated += 1
  }

  const after = await countStructuredOfferPopulation({ workspaceId: args.workspaceId, client: admin })
  return {
    before,
    after,
    processed: candidates.length,
    updated,
    skipped,
    failed,
  }
}

export async function countStructuredOfferPopulation(args: {
  readonly workspaceId: string
  readonly client?: SupabaseClient
}): Promise<StructuredOfferPopulationCounts> {
  const admin = args.client ?? supabaseAdmin()
  const { data, error } = await admin
    .from('ai_knowledge_chunks')
    .select('id, structured_facts, source:ai_knowledge_sources!inner(status)')
    .eq('workspace_id', args.workspaceId)
    .eq('source.status', 'active')
  if (error) throw new Error(error.message)

  return (data ?? []).reduce<StructuredOfferPopulationCounts>((counts, row) => {
    const facts = isRecord(row.structured_facts) ? row.structured_facts : null
    return {
      totalActiveChunks: counts.totalActiveChunks + 1,
      chunksWithPricingOffers: counts.chunksWithPricingOffers + (hasPersistedPricingOffers(facts) ? 1 : 0),
      chunksWithPrices: counts.chunksWithPrices + (Array.isArray(facts?.prices) && facts.prices.length > 0 ? 1 : 0),
      chunksWithPercentages: counts.chunksWithPercentages + (Array.isArray(facts?.percentages) && facts.percentages.length > 0 ? 1 : 0),
    }
  }, {
    totalActiveChunks: 0,
    chunksWithPricingOffers: 0,
    chunksWithPrices: 0,
    chunksWithPercentages: 0,
  })
}

function hasPersistedPricingOffers(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.pricing_offers) && value.pricing_offers.length > 0
}

function hasStructuredOfferBackfillChecked(value: unknown): boolean {
  return isRecord(value) && value.pricing_offer_backfill_checked === true
}

function hasPricingSignalForStructuredOffer(value: string): boolean {
  return /(?:\$|€|£|₹|rs\.?|pkr|usd|eur|gbp|aed|sar)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:usd|pkr|eur|gbp|aed|sar)|\b(?:price|pricing|cost|fee|rate|billed|discount|off)\b/i.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
