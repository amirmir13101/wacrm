import { createOpenAI } from '@ai-sdk/openai'

import { getStarterRagEffectiveSettings } from './config'

export async function createStarterRagAIProvider() {
  const settings = await getStarterRagEffectiveSettings()
  if (!settings.apiKey) {
    throw new Error('Starter RAG provider API key is not configured.')
  }

  const isOpenRouter = settings.provider === 'openrouter'
  const provider = createOpenAI({
    apiKey: settings.apiKey,
    baseURL: isOpenRouter ? 'https://openrouter.ai/api/v1' : undefined,
    headers: isOpenRouter
      ? {
          'HTTP-Referer': 'https://vpscoaster.live',
          'X-Title': 'Talk Wagon Starter RAG',
        }
      : undefined,
    name: settings.provider,
  })

  return {
    provider,
    providerName: settings.provider,
    chatModel: settings.chatModel,
    embeddingModel: settings.embeddingModel,
  }
}
