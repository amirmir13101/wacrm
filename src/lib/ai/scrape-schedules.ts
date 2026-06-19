export type ScrapeFrequency = 'daily' | 'weekly' | 'monthly' | 'manual'

export interface ScrapeScheduleInput {
  readonly frequency: ScrapeFrequency
  readonly dayOfWeek?: number | null
  readonly hourUtc?: number
}

export function calculateNextRunAt(input: ScrapeScheduleInput, from = new Date()): string | null {
  if (input.frequency === 'manual') return null
  const hour = clampInteger(input.hourUtc ?? 3, 0, 23)
  const next = new Date(from)
  next.setUTCMinutes(0, 0, 0)
  next.setUTCHours(hour)

  if (input.frequency === 'daily') {
    if (next <= from) next.setUTCDate(next.getUTCDate() + 1)
  } else if (input.frequency === 'weekly') {
    const targetDay = clampInteger(input.dayOfWeek ?? 0, 0, 6)
    let days = (targetDay - next.getUTCDay() + 7) % 7
    if (days === 0 && next <= from) days = 7
    next.setUTCDate(next.getUTCDate() + days)
  } else {
    next.setUTCDate(next.getUTCDate() + 30)
  }
  return next.toISOString()
}

export function calculateRetryAt(from = new Date(), hours = 6): string {
  return new Date(from.getTime() + hours * 60 * 60 * 1_000).toISOString()
}

export function parseScheduleFrequency(value: unknown): ScrapeFrequency | null {
  return typeof value === 'string' && ['daily', 'weekly', 'monthly', 'manual'].includes(value)
    ? value as ScrapeFrequency
    : null
}

export function clampPageLimit(value: unknown): number {
  const numeric = typeof value === 'number' ? value : 50
  return clampInteger(numeric, 1, 200)
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.floor(value)))
}
