import { resolveAiProviderConfig, resolveTranslationModel } from '@/lib/ai/provider'
import type { DetectedLanguage } from '@/lib/ai/language'

export interface TranslationResult {
  readonly translatedText: string
  readonly success: boolean
  readonly error?: string
  readonly model?: string
}

export async function translateToEnglish(
  text: string,
  sourceLanguage: DetectedLanguage,
  workspaceId: string,
): Promise<TranslationResult> {
  if (!text.trim() || sourceLanguage.code === 'en') return { translatedText: text, success: true }
  return translate({
    workspaceId,
    text,
    target: 'English',
    systemPrompt:
      'You are a professional translator. Translate the following text to English exactly. Do not add explanation, commentary, or change the meaning. Preserve technical terms, product names, company names, and proper nouns exactly as written. Return only the translated text, nothing else.',
  })
}

export async function translateFromEnglish(
  text: string,
  targetLanguage: DetectedLanguage,
  workspaceId: string,
): Promise<TranslationResult> {
  if (!text.trim() || targetLanguage.code === 'en') return { translatedText: text, success: true }
  return translate({
    workspaceId,
    text,
    target: targetLanguage.name,
    systemPrompt:
      `You are a professional translator. Translate the following text to ${targetLanguage.name} exactly. Do not add explanation, commentary, or change the meaning. Preserve all technical terms, product names, company names, prices, phone numbers, URLs, email addresses, WhatsApp formatting marks (* and _), and proper nouns exactly as written. Keep numbers in their original form. Return only the translated text, nothing else.`,
  })
}

async function translate(args: {
  readonly workspaceId: string
  readonly text: string
  readonly target: string
  readonly systemPrompt: string
}): Promise<TranslationResult> {
  const config = await resolveAiProviderConfig(args.workspaceId)
  if (!config) return { translatedText: args.text, success: false, error: 'ai_provider_missing' }
  const model = await resolveTranslationModel(args.workspaceId, config.model)
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 500,
        messages: [
          { role: 'system', content: args.systemPrompt },
          { role: 'user', content: args.text.slice(0, 4_000) },
        ],
      }),
    })
    if (!response.ok) {
      return { translatedText: args.text, success: false, error: `provider_http_${response.status}`, model }
    }
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const translated = body.choices?.[0]?.message?.content?.trim()
    if (!translated) return { translatedText: args.text, success: false, error: 'empty_translation', model }
    return { translatedText: translated, success: true, model }
  } catch {
    return { translatedText: args.text, success: false, error: 'translation_exception', model }
  }
}
