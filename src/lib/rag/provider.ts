import { createOpenAI } from '@ai-sdk/openai'
import type { OpenAIProvider } from '@ai-sdk/openai'
import type {
  CustomerFacingRagProviderInput,
  RagProviderType,
  RagResolvedProviderConfig,
} from './types'

export const DEFAULT_RAG_PROVIDER_CONFIG = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    chatModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
    embeddingDimensions: 1536,
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    chatModel: 'openai/gpt-4o-mini',
    embeddingModel: 'openai/text-embedding-3-small',
    embeddingDimensions: 1536,
  },
  ollama: {
    baseUrl: process.env.RAG_OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/v1',
    chatModel: process.env.RAG_OLLAMA_CHAT_MODEL ?? 'llama3.1',
    embeddingModel: process.env.RAG_OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text',
    embeddingDimensions: Number(process.env.RAG_OLLAMA_EMBEDDING_DIMENSIONS ?? 1536),
  },
  custom_openai_compatible: {
    baseUrl: process.env.RAG_CUSTOM_OPENAI_BASE_URL ?? '',
    chatModel: process.env.RAG_CUSTOM_OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
    embeddingModel:
      process.env.RAG_CUSTOM_OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    embeddingDimensions: Number(process.env.RAG_CUSTOM_OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
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
  if (input.provider === 'ollama' && !process.env.RAG_OLLAMA_BASE_URL) {
    throw new Error('Ollama is not configured on the server.')
  }
  if (input.provider === 'custom_openai_compatible' && !defaults.baseUrl) {
    throw new Error('Custom provider is not configured on the server.')
  }

  return {
    provider: input.provider,
    apiKey,
    baseUrl: defaults.baseUrl,
    chatModel: defaults.chatModel,
    embeddingModel: defaults.embeddingModel,
    embeddingDimensions: defaults.embeddingDimensions,
    headers:
      input.provider === 'openrouter'
        ? {
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vpscoaster.live',
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
