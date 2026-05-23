import { automationSendSkipReasonFromConsent, getContactConsentStatus } from '@/lib/contacts/consent'

export interface AutomationSendContact {
  opted_in?: boolean | null
  opted_out?: boolean | null
  is_opted_in?: boolean | null
  is_opted_out?: boolean | null
  unsubscribed?: boolean | null
  whatsapp_opt_in?: boolean | null
  opted_out_at?: string | null
}

export function automationSendSkipReason(
  contact: AutomationSendContact,
  options?: { requireOptIn?: boolean },
): string | null {
  const optOutReason = automationSendSkipReasonFromConsent(contact)
  if (optOutReason) return optOutReason
  if (options?.requireOptIn && getContactConsentStatus(contact) !== 'opted_in') {
    return 'contact is not opted in'
  }
  return null
}
