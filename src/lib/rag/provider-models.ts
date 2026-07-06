import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { AI_PROVIDER_CONFIG, CUSTOM_MODEL_OPTION_ID, type RagProviderModelOption } from './provider-config'
import { sanitizeProviderError } from './security'
import { RAG_PROVIDER_TYPES, type RagProviderType } from './types'
import { getSiteUrl } from '@/lib/site-url'

const MODEL_FETCH_TIMEOUT_MS = 15_000

interface RagProviderSettingsSecretRow {
  readonly provider?: string | null
  readonly encrypted_api_key?: string | null
  readonly backend_config?: Record<string, unknown> | null
}

function isRagProviderType(value: string): value is RagProviderType {
  return (RAG_PROVIDER_TYPES as readonly string[]).includes(value)
}

export interface RagProviderModelsResult {
  readonly provider: RagProviderType
  readonly models: ReadonlyArray<RagProviderModelOption>
  readonly source: 'provider' | 'fallback' | 'custom_only'
  readonly message: string | null
}

function modelFromId(provider: RagProviderType, id: string, label?: string): RagProviderModelOption | null {
  const cleanId = id.trim()
  if (!cleanId) return null
  return {
    id: cleanId,
    label: label?.trim() || cleanId,
    provider,
  }
}

function readContextLength(item: Record<string, unknown>): number | undefined {
  const value = item.context_length ?? item.contextLength ?? item.context_window ?? item.contextWindow
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function normalizeModelsPayload(provider: RagProviderType, payload: unknown): ReadonlyArray<RagProviderModelOption> {
  const data = (
    typeof payload === 'object' && payload !== null && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : Array.isArray(payload)
        ? payload
        : []
  )

  const models = data
    .map((item) => {
      if (typeof item === 'string') return modelFromId(provider, item)
      if (typeof item !== 'object' || item === null) return null
      const record = item as Record<string, unknown>
      const id = typeof record.id === 'string'
        ? record.id
        : typeof record.name === 'string'
          ? record.name
          : ''
      const label = typeof record.name === 'string' && record.name !== id
        ? record.name
        : typeof record.label === 'string'
          ? record.label
          : id
      const normalized = modelFromId(provider, id, label)
      if (!normalized) return null
      return {
        ...normalized,
        description: typeof record.description === 'string' ? record.description : undefined,
        contextLength: readContextLength(record),
      }
    })
    .filter((item): item is RagProviderModelOption => item !== null)

  const seen = new Set<string>()
  return models.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function providerHeaders(provider: RagProviderType, apiKey: string): HeadersInit {
  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = getSiteUrl()
    headers['X-OpenRouter-Title'] = 'Talk Wagon RAG Chatbot'
  }
  return headers
}

function modelEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/models`
}

async function fetchProviderModels(args: {
  readonly provider: RagProviderType
  readonly apiKey: string
  readonly baseUrl: string
}): Promise<ReadonlyArray<RagProviderModelOption>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(modelEndpoint(args.baseUrl), {
      method: 'GET',
      headers: providerHeaders(args.provider, args.apiKey),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('AI provider API key is missing, invalid, or rejected.')
      if (response.status === 402) throw new Error('AI provider billing or credits issue. Please check the provider account.')
      if (response.status === 429) throw new Error('AI provider rate limit reached. Please try again later.')
      throw new Error('AI provider model list could not be loaded.')
    }
    return normalizeModelsPayload(args.provider, payload)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI provider model list request timed out.')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function listRagProviderModels(args: {
  readonly workspaceId: string
  readonly provider: RagProviderType
  readonly baseUrl?: string | null
}): Promise<RagProviderModelsResult> {
  const config = AI_PROVIDER_CONFIG[args.provider]
  const fallbackModels = config.fallbackModels
  const baseUrl = (args.baseUrl?.trim() || config.defaultBaseUrl).trim()

  if (args.provider === 'custom_openai_compatible' && !baseUrl) {
    return {
      provider: args.provider,
      models: [],
      source: 'custom_only',
      message: 'Enter a custom model ID and base URL for this provider.',
    }
  }

  const { data, error } = await supabaseAdmin()
    .from('rag_provider_settings')
    .select('provider, encrypted_api_key, backend_config')
    .eq('workspace_id', args.workspaceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const row = data as RagProviderSettingsSecretRow | null
  const savedProvider = isRagProviderType(row?.provider ?? '') ? row!.provider as RagProviderType : null
  const canUseSavedKey = savedProvider === args.provider && Boolean(row?.encrypted_api_key)

  if (!canUseSavedKey) {
    return {
      provider: args.provider,
      models: fallbackModels,
      source: fallbackModels.length > 0 ? 'fallback' : 'custom_only',
      message: fallbackModels.length > 0
        ? 'Using recommended fallback models until this provider key is saved.'
        : config.helperText,
    }
  }

  try {
    const apiKey = decrypt(row!.encrypted_api_key!)
    const models = await fetchProviderModels({ provider: args.provider, apiKey, baseUrl })
    if (models.length > 0) {
      return {
        provider: args.provider,
        models,
        source: 'provider',
        message: 'Models loaded from the selected provider.',
      }
    }
  } catch (error) {
    return {
      provider: args.provider,
      models: fallbackModels,
      source: fallbackModels.length > 0 ? 'fallback' : 'custom_only',
      message: sanitizeProviderError(error),
    }
  }

  return {
    provider: args.provider,
    models: fallbackModels,
    source: fallbackModels.length > 0 ? 'fallback' : 'custom_only',
    message: fallbackModels.length > 0
      ? 'The provider returned no models, so recommended fallback models are shown.'
      : config.helperText,
  }
}

export function withCustomModelOption(
  provider: RagProviderType,
  models: ReadonlyArray<RagProviderModelOption>,
): ReadonlyArray<RagProviderModelOption> {
  return [
    ...models,
    {
      id: CUSTOM_MODEL_OPTION_ID,
      label: 'Add Custom Model',
      provider,
      description: 'Enter a custom model ID exactly as your provider documents it.',
    },
  ]
}
