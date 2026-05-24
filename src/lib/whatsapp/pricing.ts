export const OFFICIAL_WHATSAPP_PRICING_URL =
  'https://whatsappbusiness.com/products/platform-pricing/'

export type WhatsAppPricingCategory = 'marketing' | 'utility' | 'authentication' | 'service'

export interface WhatsAppPricingRate {
  id?: string
  country_name: string
  iso_country_code: string
  phone_country_code: string
  currency: string
  marketing_rate?: string | number | null
  utility_rate?: string | number | null
  authentication_rate?: string | number | null
  service_rate?: string | number | null
  official_rate_source_url?: string | null
  source_url?: string | null
  source_note?: string | null
  last_verified_at?: string | null
  verified_by_admin?: boolean | null
  notes?: string | null
}

export interface PricingEstimate {
  status: 'ok' | 'missing_rate'
  rateMicros: bigint
  rateDisplay: string
  rawTotalMicros: bigint
  totalDisplay: string
  warnings: string[]
}

export const COMMON_VIEW_CURRENCIES = [
  'USD',
  'PKR',
  'GBP',
  'EUR',
  'AED',
  'TRY',
  'INR',
  'SAR',
  'CAD',
  'AUD',
] as const

export const EXCHANGE_RATE_LAST_UPDATED_AT = '2026-05-24'
export const EXCHANGE_RATE_SOURCE_NOTE = 'Admin-maintained exchange rate'

export const USD_TO_CURRENCY_RATE_MICROS: Record<string, bigint> = {
  AED: BigInt(3_672_500),
  AFN: BigInt(71_000_000),
  ALL: BigInt(92_000_000),
  AMD: BigInt(388_000_000),
  AOA: BigInt(900_000_000),
  ARS: BigInt(900_000_000),
  AUD: BigInt(1_520_000),
  AZN: BigInt(1_700_000),
  BDT: BigInt(117_000_000),
  BGN: BigInt(1_800_000),
  BHD: BigInt(376_000),
  BIF: BigInt(2_875_000_000),
  BOB: BigInt(6_910_000),
  BRL: BigInt(5_200_000),
  BWP: BigInt(13_600_000),
  BYN: BigInt(3_270_000),
  CAD: BigInt(1_370_000),
  CHF: BigInt(900_000),
  CLP: BigInt(940_000_000),
  CNY: BigInt(7_250_000),
  COP: BigInt(3_900_000_000),
  CRC: BigInt(520_000_000),
  CZK: BigInt(23_000_000),
  DKK: BigInt(6_860_000),
  DOP: BigInt(59_000_000),
  DZD: BigInt(134_000_000),
  EGP: BigInt(48_000_000),
  ERN: BigInt(15_000_000),
  ETB: BigInt(57_000_000),
  EUR: BigInt(920_000),
  GBP: BigInt(780_000),
  GEL: BigInt(2_700_000),
  GHS: BigInt(15_000_000),
  GMD: BigInt(68_000_000),
  GTQ: BigInt(7_800_000),
  HKD: BigInt(7_810_000),
  HNL: BigInt(24_700_000),
  HTG: BigInt(132_000_000),
  HUF: BigInt(360_000_000),
  IDR: BigInt(16_200_000_000),
  ILS: BigInt(3_700_000),
  INR: BigInt(83_000_000),
  IQD: BigInt(1_310_000_000),
  JMD: BigInt(156_000_000),
  JOD: BigInt(709_000),
  JPY: BigInt(155_000_000),
  KES: BigInt(130_000_000),
  KHR: BigInt(4_100_000_000),
  KWD: BigInt(307_000),
  LAK: BigInt(21_500_000_000),
  LBP: BigInt(89_500_000_000),
  LKR: BigInt(300_000_000),
  LRD: BigInt(193_000_000),
  LSL: BigInt(18_300_000),
  LYD: BigInt(4_850_000),
  MAD: BigInt(10_000_000),
  MDL: BigInt(17_700_000),
  MGA: BigInt(4_500_000_000),
  MKD: BigInt(56_600_000),
  MNT: BigInt(3_450_000_000),
  MRU: BigInt(39_500_000),
  MWK: BigInt(1_735_000_000),
  MXN: BigInt(17_000_000),
  MYR: BigInt(4_700_000),
  MZN: BigInt(64_000_000),
  NAD: BigInt(18_300_000),
  NGN: BigInt(1_500_000_000),
  NIO: BigInt(36_800_000),
  NOK: BigInt(10_700_000),
  NPR: BigInt(133_000_000),
  NZD: BigInt(1_650_000),
  OMR: BigInt(385_000),
  PEN: BigInt(3_750_000),
  PGK: BigInt(3_850_000),
  PHP: BigInt(58_000_000),
  PKR: BigInt(278_500_000),
  PLN: BigInt(3_950_000),
  PYG: BigInt(7_500_000_000),
  QAR: BigInt(3_640_000),
  RON: BigInt(4_570_000),
  RSD: BigInt(108_000_000),
  RUB: BigInt(92_000_000),
  RWF: BigInt(1_300_000_000),
  SAR: BigInt(3_750_000),
  SDG: BigInt(600_000_000),
  SEK: BigInt(10_500_000),
  SGD: BigInt(1_350_000),
  SLL: BigInt(22_500_000_000),
  SOS: BigInt(571_000_000),
  SSP: BigInt(1_300_000_000),
  SZL: BigInt(18_300_000),
  THB: BigInt(36_500_000),
  TJS: BigInt(10_900_000),
  TMT: BigInt(3_500_000),
  TND: BigInt(3_100_000),
  TRY: BigInt(32_500_000),
  TWD: BigInt(32_300_000),
  TZS: BigInt(2_600_000_000),
  UAH: BigInt(40_500_000),
  UGX: BigInt(3_800_000_000),
  USD: BigInt(1_000_000),
  UYU: BigInt(39_000_000),
  UZS: BigInt(12_600_000_000),
  VES: BigInt(36_500_000),
  VND: BigInt(25_400_000_000),
  XAF: BigInt(600_000_000),
  XOF: BigInt(600_000_000),
  YER: BigInt(250_000_000),
  ZAR: BigInt(18_300_000),
  ZMW: BigInt(26_000_000),
}

export interface CurrencyConversionResult {
  status: 'ok' | 'missing_rate'
  fromCurrency: string
  toCurrency: string
  convertedMicros: bigint
  display: string
  warnings: string[]
  lastUpdatedAt: string
  sourceNote: string
}

export const EXAMPLE_PRICING_RATES = [
  { country_name: 'Pakistan', iso_country_code: 'PK', phone_country_code: '92', currency: 'USD' },
  { country_name: 'Turkey', iso_country_code: 'TR', phone_country_code: '90', currency: 'USD' },
  { country_name: 'United States', iso_country_code: 'US', phone_country_code: '1', currency: 'USD' },
  { country_name: 'United Kingdom', iso_country_code: 'GB', phone_country_code: '44', currency: 'USD' },
  { country_name: 'UAE', iso_country_code: 'AE', phone_country_code: '971', currency: 'USD' },
  { country_name: 'India', iso_country_code: 'IN', phone_country_code: '91', currency: 'USD' },
].map((rate) => ({
  ...rate,
  marketing_rate: '0.000000',
  utility_rate: '0.000000',
  authentication_rate: '0.000000',
  service_rate: '0.000000',
  official_rate_source_url: OFFICIAL_WHATSAPP_PRICING_URL,
  source_note: 'Example only — verify with official Meta calculator.',
  verified_by_admin: false,
  notes: 'Example only — verify with official Meta calculator.',
}))

export function categoryRateField(category: WhatsAppPricingCategory) {
  return `${category}_rate` as const
}

export function parseRateToMicros(value: string | number | null | undefined): bigint | null {
  if (value === null || value === undefined || value === '') return null
  const raw = String(value).trim()
  if (!/^\d+(\.\d+)?$/.test(raw)) return null
  const [whole, fraction = ''] = raw.split('.')
  const micros = `${whole}${fraction.padEnd(6, '0').slice(0, 6)}`
  return BigInt(micros)
}

export function formatMicros(micros: bigint, currency: string, fractionDigits = 2) {
  const zero = BigInt(0)
  const sign = micros < zero ? '-' : ''
  const abs = micros < zero ? -micros : micros
  const divisor = BigInt(1_000_000)
  const whole = abs / divisor
  const remainder = abs % divisor
  const roundingUnit = BigInt(10) ** BigInt(6 - fractionDigits)
  const roundedRemainder = (remainder + roundingUnit / BigInt(2)) / roundingUnit
  const carry = roundedRemainder >= BigInt(10) ** BigInt(fractionDigits) ? BigInt(1) : BigInt(0)
  const cents = carry ? BigInt(0) : roundedRemainder
  return `${currency} ${sign}${whole + carry}.${cents.toString().padStart(fractionDigits, '0')}`
}

export function formatRateMicros(micros: bigint, currency: string) {
  const whole = micros / BigInt(1_000_000)
  const fraction = (micros % BigInt(1_000_000)).toString().padStart(6, '0')
  return `${currency} ${whole}.${fraction}`
}

export function convertMicrosCurrency(args: {
  amountMicros: bigint
  fromCurrency: string
  toCurrency: string
}): CurrencyConversionResult {
  const fromCurrency = args.fromCurrency.toUpperCase()
  const toCurrency = args.toCurrency.toUpperCase()
  const fromRate = USD_TO_CURRENCY_RATE_MICROS[fromCurrency]
  const toRate = USD_TO_CURRENCY_RATE_MICROS[toCurrency]
  const base = {
    fromCurrency,
    toCurrency,
    lastUpdatedAt: EXCHANGE_RATE_LAST_UPDATED_AT,
    sourceNote: EXCHANGE_RATE_SOURCE_NOTE,
  }

  if (!fromRate || !toRate) {
    return {
      ...base,
      status: 'missing_rate',
      convertedMicros: BigInt(0),
      display: 'Conversion rate not configured',
      warnings: [`Conversion rate not configured for ${fromCurrency} to ${toCurrency}.`],
    }
  }

  const convertedMicros = (args.amountMicros * toRate + fromRate / BigInt(2)) / fromRate
  return {
    ...base,
    status: 'ok',
    convertedMicros,
    display: formatMicros(convertedMicros, toCurrency, 2),
    warnings:
      fromCurrency === toCurrency
        ? []
        : [
            'Converted estimate uses admin-maintained exchange rates.',
            'Actual Meta billing and FX conversion may differ.',
          ],
  }
}

export function convertCurrencyTotalsToCurrency(
  totals: Array<{ currency: string; totalMicros: string | bigint }>,
  targetCurrency: string,
): CurrencyConversionResult {
  const target = targetCurrency.toUpperCase()
  let grandTotal = BigInt(0)
  const warnings = new Set<string>()

  for (const total of totals) {
    const amountMicros =
      typeof total.totalMicros === 'bigint' ? total.totalMicros : BigInt(total.totalMicros || '0')
    const converted = convertMicrosCurrency({
      amountMicros,
      fromCurrency: total.currency,
      toCurrency: target,
    })

    if (converted.status === 'missing_rate') {
      return converted
    }

    grandTotal += converted.convertedMicros
    converted.warnings.forEach((warning) => warnings.add(warning))
  }

  return {
    status: 'ok',
    fromCurrency: totals.length === 1 ? totals[0].currency.toUpperCase() : 'MULTIPLE',
    toCurrency: target,
    convertedMicros: grandTotal,
    display: formatMicros(grandTotal, target, 2),
    warnings: [...warnings],
    lastUpdatedAt: EXCHANGE_RATE_LAST_UPDATED_AT,
    sourceNote: EXCHANGE_RATE_SOURCE_NOTE,
  }
}

export function isConvertedCurrencyEstimate(rate: Pick<WhatsAppPricingRate, 'notes'>) {
  return /converted from usd estimate/i.test(rate.notes ?? '')
}

export function pricingWarnings(rate: WhatsAppPricingRate, now = new Date()) {
  const warnings: string[] = []
  if (!rate.last_verified_at) {
    warnings.push('Rate not verified.')
  } else {
    const verifiedAt = new Date(rate.last_verified_at)
    const ageMs = now.getTime() - verifiedAt.getTime()
    if (Number.isFinite(ageMs) && ageMs > 30 * 24 * 60 * 60 * 1000) {
      warnings.push('Rate may be outdated.')
    }
  }
  if (!rate.verified_by_admin) warnings.push('Rate should be verified against Meta official calculator.')
  if (isConvertedCurrencyEstimate(rate)) {
    warnings.push('Converted estimate. Actual Meta billing currency/rate may differ.')
  }
  return warnings
}

export function calculatePricingEstimate(args: {
  rate: WhatsAppPricingRate | null
  category: WhatsAppPricingCategory
  messageCount: number
  now?: Date
}): PricingEstimate {
  if (!args.rate) {
    return {
      status: 'missing_rate',
      rateMicros: BigInt(0),
      rateDisplay: 'Rate not configured',
      rawTotalMicros: BigInt(0),
      totalDisplay: 'Rate not configured',
      warnings: ['Rate not configured.'],
    }
  }

  const rateMicros = parseRateToMicros(args.rate[categoryRateField(args.category)])
  if (rateMicros === null) {
    return {
      status: 'missing_rate',
      rateMicros: BigInt(0),
      rateDisplay: 'Rate not configured',
      rawTotalMicros: BigInt(0),
      totalDisplay: 'Rate not configured',
      warnings: ['Rate not configured.'],
    }
  }

  const count = BigInt(Math.max(0, Math.floor(args.messageCount)))
  const total = rateMicros * count
  return {
    status: 'ok',
    rateMicros,
    rateDisplay: formatRateMicros(rateMicros, args.rate.currency),
    rawTotalMicros: total,
    totalDisplay: formatMicros(total, args.rate.currency, 2),
    warnings: pricingWarnings(args.rate, args.now),
  }
}

const CALLING_CODE_COUNTRIES = [
  { phone_country_code: '971', iso_country_code: 'AE', country_name: 'UAE' },
  { phone_country_code: '977', iso_country_code: 'NP', country_name: 'Nepal' },
  { phone_country_code: '966', iso_country_code: 'SA', country_name: 'Saudi Arabia' },
  { phone_country_code: '258', iso_country_code: 'MZ', country_name: 'Mozambique' },
  { phone_country_code: '923', iso_country_code: 'PK', country_name: 'Pakistan' },
  { phone_country_code: '92', iso_country_code: 'PK', country_name: 'Pakistan' },
  { phone_country_code: '905', iso_country_code: 'TR', country_name: 'Turkey' },
  { phone_country_code: '90', iso_country_code: 'TR', country_name: 'Turkey' },
  { phone_country_code: '447', iso_country_code: 'GB', country_name: 'United Kingdom' },
  { phone_country_code: '44', iso_country_code: 'GB', country_name: 'United Kingdom' },
  { phone_country_code: '91', iso_country_code: 'IN', country_name: 'India' },
  { phone_country_code: '1', iso_country_code: 'US', country_name: 'United States' },
].sort((a, b) => b.phone_country_code.length - a.phone_country_code.length)

export function detectCountryFromPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return CALLING_CODE_COUNTRIES.find((entry) => digits.startsWith(entry.phone_country_code)) ?? null
}

export function findRateForPhone(
  rates: WhatsAppPricingRate[],
  phone: string,
  currency?: string,
): WhatsAppPricingRate | null {
  const detected = detectCountryFromPhone(phone)
  if (!detected) return null
  return (
    rates.find(
      (rate) =>
        rate.iso_country_code.toUpperCase() === detected.iso_country_code &&
        (!currency || rate.currency.toUpperCase() === currency.toUpperCase()),
    ) ?? null
  )
}

export interface BroadcastPricingRecipient {
  phone: string
}

export interface BroadcastPricingBreakdownRow {
  country_name: string
  iso_country_code: string
  currency: string
  category: WhatsAppPricingCategory
  recipientCount: number
  rateDisplay: string
  estimatedTotalDisplay: string
  warnings: string[]
}

export function estimateBroadcastPricingBreakdown(args: {
  rates: WhatsAppPricingRate[]
  recipients: BroadcastPricingRecipient[]
  category: WhatsAppPricingCategory
  currency?: string
}): {
  rows: BroadcastPricingBreakdownRow[]
  missingRateWarnings: string[]
} {
  const buckets = new Map<string, { rate: WhatsAppPricingRate | null; count: number; countryLabel: string }>()
  const missingRateWarnings: string[] = []

  for (const recipient of args.recipients) {
    const detected = detectCountryFromPhone(recipient.phone)
    if (!detected) {
      missingRateWarnings.push(`Could not detect country for ${recipient.phone}.`)
      continue
    }
    const rate = findRateForPhone(args.rates, recipient.phone, args.currency)
    const key = `${detected.iso_country_code}:${rate?.currency ?? args.currency ?? 'unknown'}`
    const existing = buckets.get(key)
    buckets.set(key, {
      rate,
      count: (existing?.count ?? 0) + 1,
      countryLabel: detected.country_name,
    })
  }

  const rows: BroadcastPricingBreakdownRow[] = []
  for (const bucket of buckets.values()) {
    if (!bucket.rate) {
      missingRateWarnings.push(`Rate not configured for ${bucket.countryLabel}.`)
      continue
    }
    const estimate = calculatePricingEstimate({
      rate: bucket.rate,
      category: args.category,
      messageCount: bucket.count,
    })
    rows.push({
      country_name: bucket.rate.country_name,
      iso_country_code: bucket.rate.iso_country_code,
      currency: bucket.rate.currency,
      category: args.category,
      recipientCount: bucket.count,
      rateDisplay: estimate.rateDisplay,
      estimatedTotalDisplay: estimate.totalDisplay,
      warnings: estimate.warnings,
    })
  }

  return { rows, missingRateWarnings }
}
