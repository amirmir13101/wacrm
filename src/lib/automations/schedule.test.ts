import { describe, expect, it } from 'vitest'

import {
  getScheduleDecision,
  isValidTimeBasedSchedule,
  parseTimeBasedSchedule,
} from './schedule'

describe('time-based automation schedules', () => {
  it('parses the supported beginner-friendly schedule formats', () => {
    expect(parseTimeBasedSchedule('every 15 minutes')).toEqual({
      type: 'interval',
      minutes: 15,
    })
    expect(parseTimeBasedSchedule('hourly')).toEqual({ type: 'hourly' })
    expect(parseTimeBasedSchedule('09:30')).toEqual({ type: 'daily', hour: 9, minute: 30 })
    expect(parseTimeBasedSchedule('daily at 18:45')).toEqual({
      type: 'daily',
      hour: 18,
      minute: 45,
    })
    expect(parseTimeBasedSchedule('weekly monday 10:00')).toEqual({
      type: 'weekly',
      day: 1,
      hour: 10,
      minute: 0,
    })
    expect(parseTimeBasedSchedule('0 9 * * *')).toEqual({
      type: 'daily',
      hour: 9,
      minute: 0,
    })
  })

  it('rejects invalid schedule strings', () => {
    expect(isValidTimeBasedSchedule('')).toBe(false)
    expect(isValidTimeBasedSchedule('tomorrow maybe')).toBe(false)
    expect(isValidTimeBasedSchedule('25:99')).toBe(false)
  })

  it('runs interval schedules only when due', () => {
    const now = new Date('2026-05-25T10:15:00.000Z')

    expect(
      getScheduleDecision('every 15 minutes', now, '2026-05-25T10:00:00.000Z').due,
    ).toBe(true)
    expect(
      getScheduleDecision('every 15 minutes', now, '2026-05-25T10:05:00.000Z').due,
    ).toBe(false)
  })

  it('runs daily schedules once per due window', () => {
    const now = new Date('2026-05-25T09:05:00.000Z')

    expect(getScheduleDecision('09:00', now, null).due).toBe(true)
    expect(
      getScheduleDecision('09:00', now, '2026-05-25T09:01:00.000Z').due,
    ).toBe(false)
    expect(
      getScheduleDecision('09:00', now, '2026-05-24T09:01:00.000Z').due,
    ).toBe(true)
  })

  it('does not run hourly schedules outside the current hour boundary twice', () => {
    const now = new Date('2026-05-25T11:12:00.000Z')

    expect(
      getScheduleDecision('hourly', now, '2026-05-25T11:00:05.000Z').due,
    ).toBe(false)
    expect(
      getScheduleDecision('hourly', now, '2026-05-25T10:00:05.000Z').due,
    ).toBe(true)
  })
})

