import { sendTemplateMessage } from '@/lib/whatsapp/meta-api'
import {
  isRecipientNotAllowedError,
  isValidE164,
  phoneVariants,
  sanitizePhoneForMeta,
} from '@/lib/whatsapp/phone-utils'
import {
  classifyBroadcastFailure,
  resolveBroadcastVariables,
  type BroadcastFailureType,
} from '@/lib/broadcast-retry'
import type { Broadcast, Contact, VariableMapping } from '@/types'
import { getBroadcastConsentEligibility } from '@/lib/contacts/consent'

export const BROADCAST_QUEUE_BATCH_SIZE = 10
export const BROADCAST_QUEUE_DELAY_MS = 1000
export const BROADCAST_QUEUE_MAX_ATTEMPTS = 3

export interface QueueEligibilityResult {
  eligible: boolean
  reason?: string
}

export interface QueueSendResult {
  status: 'sent' | 'failed'
  whatsapp_message_id?: string
  error?: string
  failure_type?: BroadcastFailureType
  next_retry_at?: string | null
}

export function getBroadcastContactEligibility(contact: Contact | null): QueueEligibilityResult {
  return getBroadcastConsentEligibility(contact)
}

export function getRetryDelayMs(message: string, attemptCount: number): number | null {
  if (classifyBroadcastFailure(message) !== 'temporary') return null
  return Math.min(15 * 60_000, 60_000 * 2 ** Math.max(0, attemptCount - 1))
}

export function nextRetryAt(message: string, attemptCount: number): string | null {
  const delay = getRetryDelayMs(message, attemptCount)
  if (delay === null) return null
  return new Date(Date.now() + delay).toISOString()
}

export function safeBroadcastSendError(message: string): string {
  if (/132001|template name does not exist in the translation/i.test(message)) {
    return 'Selected template/language is not available in Meta anymore. Please re-sync templates and select the approved template again.'
  }

  return message
}

export async function sendQueuedTemplateRecipient(args: {
  phoneNumberId: string
  accessToken: string
  broadcast: Pick<Broadcast, 'template_name' | 'template_language' | 'template_variables'>
  contact: Contact
  customValues?: Map<string, string>
  attemptCount: number
}): Promise<QueueSendResult> {
  const sanitized = sanitizePhoneForMeta(args.contact.phone)
  if (!isValidE164(sanitized)) {
    return {
      status: 'failed',
      error: 'Invalid phone number format',
      failure_type: 'permanent',
      next_retry_at: null,
    }
  }

  if (!args.broadcast.template_language) {
    return {
      status: 'failed',
      error: 'Selected template has no approved language. Please re-sync templates and select an approved template.',
      failure_type: 'permanent',
      next_retry_at: null,
    }
  }

  const params = resolveBroadcastVariables(
    args.broadcast.template_variables as Record<string, VariableMapping>,
    args.contact,
    args.customValues,
  )

  let lastError = 'Unknown error'
  for (const variant of phoneVariants(sanitized)) {
    try {
      const result = await sendTemplateMessage({
        phoneNumberId: args.phoneNumberId,
        accessToken: args.accessToken,
        to: variant,
        templateName: args.broadcast.template_name,
        language: args.broadcast.template_language,
        params,
      })
      return {
        status: 'sent',
        whatsapp_message_id: result.messageId,
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'
      if (!isRecipientNotAllowedError(lastError)) break
    }
  }

  const failureType = classifyBroadcastFailure(lastError)
  const safeError = safeBroadcastSendError(lastError)
  return {
    status: 'failed',
    error: safeError,
    failure_type: failureType,
    next_retry_at:
      args.attemptCount < BROADCAST_QUEUE_MAX_ATTEMPTS
        ? nextRetryAt(safeError, args.attemptCount)
        : null,
  }
}

export function shouldFinalizeBroadcast(counts: {
  pending: number
  sending: number
  failedRetryable: number
}) {
  return counts.pending === 0 && counts.sending === 0 && counts.failedRetryable === 0
}

export function shouldProcessBroadcastStatus(status: string) {
  return status === 'queued' || status === 'sending'
}

export type QueueStatusAction = 'process' | 'pause' | 'cancel' | 'release'

export function getQueueStatusAction(status: string): QueueStatusAction {
  if (status === 'paused') return 'pause'
  if (status === 'cancelled') return 'cancel'
  if (shouldProcessBroadcastStatus(status)) return 'process'
  return 'release'
}

export function isCronSecretValid(expected: string | undefined, supplied: string | null) {
  if (!expected) return false
  return supplied === expected
}

export function finalBroadcastStatus(counts: { failed: number; sentLike: number; skipped: number }) {
  if (counts.sentLike === 0 && counts.failed > 0) return 'failed' as const
  return 'completed' as const
}
