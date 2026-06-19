import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { groupKnowledgeGaps, logKnowledgeGap, sanitizeKnowledgeGapQuestion } from './knowledge-gaps'

describe('AI knowledge gap tracking', () => {
  it('removes personal email and phone patterns before logging', () => {
    const sanitized = sanitizeKnowledgeGapQuestion(
      'Email me at person@example.com or call +44 7478 060494 about your warranty.',
    )
    expect(sanitized).not.toContain('person@example.com')
    expect(sanitized).not.toContain('+44 7478 060494')
    expect(sanitized).toContain('[email removed]')
    expect(sanitized).toContain('[phone removed]')
  })

  it('logs fallback metadata for only the supplied workspace', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn(() => ({ insert }))
    const client = { from } as unknown as SupabaseClient

    await logKnowledgeGap({
      workspaceId: 'workspace-a',
      question: 'Call me on +1 555 123 4567 about missing details',
      fallbackReason: 'no_relevant_knowledge',
      retrievalScore: 4.5,
      chunkCountRetrieved: 2,
      embeddingUsed: true,
    }, client)

    expect(from).toHaveBeenCalledWith('ai_knowledge_gaps')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      workspace_id: 'workspace-a',
      question: expect.not.stringContaining('555 123 4567'),
      fallback_reason: 'no_relevant_knowledge',
      chunk_count_retrieved: 2,
      embedding_used: true,
    }))
  })

  it('groups repeated questions while preserving the newest row details', () => {
    const grouped = groupKnowledgeGaps([
      { question: 'Do you repair laptops?', fallback_reason: 'no_relevant_knowledge', retrieval_score: null, created_at: '2026-06-20T10:00:00Z' },
      { question: 'Do you repair laptops?', fallback_reason: 'weak_evidence', retrieval_score: '4.2', created_at: '2026-06-19T10:00:00Z' },
      { question: 'Do you deliver?', fallback_reason: 'no_relevant_knowledge', retrieval_score: 2, created_at: '2026-06-18T10:00:00Z' },
    ])

    expect(grouped).toHaveLength(2)
    expect(grouped[0]).toEqual(expect.objectContaining({
      question: 'Do you repair laptops?',
      count: 2,
      fallback_reason: 'no_relevant_knowledge',
      last_asked: '2026-06-20T10:00:00Z',
    }))
  })
})
