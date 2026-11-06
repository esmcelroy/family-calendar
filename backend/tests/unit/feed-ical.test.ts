import { describe, expect, it } from 'vitest'
import { buildMergedCalendar } from '../../src/feed/ical.js'

const timezoneCalendar = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VTIMEZONE',
  'TZID:America/New_York',
  'BEGIN:STANDARD',
  'DTSTART:20261101T020000',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'TZNAME:EST',
  'END:STANDARD',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'UID:school-event',
  'DTSTART;TZID=America/New_York:20261110T090000',
  'SUMMARY:School event',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('merged calendar feed', () => {
  it('uses the occurrence date and original timed start for detached recurrence identity', () => {
    const calendar = buildMergedCalendar([{
      id: 'family-event',
      data: {
        title: 'Family breakfast',
        date: '2026-11-06',
        startTime: '09:30',
        endTime: '10:15',
        seriesId: 'breakfast-series',
        recurrence: { frequency: 'weekly', interval: 1 },
        seriesExceptions: [{
          date: '2026-11-13',
          type: 'modified',
          overrides: { title: 'Later breakfast', startTime: '10:30', endTime: '11:15' },
        }],
      },
    }], [])

    expect(calendar).toContain('DTSTART:20261113T103000')
    expect(calendar).toContain('RECURRENCE-ID:20261113T093000')
    expect(calendar).not.toContain('RECURRENCE-ID;VALUE=DATE')
  })

  it('keeps recurrence exception value types aligned with the master event', () => {
    const timedCalendar = buildMergedCalendar([{
      id: 'timed-event',
      data: {
        title: 'Timed event',
        date: '2026-11-06',
        startTime: '09:30',
        seriesId: 'timed-series',
        recurrence: { frequency: 'weekly', interval: 1 },
        seriesExceptions: [{ date: '2026-11-13', type: 'deleted' }],
      },
    }], [])
    const allDayCalendar = buildMergedCalendar([{
      id: 'all-day-event',
      data: {
        title: 'All-day event',
        date: '2026-11-06',
        seriesId: 'all-day-series',
        recurrence: { frequency: 'weekly', interval: 1 },
        seriesExceptions: [{ date: '2026-11-13', type: 'deleted' }],
      },
    }], [])

    expect(timedCalendar).toContain('EXDATE:20261113T093000')
    expect(timedCalendar).not.toContain('EXDATE;VALUE=DATE')
    expect(allDayCalendar).toContain('EXDATE;VALUE=DATE:20261113')
  })

  it('uses exclusive end dates for all-day and overnight events', () => {
    const calendar = buildMergedCalendar([
      { id: 'all-day', data: { title: 'All day', date: '2026-11-06', endTime: '12:00' } },
      {
        id: 'overnight',
        data: { title: 'Overnight', date: '2026-11-06', startTime: '23:30', endTime: '00:15' },
      },
    ], [])

    expect(calendar).toContain('DTSTART;VALUE=DATE:20261106')
    expect(calendar).toContain('DTEND;VALUE=DATE:20261107')
    expect(calendar).not.toContain('DTEND:20261106T120000')
    expect(calendar).toContain('DTSTART:20261106T233000')
    expect(calendar).toContain('DTEND:20261107T001500')
  })

  it('preserves imported timezone definitions referenced by subscription events', () => {
    const calendar = buildMergedCalendar([], [timezoneCalendar, timezoneCalendar])

    expect(calendar).toContain('BEGIN:VTIMEZONE\r\nTZID:America/New_York\r\nBEGIN:STANDARD')
    expect(calendar).toContain('TZOFFSETFROM:-0400\r\nTZOFFSETTO:-0500')
    expect(calendar).toContain('DTSTART;TZID=America/New_York:20261110T090000')
    expect(calendar.match(/BEGIN:VTIMEZONE/g)).toHaveLength(1)
  })
})
