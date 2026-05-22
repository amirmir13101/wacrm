import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'PK'

export interface NormalizedPhoneResult {
  phone: string
  country?: CountryCode
}

/**
 * Sanitize phone number for Meta WhatsApp API.
 * Meta requires digits only: no plus prefix, spaces, or dashes.
 */
export function sanitizePhoneForMeta(phone: string): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Normalize phone number by removing all non-digit characters.
 * Used for comparing phone numbers in different formats.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

function hasInternationalPrefix(input: string): boolean {
  return /^\s*\+/.test(input) || /^\s*00/.test(input)
}

function parsePossiblePhone(input: string, defaultCountry: CountryCode) {
  const trimmed = input.trim()
  const digits = normalizePhone(trimmed)

  const candidates: string[] = []
  if (hasInternationalPrefix(trimmed)) {
    candidates.push(trimmed.startsWith('00') ? `+${digits.replace(/^00/, '')}` : trimmed)
  } else if (/^[1-9]\d{6,14}$/.test(digits)) {
    candidates.push(`+${digits}`)
    candidates.push(trimmed)
  } else {
    candidates.push(trimmed)
  }

  for (const candidate of candidates) {
    const parsed = candidate.startsWith('+')
      ? parsePhoneNumberFromString(candidate)
      : parsePhoneNumberFromString(candidate, defaultCountry)
    if (parsed?.isPossible()) return parsed
  }

  return undefined
}

/**
 * Normalize a human-entered contact number into the WhatsApp/Meta storage
 * format used by this app: international digits only, with country code.
 *
 * Local/national numbers are interpreted with DEFAULT_PHONE_COUNTRY. Change
 * that constant when the CRM gets a tenant-level country setting.
 */
export function normalizeWhatsAppPhone(
  input: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): NormalizedPhoneResult {
  if (!input.trim()) {
    throw new Error('Phone number is required')
  }

  const parsed = parsePossiblePhone(input, defaultCountry)
  if (!parsed) {
    throw new Error(
      `Enter a valid phone number with country code, or a valid ${defaultCountry} local number.`,
    )
  }

  const phone = normalizePhone(parsed.number)
  if (!isValidE164(phone)) {
    throw new Error('Phone number must include a valid country code and contain 7 to 15 digits.')
  }

  return {
    phone,
    country: parsed.country,
  }
}

export function normalizePhoneForComparison(
  input: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  try {
    return normalizeWhatsAppPhone(input, defaultCountry).phone
  } catch {
    return normalizePhone(input)
  }
}

export function isDuplicatePhoneError(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error?.code === '23505' ||
      /contacts_user_phone_unique|idx_contacts_user_phone_unique|duplicate key/i.test(
        error?.message ?? '',
      ),
  )
}

/**
 * Compare two phone numbers accounting for trunk prefix differences.
 * e.g. "370063949836" (with trunk 0) matches "37063949836" (without trunk 0)
 * by comparing the last 8 digits.
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  const n1 = normalizePhone(phone1)
  const n2 = normalizePhone(phone2)
  if (n1 === n2) return true
  if (n1.length >= 8 && n2.length >= 8) {
    return n1.slice(-8) === n2.slice(-8)
  }
  return false
}

/**
 * Validate phone number is E.164-like format (7-15 digits starting with non-zero).
 * Accepts with or without plus prefix.
 */
export function isValidE164(phone: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(phone)
}

/**
 * Generate plausible phone number variants for retry when Meta's sandbox rejects
 * a number with error #131030 ("not in allowed list").
 */
export function phoneVariants(sanitized: string): string[] {
  if (!sanitized) return []
  const seen = new Set<string>()
  const push = (v: string) => {
    if (v && !seen.has(v)) seen.add(v)
  }

  push(sanitized)

  for (const ccLen of [1, 2, 3]) {
    if (sanitized.length <= ccLen) continue
    const cc = sanitized.slice(0, ccLen)
    const rest = sanitized.slice(ccLen)
    if (!rest.startsWith('0')) {
      push(cc + '0' + rest)
    }
  }

  for (const ccLen of [1, 2, 3]) {
    if (sanitized.length <= ccLen + 1) continue
    const cc = sanitized.slice(0, ccLen)
    const rest = sanitized.slice(ccLen)
    if (rest.startsWith('0')) {
      push(cc + rest.slice(1))
    }
  }

  return [...seen]
}

/**
 * Returns true when the Meta API error indicates the recipient phone number
 * is not in the allowed list (sandbox restriction).
 */
export function isRecipientNotAllowedError(message: string): boolean {
  return /131030|not in allowed list|not in the allowed list/i.test(message)
}
