import { describe, expect, it } from 'vitest'

import { buildSafeProviderError, parseProviderErrorResponse } from './provider-errors'

describe('safe AI provider error parsing', () => {
  it('explains OpenAI HTTP 429 without implying ChatGPT Plus includes API usage', async () => {
    const error = await parseProviderErrorResponse({
      response: new Response(JSON.stringify({
        error: {
          type: 'insufficient_quota',
          code: 'insufficient_quota',
          message: 'You exceeded your current quota.',
        },
      }), { status: 429, headers: { 'content-type': 'application/json' } }),
      provider: 'openai',
      model: 'gpt-4o-mini',
      requestType: 'provider-test',
    })

    expect(error.category).toBe('provider_quota_or_billing')
    expect(error.reason).toBe('provider_quota_or_billing')
    expect(error.adminMessage).toContain('API quota or billing issue')
    expect(error.adminMessage).not.toContain('sk-')
  })

  it('classifies rate limits, invalid keys, and invalid models generically', () => {
    expect(buildSafeProviderError({
      status: 429,
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      requestType: 'chat',
      errorMessage: 'Rate limit reached',
    })).toMatchObject({ category: 'provider_rate_limited', reason: 'provider_rate_limited' })

    expect(buildSafeProviderError({
      status: 401,
      provider: 'custom',
      model: 'bad-model',
      requestType: 'chat',
      errorMessage: 'Invalid API key',
    })).toMatchObject({ category: 'provider_invalid_key', reason: 'provider_invalid_key' })

    expect(buildSafeProviderError({
      status: 400,
      provider: 'openai',
      model: 'bad-model',
      requestType: 'chat',
      errorCode: 'model_not_found',
    })).toMatchObject({ category: 'provider_invalid_model', reason: 'provider_invalid_model' })
  })

  it('redacts secrets from provider messages', () => {
    const error = buildSafeProviderError({
      status: 401,
      provider: 'openai',
      model: 'gpt-4o-mini',
      requestType: 'chat',
      errorMessage: 'Authorization Bearer sk-secret1234567890 failed for admin@example.com',
    })

    expect(error.errorMessage).not.toContain('sk-secret')
    expect(error.errorMessage).not.toContain('admin@example.com')
    expect(error.errorMessage).toContain('Bearer [redacted]')
    expect(error.errorMessage).toContain('[email removed]')
  })
})
