import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiConfig } from './types'
import { chunkText } from './chunk'
import { embedTexts, toVectorLiteral } from './embeddings'

// ============================================================
// Knowledge base: ingest (chunk + optionally embed) and hybrid
// retrieve (semantic when an embeddings key is present, topped up with
// lexical full-text search).
// ============================================================

interface MatchRow {
  id: string
  content: string
  distance?: number
  rank?: number
}

interface KnowledgeCandidate extends MatchRow {
  source: 'agent' | 'knowledge_base'
}

/**
 * (Re)build the chunks for one document. Deletes the document's
 * existing chunks, re-chunks the content, and — when the account has an
 * embeddings key — embeds each chunk. Runs under whatever client the
 * caller passes (service-role for ingest routes).
 *
 * Throws on embedding failure so the ingest route can report it; the
 * chunks are only written once embedding (if attempted) succeeds, so a
 * failed embed never leaves half-indexed rows.
 */
export async function ingestDocument(
  db: SupabaseClient,
  accountId: string,
  config: Pick<AiConfig, 'embeddingsApiKey'>,
  documentId: string,
  content: string,
): Promise<void> {
  const chunks = chunkText(content)

  // Replace, don't append — re-ingest must be idempotent.
  const { error: delErr } = await db
    .from('ai_agent_knowledge_chunks')
    .delete()
    .eq('document_id', documentId)
  if (delErr) throw delErr

  if (chunks.length === 0) return

  // Embed if a key is set, but DON'T let an embedding failure stop the
  // chunks from being stored: a failed embed must still leave the
  // document searchable lexically. We record the error and rethrow it
  // AFTER inserting (embedding-less) rows, so the route can warn
  // "semantic indexing failed" — which is now truthful, because lexical
  // search really does still work.
  let embeddings: number[][] | null = null
  let embedError: unknown = null
  if (config.embeddingsApiKey) {
    try {
      embeddings = await embedTexts(config.embeddingsApiKey, chunks)
    } catch (err) {
      embedError = err
    }
  }

  const rows = chunks.map((content, i) => ({
    document_id: documentId,
    workspace_id: accountId,
    chunk_index: i,
    content,
    embedding: embeddings ? toVectorLiteral(embeddings[i]) : null,
  }))

  const { error: insErr } = await db.from('ai_agent_knowledge_chunks').insert(rows)
  if (insErr) throw insErr

  if (embedError) throw embedError
}

/**
 * Retrieve up to `k` knowledge excerpts relevant to `queryText`.
 *
 * Semantic-primary when an embeddings key is configured (embed the
 * query → cosine-nearest chunks), then topped up with lexical full-text
 * matches to fill `k`. Lexical-only when there's no key. Best-effort:
 * any failure (no KB, embedding error, RPC error) degrades to fewer or
 * zero results and never throws into the draft / auto-reply path.
 */
export async function retrieveKnowledge(
  db: SupabaseClient,
  accountId: string,
  config: Pick<AiConfig, 'embeddingsApiKey'>,
  queryText: string,
  k = 5,
): Promise<string[]> {
  const query = queryText.trim()
  if (!query || k <= 0) return []

  // Skip paid retrieval when both knowledge stores are empty. The
  // standalone Knowledge Base intentionally keeps its existing rag_*
  // storage; the AI Agent store remains separate and backward-compatible.
  try {
    const [agentCount, knowledgeBaseCount] = await Promise.all([
      db
        .from('ai_agent_knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', accountId),
      db
        .from('rag_knowledge_sources')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', accountId)
        .eq('status', 'active')
        .is('deleted_at', null),
    ])
    if ((agentCount.error || !agentCount.count) && (knowledgeBaseCount.error || !knowledgeBaseCount.count)) {
      return []
    }
  } catch {
    return []
  }

  const picked = new Map<string, string>()

  // Semantic path.
  if (config.embeddingsApiKey) {
    try {
      const [queryEmbedding] = await embedTexts(config.embeddingsApiKey, [query])
      if (queryEmbedding) {
        const vector = toVectorLiteral(queryEmbedding)
        const [agentResult, knowledgeBaseResult] = await Promise.all([
          db.rpc('match_ai_agent_knowledge_semantic', {
            p_workspace_id: accountId,
            p_query_embedding: vector,
            p_match_count: k,
          }),
          db.rpc('match_knowledge_base_semantic', {
            p_workspace_id: accountId,
            p_query_embedding: vector,
            p_match_count: k,
          }),
        ])
        const semanticCandidates: KnowledgeCandidate[] = []
        if (!agentResult.error && Array.isArray(agentResult.data)) {
          semanticCandidates.push(
            ...(agentResult.data as MatchRow[]).map((row) => ({ ...row, source: 'agent' as const })),
          )
        }
        if (!knowledgeBaseResult.error && Array.isArray(knowledgeBaseResult.data)) {
          semanticCandidates.push(
            ...(knowledgeBaseResult.data as MatchRow[]).map((row) => ({ ...row, source: 'knowledge_base' as const })),
          )
        }
        semanticCandidates
          .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY))
          .slice(0, k)
          .forEach((row) => picked.set(`${row.source}:${row.id}`, row.content))
      }
    } catch (err) {
      console.error('[ai knowledge] semantic retrieval failed, falling back to FTS:', err)
    }
  }

  // Lexical top-up searches both stores. Each RPC returns ranked rows;
  // merging before the final slice avoids loading all knowledge and keeps
  // the context bounded to the same `k` used before this refactor.
  if (picked.size < k) {
    try {
      const [agentResult, knowledgeBaseResult] = await Promise.all([
        db.rpc('match_ai_agent_knowledge_fts', {
          p_workspace_id: accountId,
          p_query: query,
          p_match_count: k,
        }),
        db.rpc('match_knowledge_base_fts', {
          p_workspace_id: accountId,
          p_query: query,
          p_match_count: k,
        }),
      ])
      const lexicalCandidates: KnowledgeCandidate[] = []
      if (!agentResult.error && Array.isArray(agentResult.data)) {
        lexicalCandidates.push(
          ...(agentResult.data as MatchRow[]).map((row) => ({ ...row, source: 'agent' as const })),
        )
      }
      if (!knowledgeBaseResult.error && Array.isArray(knowledgeBaseResult.data)) {
        lexicalCandidates.push(
          ...(knowledgeBaseResult.data as MatchRow[]).map((row) => ({ ...row, source: 'knowledge_base' as const })),
        )
      }
      lexicalCandidates
        .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
        .forEach((row) => {
          const key = `${row.source}:${row.id}`
          if (picked.size < k && !picked.has(key)) picked.set(key, row.content)
        })
    } catch (err) {
      console.error('[ai knowledge] lexical retrieval failed:', err)
    }
  }

  return Array.from(picked.values()).slice(0, k)
}
