import type { Contact, RecipientStatus, VariableMapping } from '@/types'

export type BroadcastFailureType = 'temporary' | 'permanent' | 'unknown'

export interface RetryCandidate {
  id: string
  status: RecipientStatus
  contact?: Pick<Contact, 'id' | 'name' | 'phone' | 'email' | 'company'> | null
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

    if (!recipient.contact.phone) {
      skipped.push({
        recipientId: recipient.id,
        reason: 'Contact has no phone number.',
      })
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
