import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt, encrypt } from '@/lib/whatsapp/encryption'

export const AI_PROVIDER_VALUES = ['openai', 'openrouter', 'groq', 'ollama', 'custom', 'anthropic'] as const
export type AiProvider = (typeof AI_PROVIDER_VALUES)[number]

export interface AiProviderPublicSettings {
  readonly provider: AiProvider
  readonly model: string
  readonly baseUrl: string | null
  readonly apiKeyConfigured: boolean
  readonly apiKeyMasked: string | null
  readonly apiKeyLast4: string | null
  readonly apiKeyConfiguredAt: string | null
  readonly lastTestedAt: string | null
  readonly lastTestStatus: 'success' | 'failed' | 'not_tested' | null
  readonly lastTestError: string | null
  readonly supportedForChat: boolean
  readonly embeddingsEnabled: boolean
  readonly embeddingModel: string | null
  readonly embeddingDimensions: number | null
  readonly embeddingSupported: boolean
  readonly embeddingStatusMessage: string
  readonly lastEmbeddingTestedAt: string | null
  readonly lastEmbeddingTestStatus: 'success' | 'failed' | 'not_tested' | null
  readonly lastEmbeddingTestError: string | null
  readonly multilingualEnabled: boolean
  readonly defaultResponseLanguage: string
  readonly supportedLanguages: readonly string[] | null
  readonly translationModel: string | null
}

export interface AiProviderResolvedConfig {
  readonly source: 'workspace' | 'env'
  readonly provider: AiProvider
  readonly model: string
  readonly baseUrl: string
  readonly apiKey: string
  readonly supportedForChat: boolean
}

export interface AiEmbeddingProviderConfig {
  readonly source: 'workspace' | 'env'
  readonly provider: AiProvider
  readonly model: string
  readonly baseUrl: string
  readonly apiKey: string
  readonly dimensions: number
  readonly supported: boolean
  readonly reason: string | null
}

interface ProviderRow {
  readonly workspace_id: string
  readonly provider: AiProvider
  readonly model: string
  readonly base_url: string | null
  readonly encrypted_api_key: string | null
  readonly api_key_last4: string | null
  readonly api_key_configured_at: string | null
  readonly last_tested_at: string | null
  readonly last_test_status: 'success' | 'failed' | 'not_tested' | null
  readonly last_test_error: string | null
  readonly embeddings_enabled?: boolean | null
  readonly embedding_model?: string | null
  readonly embedding_dimensions?: number | null
  readonly last_embedding_tested_at?: string | null
  readonly last_embedding_test_status?: 'success' | 'failed' | 'not_tested' | null
  readonly last_embedding_test_error?: string | null
  readonly multilingual_enabled?: boolean | null
  readonly default_response_language?: string | null
  readonly supported_languages?: string[] | null
  readonly translation_model?: string | null
}

export function normalizeProvider(value: unknown): AiProvider {
  return typeof value === 'string' && AI_PROVIDER_VALUES.includes(value as AiProvider)
    ? (value as AiProvider)
    : 'openai'
}

export function defaultModelForProvider(provider: AiProvider): string {
  switch (provider) {
    case 'openrouter':
      return 'openai/gpt-4o-mini'
    case 'groq':
      return 'llama-3.1-8b-instant'
    case 'ollama':
      return 'llama3.1'
    case 'anthropic':
      return 'claude-3-5-haiku-latest'
    case 'custom':
      return 'gpt-4o-mini'
    case 'openai':
    default:
      return 'gpt-4o-mini'
  }
}

export function defaultEmbeddingModelForProvider(provider: AiProvider): string {
  switch (provider) {
    case 'openrouter':
      return 'openai/text-embedding-3-small'
    case 'ollama':
      return 'nomic-embed-text'
    case 'custom':
    case 'openai':
    default:
      return 'text-embedding-3-small'
  }
}

export function defaultBaseUrlForProvider(provider: AiProvider): string {
  switch (provider) {
    case 'openrouter':
      return 'https://openrouter.ai/api/v1'
    case 'groq':
      return 'https://api.groq.com/openai/v1'
    case 'ollama':
      return 'http://localhost:11434/v1'
    case 'custom':
      return ''
    case 'anthropic':
      return 'https://api.anthropic.com'
    case 'openai':
    default:
      return 'https://api.openai.com/v1'
  }
}

export function providerSupportsChat(provider: AiProvider): boolean {
  return provider !== 'anthropic'
}

export function providerSupportsEmbeddings(provider: AiProvider): boolean {
  return provider === 'openai' || provider === 'openrouter' || provider === 'custom' || provider === 'ollama'
}

export function maskApiKey(last4: string | null | undefined): string | null {
  return last4 ? `•••• ${last4}` : null
}

export function readApiKeyLast4(apiKey: string): string {
  return apiKey.trim().slice(-4)
}

export async function getPublicProviderSettings(workspaceId: string): Promise<AiProviderPublicSettings> {
  const { data, error } = await supabaseAdmin()
    .from('ai_chatbot_provider_settings')
    .select('workspace_id, provider, model, base_url, encrypted_api_key, api_key_last4, api_key_configured_at, last_tested_at, last_test_status, last_test_error, embeddings_enabled, embedding_model, embedding_dimensions, last_embedding_tested_at, last_embedding_test_status, last_embedding_test_error, multilingual_enabled, default_response_language, supported_languages, translation_model')
    .eq('workspace_id', workspaceId)
    .maybeSingle<ProviderRow>()

  if (error) throw new Error(error.message)
  if (!data) {
    const provider = 'openai'
    return {
      provider,
      model: defaultModelForProvider(provider),
      baseUrl: defaultBaseUrlForProvider(provider),
      apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
      apiKeyMasked: process.env.OPENAI_API_KEY ? 'Server default configured' : null,
      apiKeyLast4: null,
      apiKeyConfiguredAt: null,
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestError: null,
      supportedForChat: true,
      embeddingsEnabled: Boolean(process.env.AI_EMBEDDING_API_KEY || process.env.OPENAI_API_KEY),
      embeddingModel: process.env.AI_EMBEDDING_MODEL || defaultEmbeddingModelForProvider(provider),
      embeddingDimensions: readPositiveInteger(process.env.AI_EMBEDDING_DIMENSIONS, 1536),
      embeddingSupported: true,
      embeddingStatusMessage: process.env.AI_EMBEDDING_API_KEY || process.env.OPENAI_API_KEY
        ? 'Server fallback embeddings are configured.'
        : 'Embedding API key is not configured.',
      lastEmbeddingTestedAt: null,
      lastEmbeddingTestStatus: null,
      lastEmbeddingTestError: null,
      multilingualEnabled: false,
      defaultResponseLanguage: 'auto',
      supportedLanguages: null,
      translationModel: null,
    }
  }
  const embeddingSupported = providerSupportsEmbeddings(data.provider)

  return {
    provider: data.provider,
    model: data.model,
    baseUrl: data.base_url,
    apiKeyConfigured: Boolean(data.encrypted_api_key),
    apiKeyMasked: maskApiKey(data.api_key_last4),
    apiKeyLast4: data.api_key_last4,
    apiKeyConfiguredAt: data.api_key_configured_at,
    lastTestedAt: data.last_tested_at,
    lastTestStatus: data.last_test_status,
    lastTestError: data.last_test_error,
    supportedForChat: providerSupportsChat(data.provider),
    embeddingsEnabled: Boolean(data.embeddings_enabled),
    embeddingModel: data.embedding_model ?? defaultEmbeddingModelForProvider(data.provider),
    embeddingDimensions: data.embedding_dimensions ?? 1536,
    embeddingSupported,
    embeddingStatusMessage: embeddingSupported
      ? 'Embeddings can use this workspace provider key.'
      : 'This provider does not support embeddings. Semantic search is disabled, but exact and keyword search still work.',
    lastEmbeddingTestedAt: data.last_embedding_tested_at ?? null,
    lastEmbeddingTestStatus: data.last_embedding_test_status ?? null,
    lastEmbeddingTestError: data.last_embedding_test_error ?? null,
    multilingualEnabled: Boolean(data.multilingual_enabled),
    defaultResponseLanguage: data.default_response_language || 'auto',
    supportedLanguages: normalizeSupportedLanguages(data.supported_languages),
    translationModel: data.translation_model ?? null,
  }
}

export async function saveProviderSettings(args: {
  readonly workspaceId: string
  readonly provider: AiProvider
  readonly model: string
  readonly baseUrl?: string | null
  readonly apiKey?: string | null
  readonly embeddingsEnabled?: boolean
  readonly embeddingModel?: string | null
  readonly embeddingDimensions?: number | null
  readonly multilingualEnabled?: boolean
  readonly defaultResponseLanguage?: string | null
  readonly supportedLanguages?: readonly string[] | null
  readonly translationModel?: string | null
}): Promise<AiProviderPublicSettings> {
  const admin = supabaseAdmin()
  const apiKey = args.apiKey?.trim()
  const previous = await admin
    .from('ai_chatbot_provider_settings')
    .select('encrypted_api_key, api_key_last4, api_key_configured_at')
    .eq('workspace_id', args.workspaceId)
    .maybeSingle<Pick<ProviderRow, 'encrypted_api_key' | 'api_key_last4' | 'api_key_configured_at'>>()

  if (previous.error) throw new Error(previous.error.message)

  const encryptedApiKey = apiKey ? encrypt(apiKey) : previous.data?.encrypted_api_key ?? null
  const apiKeyLast4 = apiKey ? readApiKeyLast4(apiKey) : previous.data?.api_key_last4 ?? null
  const apiKeyConfiguredAt = apiKey
    ? new Date().toISOString()
    : previous.data?.api_key_configured_at ?? null

  const { error } = await admin.from('ai_chatbot_provider_settings').upsert(
    {
      workspace_id: args.workspaceId,
      provider: args.provider,
      model: args.model.trim() || defaultModelForProvider(args.provider),
      base_url: normalizeBaseUrl(args.baseUrl ?? defaultBaseUrlForProvider(args.provider)),
      encrypted_api_key: encryptedApiKey,
      api_key_last4: apiKeyLast4,
      api_key_configured_at: apiKeyConfiguredAt,
      last_test_status: apiKey ? 'not_tested' : undefined,
      last_test_error: apiKey ? null : undefined,
      embeddings_enabled: Boolean(args.embeddingsEnabled),
      embedding_model: (args.embeddingModel?.trim() || defaultEmbeddingModelForProvider(args.provider)).slice(0, 160),
      embedding_dimensions: clampEmbeddingDimensions(args.embeddingDimensions),
      multilingual_enabled: Boolean(args.multilingualEnabled),
      default_response_language: normalizeLanguageCode(args.defaultResponseLanguage || 'auto'),
      supported_languages: normalizeSupportedLanguages(args.supportedLanguages),
      translation_model: args.translationModel?.trim() ? args.translationModel.trim().slice(0, 160) : null,
      last_embedding_test_status: apiKey || args.embeddingsEnabled !== undefined ? 'not_tested' : undefined,
      last_embedding_test_error: apiKey || args.embeddingsEnabled !== undefined ? null : undefined,
    },
    { onConflict: 'workspace_id' },
  )
  if (error) throw new Error(error.message)
  return getPublicProviderSettings(args.workspaceId)
}

export async function resolveLanguageSettings(workspaceId: string): Promise<{
  readonly multilingualEnabled: boolean
  readonly defaultResponseLanguage: string
  readonly supportedLanguages: readonly string[] | null
}> {
  const settings = await getPublicProviderSettings(workspaceId)
  return {
    multilingualEnabled: settings.multilingualEnabled,
    defaultResponseLanguage: settings.defaultResponseLanguage,
    supportedLanguages: settings.supportedLanguages,
  }
}

export async function resolveTranslationModel(workspaceId: string, fallbackModel: string): Promise<string> {
  const { data } = await supabaseAdmin()
    .from('ai_chatbot_provider_settings')
    .select('translation_model')
    .eq('workspace_id', workspaceId)
    .maybeSingle<Pick<ProviderRow, 'translation_model'>>()
  return data?.translation_model?.trim() || fallbackModel
}

export async function resolveAiProviderConfig(workspaceId?: string | null): Promise<AiProviderResolvedConfig | null> {
  if (workspaceId) {
    const { data, error } = await supabaseAdmin()
      .from('ai_chatbot_provider_settings')
      .select('workspace_id, provider, model, base_url, encrypted_api_key, api_key_last4, api_key_configured_at, last_tested_at, last_test_status, last_test_error, embeddings_enabled, embedding_model, embedding_dimensions, last_embedding_tested_at, last_embedding_test_status, last_embedding_test_error')
      .eq('workspace_id', workspaceId)
      .maybeSingle<ProviderRow>()

    if (error) throw new Error(error.message)
    if (data?.encrypted_api_key && providerSupportsChat(data.provider)) {
      return {
        source: 'workspace',
        provider: data.provider,
        model: data.model || defaultModelForProvider(data.provider),
        baseUrl: normalizeBaseUrl(data.base_url || defaultBaseUrlForProvider(data.provider)),
        apiKey: decrypt(data.encrypted_api_key),
        supportedForChat: true,
      }
    }
  }

  if (!process.env.OPENAI_API_KEY) return null
  return {
    source: 'env',
    provider: 'openai',
    model: process.env.AI_CHATBOT_MODEL || defaultModelForProvider('openai'),
    baseUrl: normalizeBaseUrl(process.env.AI_CHATBOT_BASE_URL || defaultBaseUrlForProvider('openai')),
    apiKey: process.env.OPENAI_API_KEY,
    supportedForChat: true,
  }
}

export async function resolveAiEmbeddingProviderConfig(workspaceId?: string | null): Promise<AiEmbeddingProviderConfig> {
  if (workspaceId) {
    const { data, error } = await supabaseAdmin()
      .from('ai_chatbot_provider_settings')
      .select('workspace_id, provider, model, base_url, encrypted_api_key, embeddings_enabled, embedding_model, embedding_dimensions')
      .eq('workspace_id', workspaceId)
      .maybeSingle<Pick<ProviderRow, 'workspace_id' | 'provider' | 'model' | 'base_url' | 'encrypted_api_key' | 'embeddings_enabled' | 'embedding_model' | 'embedding_dimensions'>>()

    if (error) throw new Error(error.message)
    if (data?.embeddings_enabled) {
      if (!providerSupportsEmbeddings(data.provider)) {
        return unsupportedEmbeddingConfig(data.provider, 'This provider does not support embeddings. Semantic search is disabled, but exact and keyword search still work.')
      }
      if (!data.encrypted_api_key) {
        return unsupportedEmbeddingConfig(data.provider, 'Embedding API key is not configured.')
      }
      return {
        source: 'workspace',
        provider: data.provider,
        model: data.embedding_model || defaultEmbeddingModelForProvider(data.provider),
        baseUrl: normalizeBaseUrl(data.base_url || defaultBaseUrlForProvider(data.provider)),
        apiKey: decrypt(data.encrypted_api_key),
        dimensions: data.embedding_dimensions ?? 1536,
        supported: true,
        reason: null,
      }
    }
  }

  const apiKey = process.env.AI_EMBEDDING_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return unsupportedEmbeddingConfig('openai', 'Embedding API key is not configured.')
  return {
    source: 'env',
    provider: 'openai',
    model: process.env.AI_EMBEDDING_MODEL || defaultEmbeddingModelForProvider('openai'),
    baseUrl: normalizeBaseUrl(process.env.AI_EMBEDDING_BASE_URL || defaultBaseUrlForProvider('openai')),
    apiKey,
    dimensions: readPositiveInteger(process.env.AI_EMBEDDING_DIMENSIONS, 1536),
    supported: true,
    reason: null,
  }
}

function unsupportedEmbeddingConfig(provider: AiProvider, reason: string): AiEmbeddingProviderConfig {
  return {
    source: 'workspace',
    provider,
    model: defaultEmbeddingModelForProvider(provider),
    baseUrl: defaultBaseUrlForProvider(provider),
    apiKey: '',
    dimensions: 1536,
    supported: false,
    reason,
  }
}

export async function testProviderConnection(workspaceId: string): Promise<{
  readonly ok: boolean
  readonly message: string
  readonly settings: AiProviderPublicSettings
}> {
  const config = await resolveAiProviderConfig(workspaceId)
  if (!config) {
    await markProviderTest(workspaceId, false, 'API key is not configured.')
    return {
      ok: false,
      message: 'API key is not configured.',
      settings: await getPublicProviderSettings(workspaceId),
    }
  }
  if (!config.supportedForChat) {
    await markProviderTest(workspaceId, false, 'This provider is saved but not supported for chat yet.')
    return {
      ok: false,
      message: 'This provider is saved but not supported for chat yet.',
      settings: await getPublicProviderSettings(workspaceId),
    }
  }

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 5,
        messages: [
          { role: 'system', content: 'Reply with OK only.' },
          { role: 'user', content: 'Connection test' },
        ],
      }),
    })

    if (!response.ok) {
      await markProviderTest(workspaceId, false, `Provider returned HTTP ${response.status}.`)
      return {
        ok: false,
        message: `Provider returned HTTP ${response.status}.`,
        settings: await getPublicProviderSettings(workspaceId),
      }
    }

    await markProviderTest(workspaceId, true, null)
    return {
      ok: true,
      message: 'AI provider connection works.',
      settings: await getPublicProviderSettings(workspaceId),
    }
  } catch {
    await markProviderTest(workspaceId, false, 'Provider connection failed.')
    return {
      ok: false,
      message: 'Provider connection failed.',
      settings: await getPublicProviderSettings(workspaceId),
    }
  }
}

async function markProviderTest(workspaceId: string, ok: boolean, error: string | null): Promise<void> {
  await supabaseAdmin()
    .from('ai_chatbot_provider_settings')
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_status: ok ? 'success' : 'failed',
      last_test_error: error,
    })
    .eq('workspace_id', workspaceId)
}

function normalizeBaseUrl(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '')
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function clampEmbeddingDimensions(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return 1536
  return Math.max(128, Math.min(4096, value))
}

function normalizeLanguageCode(value: string | null | undefined): string {
  const normalized = (value ?? 'auto').trim().toLowerCase().replace(/[^a-z-]/g, '')
  return normalized || 'auto'
}

function normalizeSupportedLanguages(value: readonly string[] | null | undefined): string[] | null {
  if (!Array.isArray(value)) return null
  const languages = [...new Set(value.map(normalizeLanguageCode).filter((code) => code && code !== 'auto'))].slice(0, 50)
  return languages.length > 0 ? languages : null
}
