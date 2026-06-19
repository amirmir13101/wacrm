import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

const { embedNewChunks } = vi.hoisted(() => ({ embedNewChunks: vi.fn() }))
vi.mock('@/lib/ai/embedding-backfill', () => ({ embedNewChunks }))

import { rechunkKnowledgeSource, semanticChunkText } from './knowledge'

describe('semantic knowledge chunking', () => {
  it('splits long content only at sentence boundaries', () => {
    const text = Array.from(
      { length: 30 },
      (_, index) => `Sentence ${index + 1} contains complete business information for customers.`,
    ).join(' ')
    const chunks = semanticChunkText(text, { softLimit: 60, hardLimit: 90, minChunkSize: 10, overlapSentences: 0 })

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => /[.!?]$/.test(chunk.text))).toBe(true)
  })

  it('keeps a plan name, price, and specifications in one pricing block', () => {
    const chunks = semanticChunkText([
      '## Plans',
      '',
      'Pro Plan',
      'Price: $29/month.',
      'Includes 8GB RAM, 4 CPU cores, priority support, and 100GB storage.',
    ].join('\n'), { softLimit: 20, hardLimit: 120 })

    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.text).toContain('Pro Plan')
    expect(chunks[0]?.text).toContain('$29/month')
    expect(chunks[0]?.text).toContain('8GB RAM')
  })

  it('keeps adjacent FAQ questions and answers together', () => {
    const chunks = semanticChunkText([
      '## FAQ',
      '',
      'Can I return an unopened item?',
      '',
      'Yes. Unopened items can be returned within 14 days.',
    ].join('\n'), { softLimit: 15, hardLimit: 80 })

    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.text).toContain('Can I return')
    expect(chunks[0]?.text).toContain('within 14 days')
  })

  it('preserves nearest heading context in metadata', () => {
    const chunks = semanticChunkText([
      '# Business',
      '',
      '## Contact',
      '',
      'Call us on +1 555 0100.',
    ].join('\n'))

    expect(chunks[0]?.headingPath).toEqual(['Business', 'Contact'])
  })

  it('merges a below-minimum chunk with an adjacent chunk', () => {
    const chunks = semanticChunkText(
      'Short note.\n\nThis adjacent paragraph contains enough useful information about customer support and response timing.',
      { softLimit: 100, hardLimit: 120, minChunkSize: 30 },
    )

    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.text).toContain('Short note.')
    expect(chunks[0]?.text).toContain('customer support')
  })

  it('splits a very long paragraph at sentence boundaries and respects the hard maximum', () => {
    const text = Array.from(
      { length: 80 },
      (_, index) => `Complete sentence ${index + 1} explains an important policy detail without ambiguity.`,
    ).join(' ')
    const chunks = semanticChunkText(text, { softLimit: 70, hardLimit: 90, minChunkSize: 10, overlapSentences: 0 })

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.estimatedTokens <= 90)).toBe(true)
    expect(chunks.every((chunk) => /[.!?]$/.test(chunk.text))).toBe(true)
  })

  it('re-chunks only the requested workspace source without modifying source content', async () => {
    const sourceBuilder = queryResult({
      data: { id: 'source-a', title: 'Policies', content: '## Refunds\n\nCustomers may request a refund within 14 days.' },
      error: null,
    })
    const oldChunksBuilder = queryResult({ data: [{ id: 'old-a' }, { id: 'old-b' }], error: null })
    const insertBuilder = queryResult({ data: [{ id: 'new-a' }], error: null })
    const deleteBuilder = queryResult({ data: null, error: null })
    const from = vi.fn()
      .mockReturnValueOnce(sourceBuilder)
      .mockReturnValueOnce(oldChunksBuilder)
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(deleteBuilder)
    const client = { from } as unknown as SupabaseClient

    const result = await rechunkKnowledgeSource({
      workspaceId: 'workspace-a',
      sourceId: 'source-a',
      client,
    })

    expect(result).toEqual({ oldChunkCount: 2, newChunkCount: 1, chunkIds: ['new-a'] })
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        workspace_id: 'workspace-a',
        source_id: 'source-a',
        chunk_text: expect.stringContaining('within 14 days'),
        embedding_status: 'pending',
      }),
    ])
    expect(deleteBuilder.eq).toHaveBeenCalledWith('source_id', 'source-a')
    expect(deleteBuilder.eq).toHaveBeenCalledWith('workspace_id', 'workspace-a')
    expect(deleteBuilder.in).toHaveBeenCalledWith('id', ['old-a', 'old-b'])
    expect(embedNewChunks).toHaveBeenCalledWith('workspace-a', ['new-a'], client)
  })
})

function queryResult(result: { readonly data: unknown; readonly error: unknown }) {
  const builder = {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
    then: (
      resolve: (value: { readonly data: unknown; readonly error: unknown }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  }
  builder.select.mockReturnValue(builder)
  builder.insert.mockReturnValue(builder)
  builder.delete.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  builder.maybeSingle.mockResolvedValue(result)
  return builder
}
