import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DetectedLanguage } from './language'

vi.mock('@/lib/ai/provider', () => ({
  resolveAiProviderConfig: vi.fn(),
  resolveTranslationModel: vi.fn(),
}))

const provider = await import('@/lib/ai/provider')
const { translateFromEnglish, translateToEnglish } = await import('./translation')

const arabic: DetectedLanguage = {
  code: 'ar',
  name: 'Arabic',
  confidence: 0.9,
  isRTL: true,
  needsTranslation: true,
}

describe('AI chatbot translation helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(provider.resolveAiProviderConfig).mockResolvedValue({
      source: 'workspace',
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret-key',
      supportedForChat: true,
    })
    vi.mocked(provider.resolveTranslationModel).mockResolvedValue('openai/gpt-4o-mini')
  })

  it('translates non-English questions to English with the workspace provider', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('What is the price?')))
    const result = await translateToEnglish('ما هو السعر؟', arabic, 'workspace-a')

    expect(result).toMatchObject({ success: true, translatedText: 'What is the price?' })
    expect(fetch).toHaveBeenCalledWith('https://example.test/v1/chat/completions', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('translates from English while preserving prices, phones, products, and WhatsApp marks', async () => {
    const translated = '*Pro Plan* costs $3.40/mo. Call +44 7478 060494.'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(translated)))
    const result = await translateFromEnglish('*Pro Plan* costs $3.40/mo. Call +44 7478 060494.', arabic, 'workspace-a')

    expect(result.translatedText).toContain('$3.40')
    expect(result.translatedText).toContain('+44 7478 060494')
    expect(result.translatedText).toContain('*Pro Plan*')
  })

  it('returns the original text when translation fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const result = await translateFromEnglish('English answer', arabic, 'workspace-a')

    expect(result).toMatchObject({ success: false, translatedText: 'English answer' })
  })
})

function jsonResponse(content: string): Response {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response
}
