import { CalendarEvent, RecurrenceRule, RecurrenceFrequency } from './types'

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function formatTime(time: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}

export function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

export function isPast(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const compareDate = new Date(date)
  compareDate.setHours(0, 0, 0, 0)
  return compareDate < today
}

export function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const dateStr = formatDate(date)
  return events.filter((event) => event.date === dateStr)
}

export function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (!a.startTime && !b.startTime) return 0
    if (!a.startTime) return 1
    if (!b.startTime) return -1
    return a.startTime.localeCompare(b.startTime)
  })
}

const HORIZON_YEARS = 2

export function expandRecurringEvents(events: CalendarEvent[], referenceDate: Date = new Date()): CalendarEvent[] {
  const horizonStart = new Date(referenceDate)
  horizonStart.setFullYear(horizonStart.getFullYear() - HORIZON_YEARS)
  horizonStart.setHours(0, 0, 0, 0)

  const horizonEnd = new Date(referenceDate)
  horizonEnd.setFullYear(horizonEnd.getFullYear() + HORIZON_YEARS)
  horizonEnd.setHours(23, 59, 59, 999)

  const expanded = events.flatMap((event) => expandEvent(event, horizonStart, horizonEnd))
  return sortEventsByTime(expanded).sort((a, b) => {
    if (a.date === b.date) return 0
    return a.date.localeCompare(b.date)
  })
}

function expandEvent(event: CalendarEvent, horizonStart: Date, horizonEnd: Date): CalendarEvent[] {
  if (!event.recurrence || !event.seriesId) return [event]

  const occurrences = generateRecurringDates(event.date, event.recurrence, horizonStart, horizonEnd)
  const exceptionMap = new Map((event.seriesExceptions || []).map((exception) => [exception.date, exception]))

  return occurrences.flatMap((occurrenceDate) => {
    const dateStr = formatDate(occurrenceDate)
    const exception = exceptionMap.get(dateStr)

    if (exception?.type === 'deleted') return []

    const baseOccurrence: CalendarEvent = {
      ...event,
      id: `${event.id}:${dateStr}`,
      date: dateStr,
      recurrenceMeta: {
        sourceEventId: event.id,
        occurrenceDate: dateStr,
        isModified: false,
      },
    }

    if (!exception || exception.type !== 'modified') return [baseOccurrence]

    return [{
      ...baseOccurrence,
      ...exception.overrides,
      date: dateStr,
      recurrenceMeta: {
        sourceEventId: event.id,
        occurrenceDate: dateStr,
        isModified: true,
      },
    }]
  })
}

function generateRecurringDates(
  startDateStr: string,
  recurrence: RecurrenceRule,
  horizonStart: Date,
  horizonEnd: Date,
): Date[] {
  const startDate = new Date(startDateStr)
  startDate.setHours(0, 0, 0, 0)
  if (isNaN(startDate.getTime())) return []

  const interval = Math.max(1, recurrence.interval || 1)
  const maxByNone = new Date(startDate)
  maxByNone.setFullYear(maxByNone.getFullYear() + HORIZON_YEARS)
  const recurrenceEnd = resolveRecurrenceEndDate(recurrence, maxByNone)

  let occurrences: Date[]

  switch (recurrence.frequency) {
    case 'daily':
      occurrences = generateDailyOccurrences(startDate, interval, recurrenceEnd)
      break
    case 'weekly':
      occurrences = generateWeeklyOccurrences(startDate, recurrence, interval, recurrenceEnd)
      break
    case 'monthly':
      occurrences = generateMonthlyOccurrences(startDate, interval, recurrenceEnd)
      break
    case 'yearly':
      occurrences = generateYearlyOccurrences(startDate, interval, recurrenceEnd)
      break
    default:
      occurrences = []
  }

  if (recurrence.endType === 'count' && recurrence.endCount && recurrence.endCount > 0) {
    occurrences = occurrences.slice(0, recurrence.endCount)
  }

  return occurrences.filter((date) => date >= horizonStart && date <= horizonEnd)
}

function resolveRecurrenceEndDate(recurrence: RecurrenceRule, fallbackEnd: Date): Date {
  if (recurrence.endType === 'date' && recurrence.endDate) {
    const endDate = new Date(recurrence.endDate)
    endDate.setHours(23, 59, 59, 999)
    if (!isNaN(endDate.getTime())) return endDate
  }
  return fallbackEnd
}

function generateDailyOccurrences(startDate: Date, interval: number, recurrenceEnd: Date): Date[] {
  const results: Date[] = []
  const current = new Date(startDate)

  while (current <= recurrenceEnd) {
    results.push(new Date(current))
    current.setDate(current.getDate() + interval)
  }

  return results
}

function generateWeeklyOccurrences(startDate: Date, recurrence: RecurrenceRule, interval: number, recurrenceEnd: Date): Date[] {
  const results: Date[] = []
  const days = (recurrence.selectedDays && recurrence.selectedDays.length > 0)
    ? recurrence.selectedDays
    : [startDate.getDay()]
  const current = new Date(startDate)

  while (current <= recurrenceEnd) {
    const weeksFromStart = Math.floor((current.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
    if (weeksFromStart % interval === 0 && days.includes(current.getDay()) && current >= startDate) {
      results.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }

  return results
}

function generateMonthlyOccurrences(startDate: Date, interval: number, recurrenceEnd: Date): Date[] {
  const results: Date[] = []
  const targetDay = startDate.getDate()

  let offset = 0
  while (true) {
    const occurrence = new Date(startDate.getFullYear(), startDate.getMonth() + offset, targetDay)
    occurrence.setHours(0, 0, 0, 0)
    if (occurrence > recurrenceEnd) break

    if (occurrence.getDate() === targetDay) {
      results.push(occurrence)
    }
    offset += interval
  }

  return results
}

function generateYearlyOccurrences(startDate: Date, interval: number, recurrenceEnd: Date): Date[] {
  const results: Date[] = []
  const targetMonth = startDate.getMonth()
  const targetDay = startDate.getDate()

  let yearOffset = 0
  while (true) {
    const occurrence = new Date(startDate.getFullYear() + yearOffset, targetMonth, targetDay)
    occurrence.setHours(0, 0, 0, 0)
    if (occurrence > recurrenceEnd) break

    if (occurrence.getMonth() === targetMonth && occurrence.getDate() === targetDay) {
      results.push(occurrence)
    }
    yearOffset += interval
  }

  return results
}

export function formatRecurrencePattern(recurrence: RecurrenceRule): string {
  const every = recurrence.interval > 1 ? `Every ${recurrence.interval}` : 'Every'

  let basePattern = ''
  switch (recurrence.frequency) {
    case 'daily':
      basePattern = recurrence.interval > 1 ? `${every} days` : 'Daily'
      break
    case 'weekly':
      if (recurrence.selectedDays && recurrence.selectedDays.length > 0) {
        const dayNames = recurrence.selectedDays
          .sort((a, b) => a - b)
          .map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day])
          .join(', ')
        basePattern = recurrence.interval > 1 ? `${every} weeks on ${dayNames}` : `Weekly on ${dayNames}`
      } else {
        basePattern = recurrence.interval > 1 ? `${every} weeks` : 'Weekly'
      }
      break
    case 'monthly':
      basePattern = recurrence.interval > 1 ? `${every} months` : 'Monthly'
      break
    case 'yearly':
      basePattern = recurrence.interval > 1 ? `${every} years` : 'Yearly'
      break
    default:
      basePattern = 'Recurring'
  }

  if (recurrence.endType === 'date' && recurrence.endDate) {
    return `${basePattern}, until ${new Date(recurrence.endDate).toLocaleDateString()}`
  }

  if (recurrence.endType === 'count' && recurrence.endCount) {
    return `${basePattern}, ${recurrence.endCount} occurrence${recurrence.endCount === 1 ? '' : 's'}`
  }

  return `${basePattern}, no end`
}

export function toRRule(recurrence: RecurrenceRule): string {
  const parts: string[] = [`FREQ=${toRRuleFrequency(recurrence.frequency)}`]
  parts.push(`INTERVAL=${Math.max(1, recurrence.interval || 1)}`)

  if (recurrence.frequency === 'weekly' && recurrence.selectedDays && recurrence.selectedDays.length > 0) {
    const byDay = recurrence.selectedDays
      .map((day) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][day])
      .join(',')
    parts.push(`BYDAY=${byDay}`)
  }

  if (recurrence.endType === 'count' && recurrence.endCount) {
    parts.push(`COUNT=${recurrence.endCount}`)
  } else if (recurrence.endType === 'date' && recurrence.endDate) {
    const untilDate = new Date(recurrence.endDate)
    untilDate.setUTCHours(23, 59, 59, 0)
    parts.push(`UNTIL=${untilDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`)
  }

  return parts.join(';')
}

function toRRuleFrequency(frequency: RecurrenceFrequency): string {
  switch (frequency) {
    case 'daily':
      return 'DAILY'
    case 'weekly':
      return 'WEEKLY'
    case 'monthly':
      return 'MONTHLY'
    case 'yearly':
      return 'YEARLY'
    default:
      return 'DAILY'
  }
}
