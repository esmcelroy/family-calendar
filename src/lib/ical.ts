import { CalendarEvent, FamilyMember } from './types'
import { toRRule } from './calendar'

/**
 * Converts events to iCalendar (RFC 5545) format
 * @param events - Array of calendar events to export
 * @param members - Array of family members for reference
 * @returns iCalendar formatted string
 */
export function generateICalendar(events: CalendarEvent[], members: FamilyMember[]): string {
  const lines: string[] = []
  
  // iCalendar header
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//Family Calendar//EN')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push('X-WR-CALNAME:Family Calendar')
  lines.push('X-WR-TIMEZONE:UTC')
  
  // Create a map of member IDs to names for easy lookup
  const memberMap = new Map(members.map(m => [m.id, m.name]))
  
  // Add each event
  events.forEach(event => {
    buildVEvent(lines, event, memberMap)

    if (event.recurrence) {
      lines.push(`RRULE:${toRRule(event.recurrence)}`)
      const deletedDates = (event.seriesExceptions || [])
        .filter((exception) => exception.type === 'deleted')
        .map((exception) => formatICalDate(new Date(exception.date)))
      if (deletedDates.length > 0) {
        lines.push(`EXDATE;VALUE=DATE:${deletedDates.join(',')}`)
      }
      lines.push('END:VEVENT')

      ;(event.seriesExceptions || [])
        .filter((exception) => exception.type === 'modified')
        .forEach((exception) => {
          const overriddenEvent: CalendarEvent = {
            ...event,
            ...exception.overrides,
            id: `${event.id}:${exception.date}`,
            date: exception.date,
            recurrence: undefined,
            seriesExceptions: undefined,
          }
          buildVEvent(lines, overriddenEvent, memberMap)
          lines.push(`RECURRENCE-ID;VALUE=DATE:${formatICalDate(new Date(exception.date))}`)
          lines.push('END:VEVENT')
        })
    } else {
      lines.push('END:VEVENT')
    }
  })
  
  lines.push('END:VCALENDAR')
  
  // Join with CRLF as per RFC 5545
  return lines.join('\r\n')
}

function buildVEvent(lines: string[], event: CalendarEvent, memberMap: Map<string, string>): void {
  lines.push('BEGIN:VEVENT')
  lines.push(`UID:${(event.seriesId || event.id)}@family-calendar`)

  const now = formatICalDateTime(new Date())
  lines.push(`DTSTAMP:${now}`)

  const eventDate = new Date(event.date)

  if (event.startTime) {
    const startDateTime = combineDateTime(eventDate, event.startTime)
    lines.push(`DTSTART:${formatICalDateTime(startDateTime)}`)

    if (event.endTime) {
      let endDateTime = combineDateTime(eventDate, event.endTime)
      if (endDateTime < startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1)
      }
      lines.push(`DTEND:${formatICalDateTime(endDateTime)}`)
    } else {
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000)
      lines.push(`DTEND:${formatICalDateTime(endDateTime)}`)
    }
  } else {
    lines.push(`DTSTART;VALUE=DATE:${formatICalDate(eventDate)}`)
    const nextDay = new Date(eventDate)
    nextDay.setDate(nextDay.getDate() + 1)
    lines.push(`DTEND;VALUE=DATE:${formatICalDate(nextDay)}`)
  }

  lines.push(`SUMMARY:${escapeICalText(event.title)}`)

  let description = ''
  if (event.memberIds && event.memberIds.length > 0) {
    const memberNames = event.memberIds
      .map(id => memberMap.get(id))
      .filter((name): name is string => name !== undefined)
      .join(', ')
    description = `Family Members: ${memberNames}`

    if (event.description) {
      description += `\n\n${event.description}`
    }
  } else if (event.description) {
    description = event.description
  }

  if (description) {
    lines.push(`DESCRIPTION:${escapeICalText(description)}`)
  }

  if (event.memberIds && event.memberIds.length > 0) {
    const categories = event.memberIds
      .map(id => memberMap.get(id))
      .filter((name): name is string => name !== undefined)
      .map(name => name.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/\n/g, '\\n'))
      .join(',')
    if (categories) {
      lines.push(`CATEGORIES:${categories}`)
    }
  }
}

/**
 * Format a Date object as iCalendar datetime (YYYYMMDDTHHmmssZ)
 */
function formatICalDateTime(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

/**
 * Format a Date object as iCalendar date (YYYYMMDD)
 * Note: Uses local time (not UTC) as per iCalendar spec for all-day events (VALUE=DATE)
 */
function formatICalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  return `${year}${month}${day}`
}

/**
 * Combine date and time string (HH:mm) into a Date object
 */
function combineDateTime(date: Date, timeStr: string): Date {
  const parts = timeStr.split(':')
  if (parts.length !== 2) {
    throw new Error(`Invalid time format: ${timeStr}. Expected HH:mm format.`)
  }
  
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time values: ${timeStr}. Hours must be 0-23, minutes must be 0-59.`)
  }
  
  const combined = new Date(date)
  combined.setUTCHours(hours, minutes, 0, 0)
  return combined
}

/**
 * Escape special characters in iCalendar text fields
 * According to RFC 5545, these characters need to be escaped: \ ; , (newlines as \n)
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')  // Backslash must be escaped first
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')      // Remove carriage returns
}

/**
 * Downloads an iCalendar file to the user's device
 * @param content - The iCalendar formatted string to download
 * @param filename - The name of the file to download (default: 'family-calendar.ics')
 */
export function downloadICalendar(content: string, filename: string = 'family-calendar.ics'): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
