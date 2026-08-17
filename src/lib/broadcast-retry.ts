import type { Contact, RecipientStatus, VariableMapping } from '@/types'
import { getBroadcastConsentEligibility } from '@/lib/contacts/consent'

export type BroadcastFailureType = 'temporary' | 'permanent' | 'unknown'

export interface RetryCandidate {
  id: string
  status: RecipientStatus
  contact?: Pick<
    Contact,
    | 'id'
    | 'name'
    | 'phone'
    | 'email'
    | 'company'
    | 'whatsapp_opt_in'
    | 'opted_out_at'
    | 'opted_in'
    | 'opted_out'
    | 'is_opted_in'
    | 'is_opted_out'
    | 'unsubscribed'
  > | null
}

export interface RetrySkip {
  recipientId: string
  reason: string
}

export function classifyBroadcastFailure(message: string): BroadcastFailureType {
  if (
    /rate limit|too many|temporar|timeout|timed out|network|unavailable|try again|5\d\d|ECONNRESET|ETIMEDOUT/i.test(
      message,
    )
  ) {
    return 'temporary'
  }

  if (
    /invalid phone|not approved|template|blocked|not reachable|not in allowed list|131030|unsupported|permission|recipient/i.test(
      message,
    )
  ) {
    return 'permanent'
  }

  return 'unknown'
}

export function formatBroadcastFailureMessage(args: {
  readonly message: string
  readonly code?: number | string | null
}): string {
  const code = args.code ? String(args.code) : ''
  const message = args.message.trim()
  const combined = `${code} ${message}`

  if (/131026|message undeliverable|unable to deliver|not a whatsapp user|not on whatsapp/i.test(combined)) {
    return 'This phone number may not have an active WhatsApp account, or WhatsApp could not deliver the template to this number.'
  }

  if (/131030|not in allowed list|not in the allowed list/i.test(combined)) {
    return 'This recipient is not allowed for the current WhatsApp test setup. Add the number to the allowed list or use a live approved WhatsApp sender.'
  }

  if (/132001|template name does not exist in the translation/i.test(combined)) {
    return 'Selected template/language is not available in Meta anymore. Please re-sync templates and select the approved template again.'
  }

  if (/131047|outside.*24|re-engagement|customer service window/i.test(combined)) {
    return 'This message was blocked because the conversation is outside the allowed customer-service window. Use an approved template for re-engagement.'
  }

  if (/131049|marketing messages.*paused|healthy ecosystem/i.test(combined)) {
    return 'Meta paused marketing messages to this recipient to protect user experience. Try again later or use another approved conversation path.'
  }

  if (/rate limit|too many requests|throughput|temporar|timeout|timed out|unavailable|5\d\d/i.test(combined)) {
    return 'Meta temporarily could not send this message because of rate limits or service availability. Retry later.'
  }

  if (/permission|OAuth|access token|token|unsupported post request|does not have access/i.test(combined)) {
    return 'WhatsApp credentials or permissions rejected this send. Reconnect WhatsApp or check the Meta app permissions.'
  }

  if (/invalid.*phone|phone.*invalid|recipient.*invalid/i.test(combined)) {
    return 'This recipient phone number is invalid for WhatsApp delivery. Check the country code and number format.'
  }

  if (/blocked/i.test(combined)) {
    return 'This recipient may have blocked the business or cannot currently receive this WhatsApp message.'
  }

  return message || 'Meta did not provide a detailed failure reason for this recipient.'
}

export function getRetryableRecipients<T extends RetryCandidate>(
  recipients: T[],
): { retryable: T[]; skipped: RetrySkip[] } {
  const retryable: T[] = []
  const skipped: RetrySkip[] = []

  for (const recipient of recipients) {
    if (recipient.status !== 'failed') {
      skipped.push({
        recipientId: recipient.id,
        reason: `Recipient status is ${recipient.status}, not failed.`,
      })
      continue
    }

    if (!recipient.contact) {
      skipped.push({
        recipientId: recipient.id,
        reason: 'Contact no longer exists.',
      })
      continue
    }

    const eligibility = getBroadcastConsentEligibility(recipient.contact)
    if (!eligibility.eligible) {
      skipped.push({ recipientId: recipient.id, reason: eligibility.reason ?? 'Contact is not eligible.' })
      continue
    }

    retryable.push(recipient)
  }

  return { retryable, skipped }
}

export function resolveBroadcastVariables(
  variables: Record<string, VariableMapping> | null | undefined,
  contact: Pick<Contact, 'name' | 'phone' | 'email' | 'company'>,
  customValues?: Map<string, string>,
): string[] {
  const vars = variables ?? {}
  const keys = Object.keys(vars).sort((a, b) => {
    const an = Number(a)
    const bn = Number(b)
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn
    return a.localeCompare(b)
  })

  return keys.map((key) => {
    const variable = vars[key]
    if (variable.type === 'static') return variable.value

    if (variable.type === 'field') {
      const fieldMap: Record<string, string | undefined | null> = {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        company: contact.company,
      }
      return fieldMap[variable.value] ?? ''
    }

    return customValues?.get(variable.value) ?? ''
  })
}
