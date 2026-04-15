import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from './types'
import {
  formatDate,
  formatMonthYear,
  formatTime,
  getDaysInMonth,
  getEventsForDate,
  getFirstDayOfMonth,
  isPast,
  isToday,
  sortEventsByTime,
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
