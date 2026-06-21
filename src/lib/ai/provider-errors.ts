import type { AiProvider } from '@/lib/ai/provider'

export type AiProviderRequestType = 'chat' | 'embeddings' | 'provider-test' | 'ai-structuring'

export type AiFailureCategory =
  | 'provider_error'
  | 'provider_rate_limited'
  | 'provider_quota_or_billing'
  | 'provider_invalid_key'
  | 'provider_invalid_model'
  | 'missing_knowledge'
  | 'weak_retrieval'
  | 'guardrail_blocked'
  | 'cross_entity_fact_mix'
  | 'calculation_unsupported'
  | 'cooldown'
  | 'human_requested'
  | 'ai_disabled'
  | 'unsupported_message_type'
  | 'webhook_or_send_failure'
  | 'unknown_error'

export interface SafeProviderError {
  readonly status: number | null
  readonly provider: AiProvider | string
  readonly model: string | null
  readonly requestType: AiProviderRequestType
  readonly errorType: string | null
  readonly errorCode: string | null
  readonly errorMessage: string | null
  readonly category: AiFailureCategory
  readonly reason: string
  readonly adminMessage: string
}

export class AiProviderRequestError extends Error {
  readonly safe: SafeProviderError

  constructor(safe: SafeProviderError) {
    super(safe.adminMessage)
    this.name = 'AiProviderRequestError'
    this.safe = safe
  }
}

export async function parseProviderErrorResponse(args: {
  readonly response: Response
  readonly provider: AiProvider | string
  readonly model?: string | null
  readonly requestType: AiProviderRequestType
}): Promise<SafeProviderError> {
  const safePayload = await readSafeErrorPayload(args.response)
  const errorType = readString(safePayload, ['error', 'type']) ?? readString(safePayload, ['type'])
  const errorCode = readString(safePayload, ['error', 'code']) ?? readString(safePayload, ['code'])
  const errorMessage =
    readString(safePayload, ['error', 'message']) ??
    readString(safePayload, ['message']) ??
    readString(safePayload, ['detail'])

  return buildSafeProviderError({
    status: args.response.status,
    provider: args.provider,
    model: args.model ?? null,
    requestType: args.requestType,
    errorType,
    errorCode,
    errorMessage,
  })
}

export function buildSafeProviderError(args: {
  readonly status: number | null
  readonly provider: AiProvider | string
  readonly model?: string | null
  readonly requestType: AiProviderRequestType
  readonly errorType?: string | null
  readonly errorCode?: string | null
  readonly errorMessage?: string | null
}): SafeProviderError {
  const status = args.status
  const normalizedCode = normalizeErrorToken(args.errorCode)
  const normalizedType = normalizeErrorToken(args.errorType)
  const normalizedMessage = normalizeErrorMessage(args.errorMessage)
  const combined = [normalizedCode, normalizedType, normalizedMessage].filter(Boolean).join(' ').toLowerCase()
  const category = classifyProviderError(status, combined)
  const reason = reasonForCategory(category, status)
  const adminMessage = buildAdminMessage({
    status,
    provider: args.provider,
    category,
    message: normalizedMessage,
  })

  return {
    status,
    provider: args.provider,
    model: args.model ?? null,
    requestType: args.requestType,
    errorType: normalizedType,
    errorCode: normalizedCode,
    errorMessage: normalizedMessage,
    category,
    reason,
    adminMessage,
  }
}

export function safeProviderErrorFromUnknown(args: {
  readonly error: unknown
  readonly provider: AiProvider | string
  readonly model?: string | null
  readonly requestType: AiProviderRequestType
}): SafeProviderError {
  if (args.error instanceof AiProviderRequestError) return args.error.safe
  const message = args.error instanceof Error ? args.error.message : null
  return buildSafeProviderError({
    status: null,
    provider: args.provider,
    model: args.model,
    requestType: args.requestType,
    errorMessage: message,
  })
}

export function failureCategoryFromReason(reason: string): AiFailureCategory {
  if (reason === 'provider_rate_limited') return 'provider_rate_limited'
  if (reason === 'provider_quota_or_billing') return 'provider_quota_or_billing'
  if (reason === 'provider_invalid_key') return 'provider_invalid_key'
  if (reason === 'provider_invalid_model') return 'provider_invalid_model'
  if (reason.startsWith('provider_') || reason === 'ai_provider_exception' || reason === 'empty_ai_response') return 'provider_error'
  if (
    reason === 'no_relevant_knowledge' ||
    reason === 'no_active_knowledge' ||
    reason === 'unsupported_exact_fact' ||
    reason === 'model_fallback' ||
    reason === 'model_fallback_after_retry' ||
    reason === 'unsupported_claims_after_retry'
  ) {
    return 'missing_knowledge'
  }
  if (reason === 'weak_retrieval') return 'weak_retrieval'
  if (reason.includes('guardrail') || reason.includes('ungrounded') || reason.includes('numeric')) return 'guardrail_blocked'
  if (reason === 'cross_entity_fact_mix') return 'cross_entity_fact_mix'
  if (reason === 'calculation_unsupported') return 'calculation_unsupported'
  if (reason === 'cooldown') return 'cooldown'
  if (reason === 'human_requested') return 'human_requested'
  if (reason === 'ai_disabled' || reason === 'ai_provider_missing') return 'ai_disabled'
  if (reason === 'unsupported_message_type') return 'unsupported_message_type'
  if (reason === 'webhook_or_send_failure') return 'webhook_or_send_failure'
  return 'unknown_error'
}

export function suggestedActionForFailure(category: AiFailureCategory): string {
  switch (category) {
    case 'provider_rate_limited':
      return 'Wait and retry, reduce request volume, or increase provider rate limits.'
    case 'provider_quota_or_billing':
      return 'Check API Platform billing, quota, and usage limits.'
    case 'provider_invalid_key':
      return 'Update and test the AI provider API key.'
    case 'provider_invalid_model':
      return 'Choose a model available for this API key/provider.'
    case 'provider_error':
      return 'Test the AI provider connection and review the safe provider error.'
    case 'missing_knowledge':
      return 'Add the missing answer to the knowledge base.'
    case 'weak_retrieval':
      return 'Review retrieved evidence or improve the knowledge wording.'
    case 'guardrail_blocked':
      return 'Review the source evidence and answer guardrail result.'
    case 'cross_entity_fact_mix':
      return 'Review pricing/fact boundaries for similar products or plans.'
    case 'calculation_unsupported':
      return 'Add the exact numbers needed for a safe calculation.'
    case 'cooldown':
      return 'Wait for the auto-reply cooldown to expire.'
    case 'human_requested':
      return 'Answer manually or continue the human handoff.'
    case 'ai_disabled':
      return 'Enable AI chatbot and confirm provider settings.'
    case 'unsupported_message_type':
      return 'Answer manually or ask the customer to send text.'
    case 'webhook_or_send_failure':
      return 'Check WhatsApp delivery/webhook status.'
    case 'unknown_error':
    default:
      return 'Review debug details and answer manually if needed.'
  }
}

async function readSafeErrorPayload(response: Response): Promise<unknown> {
  if (typeof response.text !== 'function') return null
  const text = await response.text().catch(() => '')
  if (!text) return null
  const limited = text.slice(0, 2_000)
  try {
    return JSON.parse(limited)
  } catch {
    return { message: limited }
  }
}

function classifyProviderError(status: number | null, combined: string): AiFailureCategory {
  if (status === 401 || status === 403 || /\b(invalid api key|incorrect api key|unauthorized|forbidden|authentication)\b/.test(combined)) {
    return 'provider_invalid_key'
  }
  if (/\b(model_not_found|invalid_model|model not found|does not exist|not available|model access)\b/.test(combined)) {
    return 'provider_invalid_model'
  }
  if (status === 402 || /\b(insufficient_quota|quota|billing|payment|required balance|credits? exhausted|credit balance)\b/.test(combined)) {
    return 'provider_quota_or_billing'
  }
  if (status === 429 || /\b(rate limit|rate_limit|too many requests|temporarily overloaded)\b/.test(combined)) {
    return 'provider_rate_limited'
  }
  return 'provider_error'
}

function reasonForCategory(category: AiFailureCategory, status: number | null): string {
  if (category !== 'provider_error') return category
  return status ? `provider_http_${status}` : 'provider_error'
}

function buildAdminMessage(args: {
  readonly status: number | null
  readonly provider: AiProvider | string
  readonly category: AiFailureCategory
  readonly message: string | null
}): string {
  const providerLabel = providerLabelForMessage(args.provider)
  const statusText = args.status ? ` returned HTTP ${args.status}` : ' request failed'
  switch (args.category) {
    case 'provider_rate_limited':
      if (args.provider === 'openai' && args.status === 429) {
        return 'OpenAI API returned HTTP 429. This can mean rate limit, quota, billing, project/org limit, or model access issue. ChatGPT Plus does not include OpenAI API usage. Please check API Platform billing, usage limits, and model access.'
      }
      return `${providerLabel}${statusText}. Rate limit reached. Wait and retry, or reduce request volume.`
    case 'provider_quota_or_billing':
      return `${providerLabel}${statusText}. API quota or billing issue. Please check API Platform billing and usage limits.`
    case 'provider_invalid_model':
      return `${providerLabel}${statusText}. Selected model is not available for this API key/provider.`
    case 'provider_invalid_key':
      return `${providerLabel}${statusText}. API key is invalid or unauthorized.`
    case 'provider_error':
    default:
      return `${providerLabel}${statusText}.${args.message ? ` ${args.message}` : ''}`.slice(0, 500)
  }
}

function providerLabelForMessage(provider: AiProvider | string): string {
  if (provider === 'openai') return 'OpenAI API'
  if (provider === 'openrouter') return 'OpenRouter API'
  return 'AI provider'
}

function normalizeErrorToken(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().replace(/[^\w.-]/g, '_').slice(0, 120)
  return normalized || null
}

function normalizeErrorMessage(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/gi, '[redacted-api-key]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400)
  return normalized || null
}

function readString(value: unknown, path: readonly string[]): string | null {
  let current = value
  for (const key of path) {
    if (!isRecord(current)) return null
    current = current[key]
  }
  return typeof current === 'string' ? current : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
