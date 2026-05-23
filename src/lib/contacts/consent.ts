export const OPT_IN_SOURCES = [
  'Manual',
  'Website form',
  'Facebook ad',
  'Customer messaged first',
  'CSV import',
  'Other',
] as const

export const OPT_OUT_REASONS = [
  'STOP',
  'UNSUBSCRIBE',
  'Customer request',
  'Admin action',
  'Other',
] as const

const TRUE_VALUES = new Set(['yes', 'true', '1', 'subscribed', 'opted-in', 'opted in'])
const FALSE_VALUES = new Set(['no', 'false', '0', 'not subscribed', 'not opted-in', 'not opted in'])
const OPTED_OUT_VALUES = new Set(['unsubscribed', 'opted-out', 'opted out'])

const OPT_OUT_KEYWORDS = new Set(['stop', 'unsubscribe', 'cancel', 'remove', 'opt out', 'optout'])
const OPT_IN_KEYWORDS = new Set(['start', 'subscribe', 'opt in', 'optin'])

type ContactLike = {
  phone?: string | null
  whatsapp_opt_in?: boolean | null
  opted_out_at?: string | null
  opted_in?: boolean | null
  opted_out?: boolean | null
  is_opted_in?: boolean | null
  is_opted_out?: boolean | null
  unsubscribed?: boolean | null
}

interface CsvConsentRow {
  whatsapp_opt_in?: unknown
  opt_in?: unknown
  subscribed?: unknown
  consent?: unknown
  opt_in_source?: unknown
  opted_out?: unknown
  unsubscribed?: unknown
  opt_out_reason?: unknown
}

export type ConsentStatus = 'opted_in' | 'opted_out' | 'not_opted_in'

export interface ParsedCsvConsent {
  whatsapp_opt_in: boolean
  opt_in_source: string | null
  opted_out_at: string | null
  opt_out_reason: string | null
  opted_in_at: string | null
  last_consent_updated_at: string | null
}

export interface InboundConsentUpdate {
  whatsapp_opt_in: boolean
  opted_in_at?: string
  opt_in_source?: string
  opted_out_at?: string | null
  opt_out_reason?: string | null
  last_consent_updated_at: string
}

export function buildManualConsentUpdate(args: {
  whatsappOptIn: boolean
  optInSource?: string | null
  optedOut: boolean
  optOutReason?: string | null
  previousOptedInAt?: string | null
  previousOptedOutAt?: string | null
  now?: string
}) {
  const now = args.now ?? new Date().toISOString()
  if (args.optedOut) {
    return {
      whatsapp_opt_in: false,
      opt_in_source: null,
      opted_in_at: null,
      opted_out_at: args.previousOptedOutAt ?? now,
      opt_out_reason: args.optOutReason ?? 'Admin action',
      last_consent_updated_at: now,
    }
  }

  if (args.whatsappOptIn) {
    return {
      whatsapp_opt_in: true,
      opt_in_source: args.optInSource ?? 'Manual',
      opted_in_at: args.previousOptedInAt ?? now,
      opted_out_at: null,
      opt_out_reason: null,
      last_consent_updated_at: now,
    }
  }

  return {
    whatsapp_opt_in: false,
    opt_in_source: null,
    opted_in_at: null,
    opted_out_at: null,
    opt_out_reason: null,
    last_consent_updated_at: now,
  }
}

function normalized(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

export function parseConsentBoolean(value: unknown): boolean | null {
  const v = normalized(value)
  if (!v) return null
  if (TRUE_VALUES.has(v)) return true
  if (FALSE_VALUES.has(v) || OPTED_OUT_VALUES.has(v)) return false
  return null
}

export function parseOptOutBoolean(value: unknown): boolean | null {
  const v = normalized(value)
  if (!v) return null
  if (OPTED_OUT_VALUES.has(v) || TRUE_VALUES.has(v)) return true
  if (FALSE_VALUES.has(v)) return false
  return null
}

export function parseCsvConsent(row: CsvConsentRow, now = new Date().toISOString()): ParsedCsvConsent {
  const optOutRaw = row.opted_out ?? row.unsubscribed
  const optOut = parseOptOutBoolean(optOutRaw)
  if (optOut === true) {
    return {
      whatsapp_opt_in: false,
      opt_in_source: null,
      opted_in_at: null,
      opted_out_at: now,
      opt_out_reason: String(row.opt_out_reason ?? 'CSV import').trim() || 'CSV import',
      last_consent_updated_at: now,
    }
  }

  const optInRaw = row.whatsapp_opt_in ?? row.opt_in ?? row.subscribed ?? row.consent
  const optedIn = parseConsentBoolean(optInRaw) === true

  return {
    whatsapp_opt_in: optedIn,
    opt_in_source: optedIn
      ? String(row.opt_in_source ?? 'CSV import').trim() || 'CSV import'
      : null,
    opted_in_at: optedIn ? now : null,
    opted_out_at: null,
    opt_out_reason: null,
    last_consent_updated_at: optedIn ? now : null,
  }
}

export function getContactConsentStatus(contact: ContactLike | null | undefined): ConsentStatus {
  if (!contact) return 'not_opted_in'
  if (contact.opted_out_at || contact.opted_out || contact.is_opted_out || contact.unsubscribed) {
    return 'opted_out'
  }
  if (contact.whatsapp_opt_in === true || contact.opted_in === true || contact.is_opted_in === true) {
    return 'opted_in'
  }
  return 'not_opted_in'
}

export function getBroadcastConsentEligibility(contact: ContactLike | null | undefined): {
  eligible: boolean
  reason?: string
} {
  if (!contact) return { eligible: false, reason: 'Contact no longer exists.' }
  if (!contact.phone) return { eligible: false, reason: 'Contact has no phone number.' }

  const status = getContactConsentStatus(contact)
  if (status === 'opted_out') return { eligible: false, reason: 'Contact is opted out.' }
  if (status !== 'opted_in') return { eligible: false, reason: 'Contact is not opted in.' }
  return { eligible: true }
}

export function automationSendSkipReasonFromConsent(contact: ContactLike): string | null {
  const status = getContactConsentStatus(contact)
  if (status === 'opted_out') return 'contact is opted out'
  return null
}

export function inboundConsentUpdate(messageText: unknown, now = new Date().toISOString()): InboundConsentUpdate | null {
  const text = normalized(messageText)
  if (!text) return null

  if (OPT_OUT_KEYWORDS.has(text)) {
    return {
      whatsapp_opt_in: false,
      opted_out_at: now,
      opt_out_reason: `keyword:${text}`,
      last_consent_updated_at: now,
    }
  }

  if (OPT_IN_KEYWORDS.has(text)) {
    return {
      whatsapp_opt_in: true,
      opted_in_at: now,
      opt_in_source: 'inbound_keyword',
      opted_out_at: null,
      opt_out_reason: null,
      last_consent_updated_at: now,
    }
  }

  return null
}
