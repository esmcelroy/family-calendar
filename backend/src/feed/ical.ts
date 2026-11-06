interface SharedEvent {
  id: string
  data: Record<string, unknown>
}

function escapeText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function dateValue(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.replaceAll('-', '') : ''
}

function eventComponent(event: SharedEvent, overrides: Record<string, unknown> = {}, recurrenceId?: string): string[] {
  const data: Record<string, unknown> = {
    ...event.data,
    ...(recurrenceId ? { date: recurrenceId } : {}),
    ...overrides,
  }
  const date = dateValue(data['date'])
  if (!date || typeof data['title'] !== 'string') return []
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeText(String(data['seriesId'] ?? event.id))}@family-calendar`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    typeof data['startTime'] === 'string'
      ? `DTSTART:${date}T${data['startTime'].replace(':', '')}00`
      : `DTSTART;VALUE=DATE:${date}`,
    `SUMMARY:${escapeText(data['title'])}`,
  ]
  if (typeof data['startTime'] === 'string' && typeof data['endTime'] === 'string') {
    const endDate = data['endTime'] <= data['startTime']
      ? new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`)
      : null
    endDate?.setUTCDate(endDate.getUTCDate() + 1)
    const endDateValue = endDate
      ? endDate.toISOString().slice(0, 10).replaceAll('-', '')
      : date
    lines.push(`DTEND:${endDateValue}T${data['endTime'].replace(':', '')}00`)
  } else if (typeof data['startTime'] !== 'string') {
    const endDate = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`)
    endDate.setUTCDate(endDate.getUTCDate() + 1)
    lines.push(`DTEND;VALUE=DATE:${endDate.toISOString().slice(0, 10).replaceAll('-', '')}`)
  }
  if (typeof data['description'] === 'string' && data['description']) {
    lines.push(`DESCRIPTION:${escapeText(data['description'])}`)
  }
  const recurrence = recurrenceId ? undefined : data['recurrence']
  if (recurrence && typeof recurrence === 'object' && !Array.isArray(recurrence)) {
    const rule = recurrence as Record<string, unknown>
    const freq = String(rule['frequency'] ?? '').toUpperCase()
    const interval = Number.isInteger(rule['interval']) ? Number(rule['interval']) : 1
    if (['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) {
      const parts = [`FREQ=${freq}`, `INTERVAL=${Math.max(1, interval)}`]
      const weekdays = rule['selectedDays']
      if (Array.isArray(weekdays)) {
        const byDay = weekdays.map((day) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][Number(day)]).filter(Boolean)
        if (byDay.length) parts.push(`BYDAY=${byDay.join(',')}`)
      }
      if (rule['endType'] === 'date') {
        const until = dateValue(rule['endDate'])
        if (until) parts.push(`UNTIL=${until}${typeof data['startTime'] === 'string' ? 'T235959' : ''}`)
      } else if (rule['endType'] === 'count' && Number.isInteger(rule['endCount'])) {
        parts.push(`COUNT=${Math.max(1, Number(rule['endCount']))}`)
      }
      lines.push(`RRULE:${parts.join(';')}`)
    }
  }
  const exceptions = recurrenceId ? undefined : data['seriesExceptions']
  if (Array.isArray(exceptions)) {
    const deletedDates = exceptions.flatMap((exception) => {
      if (!exception || typeof exception !== 'object') return []
      const item = exception as Record<string, unknown>
      const deletedDate = dateValue(item['date'])
      if (item['type'] !== 'deleted' || !deletedDate) return []
      return [typeof data['startTime'] === 'string'
        ? `${deletedDate}T${String(data['startTime']).replace(':', '')}00`
        : deletedDate]
    })
    if (deletedDates.length) {
      lines.push(typeof data['startTime'] === 'string'
        ? `EXDATE:${deletedDates.join(',')}`
        : `EXDATE;VALUE=DATE:${deletedDates.join(',')}`)
    }
  }
  if (recurrenceId) {
    const originalDate = dateValue(recurrenceId)
    if (originalDate) {
      lines.push(typeof event.data['startTime'] === 'string'
        ? `RECURRENCE-ID:${originalDate}T${String(event.data['startTime']).replace(':', '')}00`
        : `RECURRENCE-ID;VALUE=DATE:${originalDate}`)
    }
  }
  lines.push(`SEQUENCE:${Number.isInteger(data['sequence']) ? data['sequence'] : 0}`, 'END:VEVENT')
  return lines
}

function subscriptionComponents(calendar: string): { timezones: string[][]; events: string[][] } {
  const unfolded = calendar.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  const timezones: string[][] = []
  const events: string[][] = []
  let current: string[] | null = null
  let timezone: string[] | null = null
  let inAlarm = false
  for (const line of unfolded) {
    if (timezone) {
      timezone.push(line)
      if (line === 'END:VTIMEZONE') {
        timezones.push(timezone)
        timezone = null
      }
      continue
    }
    if (line === 'BEGIN:VTIMEZONE') {
      timezone = [line]
      continue
    }
    if (line === 'BEGIN:VEVENT') {
      current = ['BEGIN:VEVENT']
      inAlarm = false
      continue
    }
    if (!current) continue
    if (line === 'BEGIN:VALARM') {
      inAlarm = true
      continue
    }
    if (line === 'END:VALARM') {
      inAlarm = false
      continue
    }
    if (line === 'END:VEVENT') {
      current.push('END:VEVENT')
      events.push(current)
      current = null
      continue
    }
    if (!inAlarm && !line.startsWith('BEGIN:') && !line.startsWith('END:')) current.push(line)
  }
  return { timezones, events }
}

export function buildMergedCalendar(events: SharedEvent[], subscriptionCalendars: string[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Family Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Family Calendar',
  ]
  for (const event of events) {
    lines.push(...eventComponent(event))
    const recurrence = event.data['recurrence']
    if (recurrence) {
      const exceptions = event.data['seriesExceptions']
      if (Array.isArray(exceptions)) {
        for (const exception of exceptions) {
          if (!exception || typeof exception !== 'object') continue
          const item = exception as Record<string, unknown>
          if (item['type'] === 'modified' && item['overrides'] && typeof item['overrides'] === 'object') {
            lines.push(...eventComponent(event, item['overrides'] as Record<string, unknown>, String(item['date'] ?? '')))
          }
        }
      }
    }
  }
  const subscriptions = subscriptionCalendars.map(subscriptionComponents)
  const timezones = new Map<string, string[]>()
  for (const subscription of subscriptions) {
    for (const component of subscription.timezones) {
      const tzidLine = component.find((line) => /^TZID(?:;[^:]*)?:/.test(line))
      const tzid = tzidLine?.slice(tzidLine.indexOf(':') + 1)
      const key = tzid || component.join('\r\n')
      if (!timezones.has(key)) timezones.set(key, component)
    }
  }
  for (const component of timezones.values()) lines.push(...component)
  for (const subscription of subscriptions) {
    for (const event of subscription.events) lines.push(...event)
  }
  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
