import { describe, expect, it } from 'vitest'

import {
  defaultBaseUrlForProvider,
  defaultModelForProvider,
  maskApiKey,
  normalizeProvider,
  providerSupportsChat,
  readApiKeyLast4,
} from './provider'

describe('AI provider settings helpers', () => {
  it('masks API keys using only the stored last four characters', () => {
    expect(readApiKeyLast4('sk-test-1234567890')).toBe('7890')
    expect(maskApiKey('7890')).toBe('•••• 7890')
  })

  it('normalizes unsupported provider input to OpenAI', () => {
    expect(normalizeProvider('openrouter')).toBe('openrouter')
    expect(normalizeProvider('bad-provider')).toBe('openai')
    expect(normalizeProvider(null)).toBe('openai')
  })

  it('uses OpenAI-compatible defaults for supported providers', () => {
    expect(defaultBaseUrlForProvider('openai')).toBe('https://api.openai.com/v1')
    expect(defaultBaseUrlForProvider('openrouter')).toBe('https://openrouter.ai/api/v1')
    expect(defaultBaseUrlForProvider('groq')).toBe('https://api.groq.com/openai/v1')
    expect(defaultModelForProvider('groq')).toBe('llama-3.1-8b-instant')
  })

  it('marks Anthropic as saved-only until a native client is implemented', () => {
    expect(providerSupportsChat('anthropic')).toBe(false)
    expect(providerSupportsChat('openai')).toBe(true)
    expect(providerSupportsChat('custom')).toBe(true)
  })
})
