import { describe, expect, it } from 'vitest'

import {
  categorizeRagEmbeddingError,
  ragEmbeddingUserMessage,
} from './embedding-store'

describe('RAG embedding error categorization', () => {
  it('maps missing provider keys to the clean missing-key message', () => {
    const category = categorizeRagEmbeddingError(new Error('AI provider API key is required.'))

    expect(category).toBe('provider_missing_key')
    expect(ragEmbeddingUserMessage(category)).toBe('AI provider is not configured. Add your API key before embeddings can be created.')
  })

  it('maps invalid provider keys to the clean rejected-key message', () => {
    const category = categorizeRagEmbeddingError(new Error('401 unauthorized invalid api key'))

    expect(category).toBe('provider_invalid_key')
    expect(ragEmbeddingUserMessage(category)).toBe('Embedding failed because the AI provider API key appears invalid. Please update your API key.')
  })

  it('maps low credits and billing failures to the clean billing message', () => {
    const category = categorizeRagEmbeddingError(new Error('402 insufficient_quota account has insufficient funds out of credits'))

    expect(category).toBe('provider_billing_error')
    expect(ragEmbeddingUserMessage(category)).toBe(
      'Embedding failed because the AI provider account may have low balance, no credits, or billing is not active. Please check your provider billing/credits.',
    )
  })

  it('maps rate-limit failures to the clean rate-limit message', () => {
    const category = categorizeRagEmbeddingError(new Error('429 rate_limit too many requests'))

    expect(category).toBe('provider_rate_limited')
    expect(ragEmbeddingUserMessage(category)).toBe('Embedding provider rate limit reached. Please try again later or use a provider account with higher limits.')
  })

  it('maps unsupported model/provider failures to the clean embedding support message', () => {
    const category = categorizeRagEmbeddingError(new Error('model not found embeddings not supported unsupported model'))

    expect(category).toBe('embedding_model_error')
    expect(ragEmbeddingUserMessage(category)).toBe('Selected provider does not support embeddings. Please choose an embedding-capable provider/model.')
  })

  it('maps base URL failures to the clean base URL message', () => {
    const category = categorizeRagEmbeddingError(new Error('ENOTFOUND getaddrinfo invalid URL base url'))

    expect(category).toBe('provider_base_url_error')
    expect(ragEmbeddingUserMessage(category)).toBe('Could not connect to the embedding provider. Please check the provider base URL.')
  })

  it('maps network failures to the clean connection message', () => {
    const category = categorizeRagEmbeddingError(new Error('TypeError: fetch failed'))

    expect(category).toBe('provider_network_error')
    expect(ragEmbeddingUserMessage(category)).toBe('Could not connect to the embedding provider right now. Please try again.')
  })

  it('maps token and payload size failures to the clean size message', () => {
    const category = categorizeRagEmbeddingError(new Error('413 payload too large maximum tokens context length'))

    expect(category).toBe('embedding_payload_too_large')
    expect(ragEmbeddingUserMessage(category)).toBe(
      'Embedding failed because the knowledge chunk is too large for the provider. Please reduce the content size or split the knowledge.',
    )
  })

  it('reads provider SDK status and body fields without exposing secrets', () => {
    const category = categorizeRagEmbeddingError({
      statusCode: 402,
      responseBody: '{"error":{"code":"insufficient_quota","message":"No credits for sk-secret-test"}}',
    })

    expect(category).toBe('provider_billing_error')
  })

  it('uses the chunks-ready fallback for unknown embedding failures', () => {
    const category = categorizeRagEmbeddingError(new Error('unexpected embedding failure'))

    expect(category).toBe('unknown_embedding_error')
    expect(ragEmbeddingUserMessage(category)).toBe(
      'Chunks ready. Embeddings could not be created automatically. Please check your AI provider settings.',
    )
  })
})
