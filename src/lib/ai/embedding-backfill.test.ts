import { afterEach, describe, expect, it, vi } from 'vitest'

const configMock = vi.fn()
const embeddingMock = vi.fn()

vi.mock('@/lib/ai/embeddings', () => ({
  resolveEmbeddingConfig: configMock,
  generateEmbedding: embeddingMock,
}))

describe('workspace embedding backfill', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses workspace_id, caps batch size, and updates only embedding fields', async () => {
    configMock.mockResolvedValueOnce({
      source: 'workspace',
      apiKey: 'secret',
      baseUrl: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small',
      dimensions: 3,
      supported: true,
      reason: null,
    })
    embeddingMock.mockResolvedValueOnce({
      embedding: [0.1, 0.2, 0.3],
      model: 'text-embedding-3-small',
      contentHash: 'hash',
    })
    const calls: Array<{ table: string; action: string; payload?: Record<string, unknown>; filters: Record<string, unknown> }> = []
    const client = fakeBackfillClient(calls)
    const { backfillWorkspaceEmbeddings } = await import('./embedding-backfill')

    const result = await backfillWorkspaceEmbeddings({
      workspaceId: 'workspace-1',
      batchSize: 99,
      client,
    })

    expect(result).toMatchObject({ ok: true, batchSize: 25, processed: 1, updated: 1, failed: 0 })
    expect(configMock).toHaveBeenCalledWith('workspace-1')
    expect(embeddingMock).toHaveBeenCalledWith('Chunk text stays unchanged', expect.objectContaining({ source: 'workspace' }))
    const update = calls.find((call) => call.action === 'update')
    expect(update?.filters).toMatchObject({ workspace_id: 'workspace-1', id: 'chunk-1' })
    expect(update?.payload).toEqual({
      embedding: '[0.1,0.2,0.3]',
      embedding_model: 'text-embedding-3-small',
      embedding_status: 'ready',
      embedded_at: expect.any(String),
    })
    expect(JSON.stringify(update?.payload)).not.toContain('chunk_text')
  })

  it('does not process chunks when embeddings are unavailable', async () => {
    configMock.mockResolvedValueOnce({
      source: 'workspace',
      apiKey: '',
      baseUrl: '',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      supported: false,
      reason: 'Embedding API key is not configured.',
    })
    const calls: Array<{ table: string; action: string; payload?: Record<string, unknown>; filters: Record<string, unknown> }> = []
    const client = fakeBackfillClient(calls)
    const { backfillWorkspaceEmbeddings } = await import('./embedding-backfill')

    const result = await backfillWorkspaceEmbeddings({ workspaceId: 'workspace-2', client })

    expect(result).toMatchObject({ ok: false, message: 'Embedding API key is not configured.', processed: 0 })
    expect(embeddingMock).not.toHaveBeenCalled()
    expect(calls.some((call) => call.action === 'update')).toBe(false)
  })

  it('embeds only provided new chunk ids when embeddings are configured', async () => {
    configMock.mockResolvedValueOnce({
      source: 'workspace',
      apiKey: 'secret',
      baseUrl: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small',
      dimensions: 3,
      supported: true,
      reason: null,
    })
    embeddingMock.mockResolvedValueOnce({
      embedding: [0.3, 0.2, 0.1],
      model: 'text-embedding-3-small',
      contentHash: 'hash',
    })
    const calls: Array<{ table: string; action: string; payload?: Record<string, unknown>; filters: Record<string, unknown> }> = []
    const client = fakeBackfillClient(calls)
    const { embedChunkIds } = await import('./embedding-backfill')

    const result = await embedChunkIds({ workspaceId: 'workspace-3', chunkIds: ['chunk-1'], client })

    expect(result).toEqual({ processed: 1, updated: 1, failed: 0 })
    expect(calls.find((call) => call.action === 'select')?.filters).toMatchObject({ workspace_id: 'workspace-3', id: ['chunk-1'] })
    expect(JSON.stringify(calls.find((call) => call.action === 'update')?.payload)).not.toContain('chunk_text')
  })

  it('skips new chunk embedding when embeddings are disabled', async () => {
    configMock.mockResolvedValueOnce({
      source: 'workspace',
      apiKey: '',
      baseUrl: '',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      supported: false,
      reason: 'This provider does not support embeddings.',
    })
    const calls: Array<{ table: string; action: string; payload?: Record<string, unknown>; filters: Record<string, unknown> }> = []
    const client = fakeBackfillClient(calls)
    const { embedChunkIds } = await import('./embedding-backfill')

    const result = await embedChunkIds({ workspaceId: 'workspace-4', chunkIds: ['chunk-1'], client })

    expect(result).toEqual({ processed: 0, updated: 0, failed: 0 })
    expect(embeddingMock).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
  })
})

function fakeBackfillClient(calls: Array<{ table: string; action: string; payload?: Record<string, unknown>; filters: Record<string, unknown> }>) {
  const makeQuery = (table: string, action: string, payload?: Record<string, unknown>) => {
    const filters: Record<string, unknown> = {}
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => {
        filters[key] = value
        return query
      },
      in: (key: string, value: unknown) => {
        filters[key] = value
        return query
      },
      order: () => query,
      limit: async () => {
        calls.push({ table, action, payload, filters })
        return {
          data: [
            {
              id: 'chunk-1',
              workspace_id: filters.workspace_id,
              chunk_text: 'Chunk text stays unchanged',
              content_hash: 'hash',
            },
          ],
          error: null,
        }
      },
      then: (resolve: (value: { count?: number; data?: unknown[]; error: null }) => void) => {
        calls.push({ table, action, payload, filters })
        if (action === 'select') {
          resolve({
            data: [
              {
                id: 'chunk-1',
                workspace_id: filters.workspace_id,
                chunk_text: 'Chunk text stays unchanged',
                content_hash: 'hash',
              },
            ],
            error: null,
          })
          return
        }
        resolve({ count: 0, error: null })
      },
    }
    return query
  }
  return {
    from: (table: string) => ({
      select: () => makeQuery(table, 'select'),
      update: (payload: Record<string, unknown>) => makeQuery(table, 'update', payload),
    }),
  } as never
}
