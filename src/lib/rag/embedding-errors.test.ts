import { describe, expect, it } from 'vitest'

import {
  categorizeRagEmbeddingError,
  ragEmbeddingUserMessage,
} from './embedding-store'

describe('RAG embedding error categorization', () => {
  it('maps missing provider keys to the clean missing-key message', () => {
    const category = categorizeRagEmbeddingError(new Error('AI provider API key is required.'))

    expect(category).toBe('provider_missing_key')
    expect(ragEmbeddingUserMessage(category)).toBe('AI provider key is missing. Add your API key before preparing embeddings.')
  })

  it('maps invalid provider keys to the clean rejected-key message', () => {
    const category = categorizeRagEmbeddingError(new Error('401 unauthorized invalid api key'))

    expect(category).toBe('provider_invalid_key')
    expect(ragEmbeddingUserMessage(category)).toBe('AI provider key is invalid or provider rejected the request.')
  })

  it('maps quota and rate-limit failures to the clean provider-limit message', () => {
    const category = categorizeRagEmbeddingError(new Error('429 quota exceeded'))

    expect(category).toBe('provider_rate_limited')
    expect(ragEmbeddingUserMessage(category)).toBe('Embedding provider limit reached. Please try again later or check your provider account.')
  })

  it('maps network failures to the clean connection message', () => {
    const category = categorizeRagEmbeddingError(new Error('TypeError: fetch failed'))

    expect(category).toBe('provider_network_error')
    expect(ragEmbeddingUserMessage(category)).toBe('Could not connect to the embedding provider right now. Please try again.')
  })

  it('uses the chunks-ready fallback for unknown embedding failures', () => {
    const category = categorizeRagEmbeddingError(new Error('unexpected embedding failure'))

    expect(category).toBe('unknown_embedding_error')
    expect(ragEmbeddingUserMessage(category)).toBe(
      'Chunks ready. Embeddings could not be prepared. Please check your AI provider settings or click Prepare for Chatbot again.',
    )
  })
})
