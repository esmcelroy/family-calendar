import { CalendarEvent, FamilyMember } from './types'

const GCAL_BASE = 'https://calendar.google.com/calendar/render'

/**
 * Returns true when the member's preferred platform is Google Calendar.
 */
export function isGCalUser(member: FamilyMember): boolean {
  return member.preferredPlatform === 'google'
}

/**
 * Builds a Google Calendar "Add event" deep-link URL for the given event.
 *
 * Format: https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&details=…
 *
 * - Timed events: dates=YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ
 * - All-day events: dates=YYYYMMDD/YYYYMMDD  (end date is exclusive, same as iCal DTEND)
 */
export function buildGCalUrl(event: CalendarEvent): string {
  const params = new URLSearchParams()
  params.set('action', 'TEMPLATE')
  params.set('text', event.title)

  const eventDate = new Date(event.date)

  if (event.startTime) {
    const startDt = combineDateTimeUtc(eventDate, event.startTime)
    let endDt: Date
    if (event.endTime) {
      endDt = combineDateTimeUtc(eventDate, event.endTime)
      if (endDt < startDt) endDt.setUTCDate(endDt.getUTCDate() + 1)
    } else {
      endDt = new Date(startDt.getTime() + 3600_000)
    }
    params.set('dates', `${formatGCalDateTime(startDt)}/${formatGCalDateTime(endDt)}`)
  } else {
    const startStr = formatGCalDate(eventDate)
    const nextDay = new Date(eventDate)
    nextDay.setDate(nextDay.getDate() + 1)
    const endStr = formatGCalDate(nextDay)
    params.set('dates', `${startStr}/${endStr}`)
  }

  if (event.description) {
    params.set('details', event.description)
  }

  return `${GCAL_BASE}?${params.toString()}`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function combineDateTimeUtc(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number)
  const dt = new Date(date)
  dt.setUTCHours(h, m, 0, 0)
  return dt
}

function formatGCalDateTime(date: Date): string {
  const y = date.getUTCFullYear()
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(date.getUTCHours()).padStart(2, '0')
  const mi = String(date.getUTCMinutes()).padStart(2, '0')
  const s = String(date.getUTCSeconds()).padStart(2, '0')
  return `${y}${mo}${d}T${h}${mi}${s}Z`
}

function formatGCalDate(date: Date): string {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${mo}${d}`
}
