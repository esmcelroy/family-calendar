import { CalendarEvent, FamilyMember } from './types'

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
    lines.push('BEGIN:VEVENT')
    
    // Generate UID (unique identifier)
    lines.push(`UID:${event.id}@family-calendar`)
    
    // Created and last modified timestamps (use current time as proxy)
    const now = formatICalDateTime(new Date())
    lines.push(`DTSTAMP:${now}`)
    
    // Event date and time
    const eventDate = new Date(event.date)
    
    if (event.startTime) {
      // Event has specific time - use DTSTART and DTEND
      const startDateTime = combineDateTime(eventDate, event.startTime)
      lines.push(`DTSTART:${formatICalDateTime(startDateTime)}`)
      
      if (event.endTime) {
        const endDateTime = combineDateTime(eventDate, event.endTime)
        lines.push(`DTEND:${formatICalDateTime(endDateTime)}`)
      } else {
        // Default to 1 hour duration if no end time
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000)
        lines.push(`DTEND:${formatICalDateTime(endDateTime)}`)
      }
    } else {
      // All-day event - use DATE format
      lines.push(`DTSTART;VALUE=DATE:${formatICalDate(eventDate)}`)
      // All-day events have no end time, but we can set next day
      const nextDay = new Date(eventDate)
      nextDay.setDate(nextDay.getDate() + 1)
      lines.push(`DTEND;VALUE=DATE:${formatICalDate(nextDay)}`)
    }
    
    // Event title (escape special characters)
    lines.push(`SUMMARY:${escapeICalText(event.title)}`)
    
    // Event description with member names
    let description = ''
    if (event.memberIds && event.memberIds.length > 0) {
      const memberNames = event.memberIds
        .map(id => memberMap.get(id))
        .filter(Boolean)
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
    
    // Categories (use member names as categories)
    if (event.memberIds && event.memberIds.length > 0) {
      const categories = event.memberIds
        .map(id => memberMap.get(id))
        .filter(Boolean)
        .map(name => escapeICalText(name))
        .join(',')
      if (categories) {
        lines.push(`CATEGORIES:${categories}`)
      }
    }
    
    lines.push('END:VEVENT')
  })
  
  lines.push('END:VCALENDAR')
  
  // Join with CRLF as per RFC 5545
  return lines.join('\r\n')
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
  combined.setHours(hours, minutes, 0, 0)
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
 * Download iCalendar file
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
