import { afterEach, describe, expect, it, vi } from 'vitest'

const maybeSingleMock = vi.fn()
const updateMock = vi.fn()
const countSelectMock = vi.fn()

vi.mock('@/lib/automations/admin-client', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'ai_chatbot_provider_settings') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
          update: updateMock,
        }
      }
      return {
        select: countSelectMock,
        update: updateMock,
      }
    },
  }),
}))

vi.mock('@/lib/whatsapp/encryption', () => ({
  decrypt: (value: string) => `decrypted:${value}`,
  encrypt: (value: string) => `encrypted:${value}`,
}))

describe('BYOK embedding provider settings', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    delete process.env.AI_EMBEDDING_API_KEY
    delete process.env.OPENAI_API_KEY
  })

  it('uses a workspace OpenAI key for embeddings', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        workspace_id: 'workspace-1',
        provider: 'openai',
        model: 'gpt-4o-mini',
        base_url: 'https://api.openai.com/v1',
        encrypted_api_key: 'openai-key',
        embeddings_enabled: true,
        embedding_model: 'text-embedding-3-small',
        embedding_dimensions: 1536,
      },
      error: null,
    })
    const { resolveAiEmbeddingProviderConfig } = await import('./provider')

    await expect(resolveAiEmbeddingProviderConfig('workspace-1')).resolves.toMatchObject({
      source: 'workspace',
      provider: 'openai',
      apiKey: 'decrypted:openai-key',
      model: 'text-embedding-3-small',
      supported: true,
    })
  })

  it('uses a workspace OpenRouter key for compatible embedding models', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        workspace_id: 'workspace-1',
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        base_url: 'https://openrouter.ai/api/v1',
        encrypted_api_key: 'openrouter-key',
        embeddings_enabled: true,
        embedding_model: 'openai/text-embedding-3-small',
        embedding_dimensions: 1536,
      },
      error: null,
    })
    const { resolveAiEmbeddingProviderConfig } = await import('./provider')

    const config = await resolveAiEmbeddingProviderConfig('workspace-1')
    expect(config).toMatchObject({
      source: 'workspace',
      provider: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'decrypted:openrouter-key',
      supported: true,
    })
  })

  it('returns unsupported without crashing for providers that do not expose embeddings', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        workspace_id: 'workspace-1',
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        base_url: 'https://api.groq.com/openai/v1',
        encrypted_api_key: 'groq-key',
        embeddings_enabled: true,
      },
      error: null,
    })
    const { resolveAiEmbeddingProviderConfig } = await import('./provider')

    await expect(resolveAiEmbeddingProviderConfig('workspace-1')).resolves.toMatchObject({
      supported: false,
      reason: 'This provider does not support embeddings. Semantic search is disabled, but exact and keyword search still work.',
    })
  })

  it('reports missing embedding key when no workspace or server key exists', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    const { resolveAiEmbeddingProviderConfig } = await import('./provider')

    await expect(resolveAiEmbeddingProviderConfig('workspace-1')).resolves.toMatchObject({
      supported: false,
      reason: 'Embedding API key is not configured.',
    })
  })
})
