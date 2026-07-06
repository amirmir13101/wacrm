import type { RagProviderType } from './types'

export interface RagProviderModelOption {
  readonly id: string
  readonly label: string
  readonly provider: RagProviderType
  readonly description?: string
  readonly contextLength?: number
  readonly pricing?: string
  readonly supportsVision?: boolean
  readonly supportsTools?: boolean
  readonly supportsStructuredOutput?: boolean
}

export interface RagProviderConfig {
  readonly label: string
  readonly defaultBaseUrl: string
  readonly defaultChatModel: string
  readonly defaultEmbeddingModel: string
  readonly defaultEmbeddingDimensions: number
  readonly supportsEmbeddings: boolean
  readonly supportsModelFetch: boolean
  readonly fallbackModels: ReadonlyArray<RagProviderModelOption>
  readonly helperText: string
  readonly embeddingHelperText: string
}

export interface RagProviderDefaultConfig {
  readonly provider: RagProviderType
  readonly displayName: string
  readonly chatModel: string
  readonly embeddingModel: string
  readonly embeddingDimensions: number
  readonly baseUrl: string
  readonly supportsChat: boolean
  readonly supportsEmbeddings: boolean
  readonly notes: string
}

function model(provider: RagProviderType, id: string, label = id): RagProviderModelOption {
  return { id, label, provider }
}

export const AI_PROVIDER_CONFIG: Record<RagProviderType, RagProviderConfig> = {
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultChatModel: 'gpt-4o-mini',
    defaultEmbeddingModel: 'text-embedding-3-small',
    defaultEmbeddingDimensions: 1536,
    supportsEmbeddings: true,
    supportsModelFetch: false,
    fallbackModels: [
      model('openai', 'gpt-4o-mini', 'GPT-4o mini'),
      model('openai', 'gpt-4o', 'GPT-4o'),
      model('openai', 'gpt-4.1-mini', 'GPT-4.1 mini'),
      model('openai', 'gpt-4.1', 'GPT-4.1'),
    ],
    helperText: 'Recommended for best chatbot reliability. Paste your OpenAI API key and save.',
    embeddingHelperText: 'Recommended embedding model: text-embedding-3-small with 1536 dimensions.',
  },
  openrouter: {
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultChatModel: 'openai/gpt-4o-mini',
    defaultEmbeddingModel: 'openai/text-embedding-3-small',
    defaultEmbeddingDimensions: 1536,
    supportsEmbeddings: true,
    supportsModelFetch: false,
    fallbackModels: [
      model('openrouter', 'openai/gpt-4o-mini', 'OpenAI GPT-4o mini'),
      model('openrouter', 'openai/gpt-4o', 'OpenAI GPT-4o'),
      model('openrouter', 'anthropic/claude-3.5-sonnet', 'Anthropic Claude 3.5 Sonnet'),
      model('openrouter', 'google/gemini-2.0-flash-001', 'Google Gemini 2.0 Flash'),
      model('openrouter', 'meta-llama/llama-3.3-70b-instruct', 'Meta Llama 3.3 70B Instruct'),
    ],
    helperText: 'OpenRouter uses a safe default chat model automatically. Knowledge preparation support can vary by model.',
    embeddingHelperText: 'Chat can work through OpenRouter, but reliable knowledge preparation may require OpenAI or Gemini.',
  },
  groq: {
    label: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultChatModel: 'llama-3.1-8b-instant',
    defaultEmbeddingModel: 'text-embedding-3-small',
    defaultEmbeddingDimensions: 1536,
    supportsEmbeddings: true,
    supportsModelFetch: true,
    fallbackModels: [
      model('groq', 'llama-3.1-8b-instant', 'Llama 3.1 8B Instant'),
      model('groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B Versatile'),
      model('groq', 'gemma2-9b-it', 'Gemma 2 9B IT'),
    ],
    helperText: 'Groq uses an OpenAI-compatible API with fast hosted models.',
    embeddingHelperText: 'Use an embedding-capable model documented by your provider. Chat-only providers may reject embedding requests.',
  },
  gemini: {
    label: 'Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultChatModel: 'gemini-2.0-flash',
    defaultEmbeddingModel: 'gemini-embedding-001',
    defaultEmbeddingDimensions: 1536,
    supportsEmbeddings: true,
    supportsModelFetch: false,
    fallbackModels: [
      model('gemini', 'gemini-2.0-flash', 'Gemini 2.0 Flash'),
      model('gemini', 'gemini-2.5-flash', 'Gemini 2.5 Flash'),
      model('gemini', 'gemini-2.5-pro', 'Gemini 2.5 Pro'),
    ],
    helperText: 'Gemini uses Google defaults automatically. Paste your Gemini API key and save.',
    embeddingHelperText: 'Gemini can prepare chatbot knowledge with the CRM default embedding setup.',
  },
  ollama: {
    label: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultChatModel: 'llama3.1',
    defaultEmbeddingModel: 'nomic-embed-text',
    defaultEmbeddingDimensions: 1536,
    supportsEmbeddings: true,
    supportsModelFetch: false,
    fallbackModels: [],
    helperText: 'Use a local Ollama server URL. API key is not required for the usual local setup.',
    embeddingHelperText: 'Ollama can answer chats, but local knowledge preparation depends on the installed embedding model.',
  },
  custom_openai_compatible: {
    label: 'Custom OpenAI-Compatible',
    defaultBaseUrl: '',
    defaultChatModel: '',
    defaultEmbeddingModel: 'text-embedding-3-small',
    defaultEmbeddingDimensions: 1536,
    supportsEmbeddings: true,
    supportsModelFetch: false,
    fallbackModels: [],
    helperText: 'Enter the model ID and base URL exactly as your provider documents them.',
    embeddingHelperText: 'Enter the embedding model ID exactly as your OpenAI-compatible provider documents it.',
  },
}

export const CUSTOM_MODEL_OPTION_ID = '__custom_model__'
export const CUSTOM_BASE_URL_OPTION_ID = '__custom_base_url__'

export const SIMPLE_RAG_PROVIDER_TYPES = [
  'openai',
  'openrouter',
  'ollama',
  'gemini',
] as const satisfies ReadonlyArray<RagProviderType>

export type SimpleRagProviderType = (typeof SIMPLE_RAG_PROVIDER_TYPES)[number]

export const AI_PROVIDER_DEFAULTS: Record<RagProviderType, RagProviderDefaultConfig> = Object.fromEntries(
  Object.entries(AI_PROVIDER_CONFIG).map(([provider, config]) => [
    provider,
    {
      provider: provider as RagProviderType,
      displayName: config.label,
      chatModel: config.defaultChatModel,
      embeddingModel: config.defaultEmbeddingModel,
      embeddingDimensions: config.defaultEmbeddingDimensions,
      baseUrl: config.defaultBaseUrl,
      supportsChat: true,
      supportsEmbeddings: config.supportsEmbeddings,
      notes: config.embeddingHelperText,
    },
  ]),
) as Record<RagProviderType, RagProviderDefaultConfig>

export function isSimpleRagProviderType(provider: RagProviderType): provider is SimpleRagProviderType {
  return (SIMPLE_RAG_PROVIDER_TYPES as readonly RagProviderType[]).includes(provider)
}

export function providerLabel(provider: RagProviderType): string {
  return AI_PROVIDER_CONFIG[provider].label
}

export function providerFallbackModels(provider: RagProviderType): ReadonlyArray<RagProviderModelOption> {
  return AI_PROVIDER_CONFIG[provider].fallbackModels
}
