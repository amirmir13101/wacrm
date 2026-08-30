import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const h = vi.hoisted(() => ({ embedTexts: vi.fn() }))
vi.mock('./embeddings', () => ({
  embedTexts: h.embedTexts,
  toVectorLiteral: (v: number[]) => `[${v.join(',')}]`,
}))

import { retrieveKnowledge, ingestDocument } from './knowledge'

interface FakeState {
  semantic: { id: string; content: string; distance?: number; rank?: number }[]
  knowledgeBaseSemantic: { id: string; content: string; distance?: number; rank?: number }[]
  fts: { id: string; content: string; distance?: number; rank?: number }[]
  knowledgeBaseFts: { id: string; content: string; distance?: number; rank?: number }[]
  chunkCount: number
  knowledgeBaseCount: number
  rpcCalls: string[]
  inserted: Record<string, unknown>[] | null
  deletedFor: string | null
}

function makeDb() {
  const state: FakeState = {
    semantic: [],
    knowledgeBaseSemantic: [],
    fts: [],
    knowledgeBaseFts: [],
    chunkCount: 5, // account has a non-empty KB by default
    knowledgeBaseCount: 0,
    rpcCalls: [],
    inserted: null,
    deletedFor: null,
  }
  const db = {
    rpc: (name: string) => {
      state.rpcCalls.push(name)
      if (name === 'match_ai_agent_knowledge_semantic')
        return Promise.resolve({ data: state.semantic, error: null })
      if (name === 'match_knowledge_base_semantic')
        return Promise.resolve({ data: state.knowledgeBaseSemantic, error: null })
      if (name === 'match_ai_agent_knowledge_fts')
        return Promise.resolve({ data: state.fts, error: null })
      if (name === 'match_knowledge_base_fts')
        return Promise.resolve({ data: state.knowledgeBaseFts, error: null })
      return Promise.resolve({ data: null, error: null })
    },
    from: (table: string) => ({
      // retrieveKnowledge's empty-KB count guard.
      select: () => {
        const result = {
          count:
            table === 'rag_knowledge_sources'
              ? state.knowledgeBaseCount
              : state.chunkCount,
          error: null,
        }
        const builder = {
          eq: () => builder,
          is: () => Promise.resolve(result),
          then: (resolve: (value: typeof result) => unknown) =>
            Promise.resolve(result).then(resolve),
        }
        return builder
      },
      delete: () => ({
        eq: (_col: string, val: string) => {
          state.deletedFor = val
          return Promise.resolve({ error: null })
        },
      }),
      insert: (rows: Record<string, unknown>[]) => {
        state.inserted = rows
        return Promise.resolve({ error: null })
      },
    }),
  }
  return { db: db as unknown as SupabaseClient, state }
}

beforeEach(() => {
  h.embedTexts.mockReset()
  h.embedTexts.mockImplementation(async (_key: string, inputs: string[]) =>
    inputs.map((_, i) => [i, i]),
  )
})

describe('retrieveKnowledge', () => {
  it('returns [] for an empty query without touching the DB', async () => {
    const { db, state } = makeDb()
    expect(await retrieveKnowledge(db, 'acct', { embeddingsApiKey: null }, '  ')).toEqual([])
    expect(state.rpcCalls).toEqual([])
  })

  it('short-circuits (no embed, no RPC) when the KB is empty', async () => {
    const { db, state } = makeDb()
    state.chunkCount = 0
    const out = await retrieveKnowledge(db, 'acct', { embeddingsApiKey: 'sk-x' }, 'q')
    expect(out).toEqual([])
    expect(h.embedTexts).not.toHaveBeenCalled()
    expect(state.rpcCalls).toEqual([])
  })

  it('uses lexical FTS only when there is no embeddings key', async () => {
    const { db, state } = makeDb()
    state.fts = [{ id: 'f1', content: 'F1' }]
    const out = await retrieveKnowledge(db, 'acct', { embeddingsApiKey: null }, 'q')
    expect(out).toEqual(['F1'])
    expect(state.rpcCalls).toEqual([
      'match_ai_agent_knowledge_fts',
      'match_knowledge_base_fts',
    ])
    expect(h.embedTexts).not.toHaveBeenCalled()
  })

  it('uses semantic search when an embeddings key is present', async () => {
    const { db, state } = makeDb()
    state.semantic = [
      { id: 's1', content: 'S1' },
      { id: 's2', content: 'S2' },
      { id: 's3', content: 'S3' },
    ]
    const out = await retrieveKnowledge(db, 'acct', { embeddingsApiKey: 'sk-x' }, 'q', 3)
    expect(out).toEqual(['S1', 'S2', 'S3'])
    expect(h.embedTexts).toHaveBeenCalledTimes(1)
    // Enough semantic hits → no FTS top-up.
    expect(state.rpcCalls).toEqual([
      'match_ai_agent_knowledge_semantic',
      'match_knowledge_base_semantic',
    ])
  })

  it('tops up with FTS and dedupes when semantic is short', async () => {
    const { db, state } = makeDb()
    state.semantic = [
      { id: 's1', content: 'S1' },
      { id: 's2', content: 'S2' },
    ]
    state.fts = [
      { id: 's2', content: 'S2-dup' }, // dedup by id
      { id: 'f1', content: 'F1' },
    ]
    const out = await retrieveKnowledge(db, 'acct', { embeddingsApiKey: 'sk-x' }, 'q', 3)
    expect(out).toEqual(['S1', 'S2', 'F1'])
    expect(state.rpcCalls).toEqual([
      'match_ai_agent_knowledge_semantic',
      'match_knowledge_base_semantic',
      'match_ai_agent_knowledge_fts',
      'match_knowledge_base_fts',
    ])
  })

  it('answers when relevant context exists only in the standalone Knowledge Base', async () => {
    const { db, state } = makeDb()
    state.chunkCount = 0
    state.knowledgeBaseCount = 1
    state.knowledgeBaseFts = [{ id: 'kb-1', content: 'Standalone KB answer' }]

    await expect(
      retrieveKnowledge(db, 'acct', { embeddingsApiKey: null }, 'q'),
    ).resolves.toEqual(['Standalone KB answer'])
  })

  it('merges useful context from both stores while respecting the same result limit', async () => {
    const { db, state } = makeDb()
    state.knowledgeBaseCount = 1
    state.fts = [{ id: 'agent-1', content: 'Agent fact', rank: 0.9 }]
    state.knowledgeBaseFts = [{ id: 'kb-1', content: 'Knowledge Base fact', rank: 0.8 }]

    await expect(
      retrieveKnowledge(db, 'acct', { embeddingsApiKey: null }, 'q', 2),
    ).resolves.toEqual(['Agent fact', 'Knowledge Base fact'])
  })

  it('returns no context when neither source has a relevant match', async () => {
    const { db } = makeDb()
    await expect(
      retrieveKnowledge(db, 'acct', { embeddingsApiKey: null }, 'unknown'),
    ).resolves.toEqual([])
  })

  it('allows a bounded eight-excerpt context by default for multi-part questions', async () => {
    const { db, state } = makeDb()
    state.fts = Array.from({ length: 10 }, (_, index) => ({
      id: `f${index}`,
      content: `Fact ${index}`,
      rank: 10 - index,
    }))

    const out = await retrieveKnowledge(db, 'acct', { embeddingsApiKey: null }, 'multi-part question')

    expect(out).toHaveLength(8)
    expect(out).toEqual(Array.from({ length: 8 }, (_, index) => `Fact ${index}`))
  })
})

describe('ingestDocument', () => {
  it('embeds chunks when a key is present', async () => {
    const { db, state } = makeDb()
    await ingestDocument(db, 'acct', { embeddingsApiKey: 'sk-x' }, 'doc-1', 'hello world')
    expect(h.embedTexts).toHaveBeenCalledTimes(1)
    expect(state.deletedFor).toBe('doc-1')
    expect(state.inserted).toHaveLength(1)
    expect(state.inserted![0].embedding).toBe('[0,0]') // literal from mocked embed
    expect(state.inserted![0].workspace_id).toBe('acct')
  })

  it('stores chunks without embeddings when there is no key', async () => {
    const { db, state } = makeDb()
    await ingestDocument(db, 'acct', { embeddingsApiKey: null }, 'doc-1', 'hello world')
    expect(h.embedTexts).not.toHaveBeenCalled()
    expect(state.inserted![0].embedding).toBeNull()
  })

  it('deletes existing chunks and inserts nothing for empty content', async () => {
    const { db, state } = makeDb()
    await ingestDocument(db, 'acct', { embeddingsApiKey: 'sk-x' }, 'doc-1', '   ')
    expect(state.deletedFor).toBe('doc-1')
    expect(state.inserted).toBeNull()
    expect(h.embedTexts).not.toHaveBeenCalled()
  })

  it('still stores lexical chunks when embedding fails, then rethrows', async () => {
    const { db, state } = makeDb()
    h.embedTexts.mockRejectedValueOnce(new Error('rate limited'))
    await expect(
      ingestDocument(db, 'acct', { embeddingsApiKey: 'sk-x' }, 'doc-1', 'hello world'),
    ).rejects.toThrow('rate limited')
    // Chunks were inserted (lexical search works) despite the embed failure…
    expect(state.inserted).toHaveLength(1)
    expect(state.inserted![0].embedding).toBeNull()
  })
})
