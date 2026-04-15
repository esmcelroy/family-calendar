import { describe, expect, it } from 'vitest'
import type { CalendarEvent, RecurrenceRule } from './types'
import {
  formatDate,
  formatMonthYear,
  formatRecurrencePattern,
  formatTime,
  getDaysInMonth,
  getEventsForDate,
  getFirstDayOfMonth,
  isPast,
  isToday,
  sortEventsByTime,
  toRRule,
} from './calendar'

describe('calendar utilities', () => {
  it('returns the right number of days for a leap-year February', () => {
    expect(getDaysInMonth(2024, 1)).toBe(29)
  })

  it('returns the first weekday of the month', () => {
    expect(getFirstDayOfMonth(2026, 0)).toBe(4)
  })

  it('formats month and year for display', () => {
    expect(formatMonthYear(new Date('2026-01-10T12:00:00.000Z'))).toContain('2026')
  })

  it('formats date as YYYY-MM-DD', () => {
    expect(formatDate(new Date('2026-01-10T12:00:00.000Z'))).toBe('2026-01-10')
  })

  it('formats a local-midnight date without shifting the day', () => {
    const date = new Date(2026, 0, 10)
    const expected = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')

    expect(formatDate(date)).toBe(expected)
  })
  it('formats time from 24-hour to 12-hour display', () => {
    expect(formatTime('00:30')).toBe('12:30 AM')
    expect(formatTime('13:15')).toBe('1:15 PM')
    expect(formatTime('')).toBe('')
  })

  it('identifies today correctly', () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    expect(isToday(today)).toBe(true)
    expect(isToday(tomorrow)).toBe(false)
  })

  it('identifies past dates correctly', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    expect(isPast(yesterday)).toBe(true)
    expect(isPast(tomorrow)).toBe(false)
  })

  it('filters events for a target date', () => {
    const date = new Date(2026, 0, 15)
    const selectedDate = formatDate(date)
    const events: CalendarEvent[] = [
      { id: '1', title: 'A', date: selectedDate, memberIds: ['m1'] },
      { id: '2', title: 'B', date: '2026-01-16', memberIds: ['m1'] },
    ]

    expect(getEventsForDate(events, date)).toEqual([events[0]])
  })

  it('sorts events by start time without mutating input', () => {
    const events: CalendarEvent[] = [
      { id: '3', title: 'No time', date: '2026-01-10', memberIds: ['m1'] },
      { id: '1', title: 'Later', date: '2026-01-10', startTime: '14:00', memberIds: ['m1'] },
      { id: '2', title: 'Earlier', date: '2026-01-10', startTime: '09:00', memberIds: ['m1'] },
    ]

    const sorted = sortEventsByTime(events)

    expect(sorted.map((event) => event.id)).toEqual(['2', '1', '3'])
    expect(events.map((event) => event.id)).toEqual(['3', '1', '2'])
  })
})

describe('formatRecurrencePattern', () => {
  it('returns "Daily" for a daily rule with no interval', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1, endType: 'none' }
    expect(formatRecurrencePattern(rule)).toBe('Daily, no end')
  })

  it('returns interval phrasing for daily with interval > 1', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 3, endType: 'none' }
    expect(formatRecurrencePattern(rule)).toBe('Every 3 days, no end')
  })

  it('returns "Weekly" for weekly with no selected days', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', interval: 1, endType: 'none' }
    expect(formatRecurrencePattern(rule)).toBe('Weekly, no end')
  })

  it('returns day names for weekly with selectedDays', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', interval: 1, selectedDays: [1, 3, 5], endType: 'none' }
    expect(formatRecurrencePattern(rule)).toBe('Weekly on Mon, Wed, Fri, no end')
  })

  it('returns "Monthly" for monthly', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, endType: 'none' }
    expect(formatRecurrencePattern(rule)).toBe('Monthly, no end')
  })

  it('returns "Yearly" for yearly', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', interval: 1, endType: 'none' }
    expect(formatRecurrencePattern(rule)).toBe('Yearly, no end')
  })

  it('appends count when endType is count', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1, endType: 'count', endCount: 5 }
    expect(formatRecurrencePattern(rule)).toBe('Daily, 5 occurrences')
  })

  it('uses singular "occurrence" for count of 1', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1, endType: 'count', endCount: 1 }
    expect(formatRecurrencePattern(rule)).toBe('Daily, 1 occurrence')
  })
})

describe('toRRule', () => {
  it('produces a basic daily RRULE', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1, endType: 'none' }
    expect(toRRule(rule)).toBe('FREQ=DAILY;INTERVAL=1')
  })

  it('produces a weekly RRULE with BYDAY', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', interval: 1, selectedDays: [1, 5], endType: 'none' }
    expect(toRRule(rule)).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR')
  })

  it('includes COUNT when endType is count', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 2, endType: 'count', endCount: 6 }
    expect(toRRule(rule)).toBe('FREQ=MONTHLY;INTERVAL=2;COUNT=6')
  })

  it('includes UNTIL when endType is date', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', interval: 1, endType: 'date', endDate: '2026-12-31' }
    const result = toRRule(rule)
    expect(result).toMatch(/^FREQ=YEARLY;INTERVAL=1;UNTIL=/)
    expect(result).toMatch(/Z$/)
  })
})
