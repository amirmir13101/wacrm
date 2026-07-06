import { createOpenAI } from '@ai-sdk/openai'
import type { OpenAIProvider } from '@ai-sdk/openai'
import type {
  CustomerFacingRagProviderInput,
  RagProviderType,
  RagResolvedProviderConfig,
} from './types'
import { AI_PROVIDER_DEFAULTS } from './provider-config'
import { getSiteUrl } from '@/lib/site-url'

export const DEFAULT_RAG_PROVIDER_CONFIG = {
  openai: {
    baseUrl: AI_PROVIDER_DEFAULTS.openai.baseUrl,
    chatModel: AI_PROVIDER_DEFAULTS.openai.chatModel,
    embeddingModel: AI_PROVIDER_DEFAULTS.openai.embeddingModel,
    embeddingDimensions: AI_PROVIDER_DEFAULTS.openai.embeddingDimensions,
  },
  openrouter: {
    baseUrl: AI_PROVIDER_DEFAULTS.openrouter.baseUrl,
    chatModel: AI_PROVIDER_DEFAULTS.openrouter.chatModel,
    embeddingModel: AI_PROVIDER_DEFAULTS.openrouter.embeddingModel,
    embeddingDimensions: AI_PROVIDER_DEFAULTS.openrouter.embeddingDimensions,
  },
  groq: {
    baseUrl: AI_PROVIDER_DEFAULTS.groq.baseUrl,
    chatModel: AI_PROVIDER_DEFAULTS.groq.chatModel,
    embeddingModel: AI_PROVIDER_DEFAULTS.groq.embeddingModel,
    embeddingDimensions: AI_PROVIDER_DEFAULTS.groq.embeddingDimensions,
  },
  ollama: {
    baseUrl: process.env.RAG_OLLAMA_BASE_URL ?? AI_PROVIDER_DEFAULTS.ollama.baseUrl,
    chatModel: process.env.RAG_OLLAMA_CHAT_MODEL ?? AI_PROVIDER_DEFAULTS.ollama.chatModel,
    embeddingModel: process.env.RAG_OLLAMA_EMBEDDING_MODEL ?? AI_PROVIDER_DEFAULTS.ollama.embeddingModel,
    embeddingDimensions: Number(process.env.RAG_OLLAMA_EMBEDDING_DIMENSIONS ?? AI_PROVIDER_DEFAULTS.ollama.embeddingDimensions),
  },
  custom_openai_compatible: {
    baseUrl: process.env.RAG_CUSTOM_OPENAI_BASE_URL ?? AI_PROVIDER_DEFAULTS.custom_openai_compatible.baseUrl,
    chatModel: process.env.RAG_CUSTOM_OPENAI_CHAT_MODEL ?? AI_PROVIDER_DEFAULTS.custom_openai_compatible.chatModel,
    embeddingModel:
      process.env.RAG_CUSTOM_OPENAI_EMBEDDING_MODEL ?? AI_PROVIDER_DEFAULTS.custom_openai_compatible.embeddingModel,
    embeddingDimensions: Number(process.env.RAG_CUSTOM_OPENAI_EMBEDDING_DIMENSIONS ?? AI_PROVIDER_DEFAULTS.custom_openai_compatible.embeddingDimensions),
  },
  gemini: {
    baseUrl: AI_PROVIDER_DEFAULTS.gemini.baseUrl,
    chatModel: AI_PROVIDER_DEFAULTS.gemini.chatModel,
    embeddingModel: AI_PROVIDER_DEFAULTS.gemini.embeddingModel,
    embeddingDimensions: AI_PROVIDER_DEFAULTS.gemini.embeddingDimensions,
  },
} as const satisfies Record<
  RagProviderType,
  {
    readonly baseUrl: string
    readonly chatModel: string
    readonly embeddingModel: string
    readonly embeddingDimensions: number
  }
>
export function resolveRagProviderConfig(
  input: CustomerFacingRagProviderInput,
): RagResolvedProviderConfig {
  const apiKey = input.apiKey.trim()
  if (!apiKey) throw new Error('AI provider API key is required.')

  const defaults = DEFAULT_RAG_PROVIDER_CONFIG[input.provider]
  const baseUrl = (input.baseUrl?.trim() || defaults.baseUrl).replace(/\/+$/, '')
  const chatModel = input.chatModel?.trim() || defaults.chatModel
  const embeddingModel = input.embeddingModel?.trim() || defaults.embeddingModel
  const embeddingDimensions = Number.isFinite(input.embeddingDimensions ?? NaN)
    ? Number(input.embeddingDimensions)
    : defaults.embeddingDimensions

  if (input.provider === 'custom_openai_compatible' && !baseUrl) {
    throw new Error('Custom provider is not configured on the server.')
  }
  if (!chatModel) {
    throw new Error('Chat model is required.')
  }
  if (!embeddingModel) {
    throw new Error('Embedding model is not configured. Please select an embedding model.')
  }

  return {
    provider: input.provider,
    apiKey,
    baseUrl,
    chatModel,
    embeddingModel,
    embeddingDimensions,
    headers:
      input.provider === 'openrouter'
        ? {
            'HTTP-Referer': getSiteUrl(),
            'X-OpenRouter-Title': 'Talk Wagon RAG Chatbot',
          }
        : undefined,
  }
}

export function createRagOpenAICompatibleProvider(
  config: RagResolvedProviderConfig,
): OpenAIProvider {
  return createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    headers: config.headers,
    name: config.provider,
  })
}
