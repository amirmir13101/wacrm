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
}

export interface AiProviderResolvedConfig {
  readonly source: 'workspace' | 'env'
  readonly provider: AiProvider
  readonly model: string
  readonly baseUrl: string
  readonly apiKey: string
  readonly supportedForChat: boolean
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

export function maskApiKey(last4: string | null | undefined): string | null {
  return last4 ? `•••• ${last4}` : null
}

export function readApiKeyLast4(apiKey: string): string {
  return apiKey.trim().slice(-4)
}

export async function getPublicProviderSettings(workspaceId: string): Promise<AiProviderPublicSettings> {
  const { data, error } = await supabaseAdmin()
    .from('ai_chatbot_provider_settings')
    .select('workspace_id, provider, model, base_url, encrypted_api_key, api_key_last4, api_key_configured_at, last_tested_at, last_test_status, last_test_error')
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
    }
  }

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
  }
}

export async function saveProviderSettings(args: {
  readonly workspaceId: string
  readonly provider: AiProvider
  readonly model: string
  readonly baseUrl?: string | null
  readonly apiKey?: string | null
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
    },
    { onConflict: 'workspace_id' },
  )
  if (error) throw new Error(error.message)
  return getPublicProviderSettings(args.workspaceId)
}

export async function resolveAiProviderConfig(workspaceId?: string | null): Promise<AiProviderResolvedConfig | null> {
  if (workspaceId) {
    const { data, error } = await supabaseAdmin()
      .from('ai_chatbot_provider_settings')
      .select('workspace_id, provider, model, base_url, encrypted_api_key, api_key_last4, api_key_configured_at, last_tested_at, last_test_status, last_test_error')
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
