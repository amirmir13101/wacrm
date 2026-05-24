export type ParsedTimeSchedule =
  | { type: 'interval'; minutes: number }
  | { type: 'hourly' }
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'weekly'; day: number; hour: number; minute: number }

export interface ScheduleDecision {
  due: boolean
  dueAt: Date | null
  nextRunAt: Date | null
  error?: string
}

const DAY_NAMES: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
}

export function parseTimeBasedSchedule(schedule: unknown): ParsedTimeSchedule | null {
  if (typeof schedule !== 'string') return null
  const raw = schedule.trim().toLowerCase()
  if (!raw) return null

  const everyMinutes = raw.match(/^every\s+(\d+)\s*(m|min|mins|minute|minutes)$/)
  if (everyMinutes) {
    const minutes = Number(everyMinutes[1])
    return minutes > 0 ? { type: 'interval', minutes } : null
  }

  const shorthandMinutes = raw.match(/^every\s+(\d+)m$/)
  if (shorthandMinutes) {
    const minutes = Number(shorthandMinutes[1])
    return minutes > 0 ? { type: 'interval', minutes } : null
  }

  if (raw === 'hourly' || raw === 'every hour' || raw === 'every 1 hour') {
    return { type: 'hourly' }
  }

  const timeOnly = parseClock(raw)
  if (timeOnly) return { type: 'daily', ...timeOnly }

  const daily = raw.match(/^daily(?:\s+at)?\s+(\d{1,2}:\d{2})$/)
  if (daily) {
    const clock = parseClock(daily[1])
    return clock ? { type: 'daily', ...clock } : null
  }

  const weekly = raw.match(/^weekly(?:\s+on)?\s+([a-z]+)(?:\s+at)?\s+(\d{1,2}:\d{2})$/)
  if (weekly) {
    const day = DAY_NAMES[weekly[1]]
    const clock = parseClock(weekly[2])
    return day !== undefined && clock ? { type: 'weekly', day, ...clock } : null
  }

  const cron = parseSimpleCron(raw)
  if (cron) return cron

  return null
}

export function isValidTimeBasedSchedule(schedule: unknown): boolean {
  return parseTimeBasedSchedule(schedule) !== null
}

export function getScheduleDecision(
  schedule: unknown,
  now = new Date(),
  lastRunAt?: string | Date | null,
): ScheduleDecision {
  const parsed = parseTimeBasedSchedule(schedule)
  if (!parsed) {
    return {
      due: false,
      dueAt: null,
      nextRunAt: null,
      error:
        'Schedule must be like "every 15 minutes", "hourly", "09:00", "daily 09:00", or "0 9 * * *".',
    }
  }

  const lastRun = lastRunAt ? new Date(lastRunAt) : null
  if (lastRun && Number.isNaN(lastRun.getTime())) {
    return { due: false, dueAt: null, nextRunAt: nextRun(parsed, now), error: 'Invalid last run date.' }
  }

  if (parsed.type === 'interval') {
    const intervalMs = parsed.minutes * 60_000
    const due = !lastRun || now.getTime() - lastRun.getTime() >= intervalMs
    return {
      due,
      dueAt: due ? now : null,
      nextRunAt: due ? new Date(now.getTime() + intervalMs) : new Date(lastRun!.getTime() + intervalMs),
    }
  }

  const dueAt = currentWindowStart(parsed, now)
  const hasReachedWindow = dueAt !== null && now.getTime() >= dueAt.getTime()
  const alreadyRanWindow =
    dueAt !== null && lastRun !== null && lastRun.getTime() >= dueAt.getTime()
  const due = hasReachedWindow && !alreadyRanWindow

  return {
    due,
    dueAt: due ? dueAt : null,
    nextRunAt: due ? nextRun(parsed, now) : nextRun(parsed, now),
  }
}

function parseClock(value: string): { hour: number; minute: number } | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

function parseSimpleCron(value: string): ParsedTimeSchedule | null {
  const parts = value.split(/\s+/)
  if (parts.length !== 5) return null
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  if (dayOfMonth !== '*' || month !== '*') return null

  const interval = minute.match(/^\*\/(\d+)$/)
  if (interval && hour === '*' && dayOfWeek === '*') {
    const minutes = Number(interval[1])
    return minutes > 0 ? { type: 'interval', minutes } : null
  }

  if (minute === '0' && hour === '*' && dayOfWeek === '*') {
    return { type: 'hourly' }
  }

  if (/^\d{1,2}$/.test(minute) && /^\d{1,2}$/.test(hour)) {
    const clock = parseClock(`${hour}:${minute.padStart(2, '0')}`)
    if (!clock) return null
    if (dayOfWeek === '*') return { type: 'daily', ...clock }
    if (/^\d$/.test(dayOfWeek)) {
      const day = Number(dayOfWeek)
      return day >= 0 && day <= 6 ? { type: 'weekly', day, ...clock } : null
    }
  }

  return null
}

function currentWindowStart(schedule: ParsedTimeSchedule, now: Date): Date | null {
  if (schedule.type === 'hourly') {
    const dueAt = new Date(now)
    dueAt.setSeconds(0, 0)
    dueAt.setMinutes(0)
    return dueAt
  }
  if (schedule.type === 'daily') {
    const dueAt = new Date(now)
    dueAt.setHours(schedule.hour, schedule.minute, 0, 0)
    return dueAt
  }
  if (schedule.type === 'weekly') {
    const dueAt = new Date(now)
    const daysBack = (dueAt.getDay() - schedule.day + 7) % 7
    dueAt.setDate(dueAt.getDate() - daysBack)
    dueAt.setHours(schedule.hour, schedule.minute, 0, 0)
    return dueAt
  }
  return null
}

function nextRun(schedule: ParsedTimeSchedule, from: Date): Date {
  if (schedule.type === 'interval') {
    return new Date(from.getTime() + schedule.minutes * 60_000)
  }
  if (schedule.type === 'hourly') {
    const next = new Date(from)
    next.setSeconds(0, 0)
    next.setMinutes(0)
    next.setHours(next.getHours() + 1)
    return next
  }
  if (schedule.type === 'daily') {
    const next = new Date(from)
    next.setHours(schedule.hour, schedule.minute, 0, 0)
    if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1)
    return next
  }
  const next = new Date(from)
  next.setHours(schedule.hour, schedule.minute, 0, 0)
  const daysAhead = (schedule.day - next.getDay() + 7) % 7
  next.setDate(next.getDate() + daysAhead)
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 7)
  return next
}

