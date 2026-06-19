export type BillingPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type CalculationStatus = 'computed' | 'cannot_compute' | 'conflicting_facts'

export interface CalculationResult {
  readonly status: CalculationStatus
  readonly value: number | null
  readonly formula: string
  readonly unit: string
  readonly sourceChunkIds: readonly string[]
  readonly reason?: string
}

export interface NumericFact {
  readonly kind: 'price' | 'percent' | 'quantity' | 'tax_rate' | 'period_days'
  readonly value: number
  readonly unit?: string | null
  readonly label?: string | null
  readonly sourceChunkId: string
}

export interface PriceFact {
  readonly amount: number
  readonly currency: string
  readonly period?: BillingPeriod | null
  readonly label?: string | null
  readonly sourceChunkId: string
}

export interface PricingTier {
  readonly minQuantity: number
  readonly unitPrice: number
  readonly sourceChunkId: string
}

const DAYS_PER_PERIOD: Record<BillingPeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
}

const BILLING_PERIODS_PER_YEAR: Record<BillingPeriod, number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
}

export function convertBillingPeriod(
  amount: number,
  fromPeriod: BillingPeriod,
  toPeriod: BillingPeriod,
  sourceChunkIds: readonly string[],
  currency = '',
): CalculationResult {
  if (!isFiniteNumber(amount)) return cannotCompute('Base amount is missing or invalid.', currency, sourceChunkIds)
  const yearly = amount * (DAYS_PER_PERIOD.yearly / DAYS_PER_PERIOD[fromPeriod])
  const value = yearly / (DAYS_PER_PERIOD.yearly / DAYS_PER_PERIOD[toPeriod])
  return computed(value, `${amount} ${currency}/${fromPeriod} × (${DAYS_PER_PERIOD[toPeriod]} ÷ ${DAYS_PER_PERIOD[fromPeriod]}) = ${roundMoney(value)} ${currency}/${toPeriod}`, `${currency}/${toPeriod}`.trim(), sourceChunkIds)
}

export function convertBillingTotal(
  amount: number,
  fromPeriod: BillingPeriod,
  toPeriod: BillingPeriod,
  sourceChunkIds: readonly string[],
  currency = '',
): CalculationResult {
  if (!isFiniteNumber(amount)) return cannotCompute('Base amount is missing or invalid.', currency, sourceChunkIds)
  const yearlyTotal = amount * BILLING_PERIODS_PER_YEAR[fromPeriod]
  const value = yearlyTotal / BILLING_PERIODS_PER_YEAR[toPeriod]
  const operator = BILLING_PERIODS_PER_YEAR[toPeriod] > BILLING_PERIODS_PER_YEAR[fromPeriod] ? '÷' : '×'
  const factor = operator === '÷'
    ? BILLING_PERIODS_PER_YEAR[toPeriod] / BILLING_PERIODS_PER_YEAR[fromPeriod]
    : BILLING_PERIODS_PER_YEAR[fromPeriod] / BILLING_PERIODS_PER_YEAR[toPeriod]
  return computed(
    value,
    `${amount} ${currency}/${fromPeriod} ${operator} ${factor} = ${roundMoney(value)} ${currency}/${toPeriod}`,
    `${currency}/${toPeriod}`.trim(),
    sourceChunkIds,
  )
}

export function applyPercentage(
  amount: number,
  percent: number,
  direction: 'discount' | 'markup',
  sourceChunkIds: readonly string[],
  unit = '',
): CalculationResult {
  if (!isFiniteNumber(amount) || !isFiniteNumber(percent)) {
    return cannotCompute('Amount or percent is missing or invalid.', unit, sourceChunkIds)
  }
  const multiplier = direction === 'discount' ? 1 - percent / 100 : 1 + percent / 100
  const value = amount * multiplier
  const sign = direction === 'discount' ? '-' : '+'
  return computed(value, `${amount} ${unit} ${sign} ${percent}% = ${roundMoney(value)} ${unit}`, unit, sourceChunkIds)
}

export function bulkOrTieredPrice(
  unitPrice: number,
  quantity: number,
  sourceChunkIds: readonly string[],
  tiers: readonly PricingTier[] = [],
  unit = '',
): CalculationResult {
  if (!isFiniteNumber(unitPrice) || !isFiniteNumber(quantity) || quantity <= 0) {
    return cannotCompute('Unit price or quantity is missing or invalid.', unit, sourceChunkIds)
  }
  const applicableTier = [...tiers]
    .filter((tier) => quantity >= tier.minQuantity)
    .sort((left, right) => right.minQuantity - left.minQuantity)[0]
  const effectiveUnitPrice = applicableTier?.unitPrice ?? unitPrice
  const value = effectiveUnitPrice * quantity
  const tierText = applicableTier ? ` using tier ${applicableTier.minQuantity}+ at ${effectiveUnitPrice}` : ''
  return computed(
    value,
    `${effectiveUnitPrice} ${unit}/unit × ${quantity}${tierText} = ${roundMoney(value)} ${unit}`,
    unit,
    [...new Set([...sourceChunkIds, ...(applicableTier ? [applicableTier.sourceChunkId] : [])])],
  )
}

export function prorate(
  amount: number,
  totalPeriodDays: number,
  remainingDays: number,
  sourceChunkIds: readonly string[],
  unit = '',
): CalculationResult {
  if (!isFiniteNumber(amount) || !isFiniteNumber(totalPeriodDays) || !isFiniteNumber(remainingDays) || totalPeriodDays <= 0 || remainingDays < 0) {
    return cannotCompute('Amount, total period days, or remaining days are missing or invalid.', unit, sourceChunkIds)
  }
  const value = amount * (remainingDays / totalPeriodDays)
  return computed(value, `${amount} ${unit} × (${remainingDays} ÷ ${totalPeriodDays}) = ${roundMoney(value)} ${unit}`, unit, sourceChunkIds)
}

export function applyTax(
  amount: number,
  taxRatePercent: number,
  mode: 'inclusive' | 'exclusive',
  sourceChunkIds: readonly string[],
  unit = '',
): CalculationResult {
  if (!isFiniteNumber(amount) || !isFiniteNumber(taxRatePercent)) {
    return cannotCompute('Amount or tax rate is missing or invalid.', unit, sourceChunkIds)
  }
  const value = mode === 'exclusive' ? amount * (1 + taxRatePercent / 100) : amount / (1 + taxRatePercent / 100)
  const formula =
    mode === 'exclusive'
      ? `${amount} ${unit} × (1 + ${taxRatePercent}%) = ${roundMoney(value)} ${unit}`
      : `${amount} ${unit} ÷ (1 + ${taxRatePercent}%) = ${roundMoney(value)} ${unit} before tax`
  return computed(value, formula, unit, sourceChunkIds)
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const code = normalizeCurrency(currencyCode)
  if (!code) return roundMoney(amount).toString()
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${code} ${roundMoney(amount)}`
  }
}

export function detectCalculationIntent(question: string): {
  readonly hasIntent: boolean
  readonly percentage: boolean
  readonly periodConversion: boolean
  readonly bulk: boolean
  readonly proration: boolean
  readonly tax: boolean
  readonly quantity: number | null
  readonly targetPeriod: BillingPeriod | null
} {
  const normalized = question.toLowerCase()
  const quantityMatch = normalized.match(/\b(?:for|x|qty|quantity)\s*(\d+(?:\.\d+)?)\b/)
  const targetPeriod = readTargetPeriod(normalized) ?? readPeriod(normalized)
  const mentionsPeriod = /\b(monthly|per month|\/mo|mo|yearly|annual|annually|weekly|daily|per day|per week)\b/.test(normalized)
  const asksBillingTotalConversion =
    mentionsPeriod &&
    /\b(price|cost|how much|convert|per|total|billed|equivalent|should be)\b/.test(normalized) &&
    (/\b(total|billed|yearly|annual|monthly|equivalent)\b/.test(normalized) || /\d+(?:[.,]\d+)?/.test(normalized))
  const intent = {
    percentage: /%|\b(discount|off|markup|percent|percentage)\b/.test(normalized),
    periodConversion: asksBillingTotalConversion,
    bulk: /\b(bulk|quantity|qty|units?|items?|for\s+\d+|x\d+)\b/.test(normalized),
    proration: /\b(prorat|mid-cycle|mid cycle|remaining days?|upgrade|downgrade|switch)\b/.test(normalized),
    tax: /\b(tax|vat|gst|inclusive|exclusive|including tax|plus tax)\b/.test(normalized),
    quantity: quantityMatch ? Number(quantityMatch[1]) : null,
    targetPeriod,
  }
  return { ...intent, hasIntent: intent.percentage || intent.periodConversion || intent.bulk || intent.proration || intent.tax }
}

export function detectConflictingFacts<T extends { readonly value: number; readonly label?: string | null; readonly unit?: string | null }>(
  facts: readonly T[],
): boolean {
  const groups = new Map<string, Set<number>>()
  for (const fact of facts) {
    const key = `${fact.label ?? 'value'}:${fact.unit ?? ''}`.toLowerCase()
    const values = groups.get(key) ?? new Set<number>()
    values.add(roundMoney(fact.value))
    groups.set(key, values)
  }
  return [...groups.values()].some((values) => values.size > 1)
}

export function cannotCompute(reason: string, unit = '', sourceChunkIds: readonly string[] = []): CalculationResult {
  return { status: 'cannot_compute', value: null, formula: '', unit, sourceChunkIds, reason }
}

export function conflictingFacts(reason: string, unit = '', sourceChunkIds: readonly string[] = []): CalculationResult {
  return { status: 'conflicting_facts', value: null, formula: '', unit, sourceChunkIds, reason }
}

function computed(value: number, formula: string, unit: string, sourceChunkIds: readonly string[]): CalculationResult {
  return { status: 'computed', value: roundMoney(value), formula, unit, sourceChunkIds }
}

function readPeriod(value: string): BillingPeriod | null {
  if (/\b(daily|per day|day)\b/.test(value)) return 'daily'
  if (/\b(weekly|per week|week)\b/.test(value)) return 'weekly'
  if (/\b(monthly|per month|month|mo)\b|\/mo\b/.test(value)) return 'monthly'
  if (/\b(quarterly|quarter)\b/.test(value)) return 'quarterly'
  if (/\b(yearly|annual|annually|per year|year)\b/.test(value)) return 'yearly'
  return null
}

function readTargetPeriod(value: string): BillingPeriod | null {
  if (/\b(monthly price|monthly cost|monthly equivalent|per month|\/mo|what should be the monthly|what is monthly)\b/.test(value)) {
    return 'monthly'
  }
  if (/\b(yearly total|annual total|yearly price|annual price|per year|what is yearly|what is annual)\b/.test(value)) {
    return 'yearly'
  }
  return null
}

function normalizeCurrency(value: string): string {
  const normalized = value.trim().toUpperCase()
  if (normalized === '$') return 'USD'
  if (normalized === 'RS' || normalized === 'PKR' || normalized === '₨') return 'PKR'
  if (normalized.length === 3) return normalized
  return ''
}

function isFiniteNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
