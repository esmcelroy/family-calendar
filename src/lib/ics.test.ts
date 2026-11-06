import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IcsSubscription, SubscribedEvent } from './types'
import { exportToIcsString, fetchAndParseIcs, mergeAndStripAlarms } from './ics'

const calendarText = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//Family Calendar//EN',
  'BEGIN:VEVENT',
  'UID:school-event@example.com',
  'DTSTAMP:20261001T120000Z',
  'DTSTART:20261003T140000Z',
  'DTEND:20261003T150000Z',
  'SUMMARY:School Event',
  'DESCRIPTION:Bring a notebook',
  'RRULE:FREQ=WEEKLY;COUNT=3',
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  'DESCRIPTION:Reminder',
  'TRIGGER:-PT15M',
  'END:VALARM',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

const subscription: IcsSubscription = {
  id: 'school',
  url: 'https://example.com/school.ics',
  name: 'School',
  color: '#123456',
  enabled: true,
}

function makeEvent(uid: string, title: string): SubscribedEvent {
  return {
    id: uid,
    uid,
    title,
    date: '2026-10-03',
    memberIds: [],
    sourceSubscriptionId: '',
    icalComponent: [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `SUMMARY:${title}`,
      'DTSTART;VALUE=DATE:20261003',
      'END:VEVENT',
    ].join('\r\n'),
    icalTimeZones: [],
  }
}

function getLocalCalendarFields(instant: string): { date: string; time: string } {
  const date = new Date(instant)
  return {
    date: [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-'),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchAndParseIcs', () => {
  it('fetches and parses a calendar into subscribed event data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(calendarText)))
    const expectedStart = getLocalCalendarFields('2026-10-03T14:00:00Z')
    const expectedEnd = getLocalCalendarFields('2026-10-03T15:00:00Z')

    await expect(fetchAndParseIcs(subscription.url, 'https://proxy.example/?')).resolves.toMatchObject([
      {
        id: 'school-event@example.com',
        uid: 'school-event@example.com',
        title: 'School Event',
        date: expectedStart.date,
        startTime: expectedStart.time,
        endTime: expectedEnd.time,
        description: 'Bring a notebook',
      },
    ])
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(subscription.url)
  })

  it('retries a network failure through the configured proxy', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(calendarText))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchAndParseIcs(subscription.url, 'https://proxy.example/?')).resolves.toHaveLength(1)
    expect(fetchMock).toHaveBeenNthCalledWith(2, `https://proxy.example/?${encodeURIComponent(subscription.url)}`)
  })

  it('uses the browser local timezone for TZID timed events and keeps source data unchanged', async () => {
    const previousTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    vi.stubEnv('TZ', 'America/Los_Angeles')
    const calendarWithTimeZone = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VTIMEZONE',
      'TZID:America/New_York',
      'BEGIN:DAYLIGHT',
      'DTSTART:19700308T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0400',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'DTSTART:19701101T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'TZOFFSETFROM:-0400',
      'TZOFFSETTO:-0500',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      'UID:timezone-boundary@example.com',
      'DTSTART;TZID=America/New_York:20261003T003000',
      'DTEND;TZID=America/New_York:20261003T013000',
      'SUMMARY:Timezone boundary event',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:all-day@example.com',
      'DTSTART;VALUE=DATE:20261003',
      'DTEND;VALUE=DATE:20261004',
      'SUMMARY:All day event',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(calendarWithTimeZone)))

    try {
      const events = await fetchAndParseIcs(subscription.url)
      expect(events[0]).toMatchObject({
        date: '2026-10-02',
        startTime: '21:30',
        endTime: '22:30',
      })
      expect(events[0]?.icalComponent).toContain('DTSTART;TZID=America/New_York:20261003T003000')
      expect(events[1]).toMatchObject({ date: '2026-10-03' })
      expect(events[1]?.startTime).toBeUndefined()
    } finally {
      vi.stubEnv('TZ', previousTimezone)
    }
  })

  it('supports a proxy URL placeholder and does not retry HTTP errors', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(calendarText))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchAndParseIcs(subscription.url, 'https://proxy.example/?url={url}')).resolves.toHaveLength(1)
    expect(fetchMock).toHaveBeenNthCalledWith(2, `https://proxy.example/?url=${encodeURIComponent(subscription.url)}`)

    fetchMock.mockReset().mockResolvedValue(new Response('not found', { status: 404 }))
    await expect(fetchAndParseIcs(subscription.url, 'https://proxy.example/?')).rejects.toThrow('HTTP 404')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('preserves HTTP status errors for credentialed URLs without proxy retries', async () => {
    const url = new URL(subscription.url)
    url.username = 'fixture-user'
    url.password = 'fixture-password'
    const fetchMock = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchAndParseIcs(url.toString(), 'https://proxy.example/?')).rejects.toThrow('HTTP 401')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('rejects empty URLs and network failures without a proxy', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Offline'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchAndParseIcs('  ', 'https://proxy.example/?')).rejects.toThrow('ICS URL is required')
    await expect(fetchAndParseIcs(subscription.url)).rejects.toThrow('Offline')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not expose embedded URL credentials in fetch errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Offline')))
    const url = new URL(subscription.url)
    url.username = 'fixture-user'
    url.password = 'fixture-password'

    await expect(fetchAndParseIcs(url.toString(), 'https://proxy.example/?'))
      .rejects.toThrow('https://example.com/school.ics')
    await expect(fetchAndParseIcs(url.toString(), 'https://proxy.example/?'))
      .rejects.not.toThrow('fixture-password')
  })

  it('does not expose embedded credentials in invalid-calendar errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('BEGIN:VTODO\r\nEND:VTODO')))
    const url = new URL(subscription.url)
    url.username = 'fixture-user'
    url.password = 'fixture-password'

    await expect(fetchAndParseIcs(url.toString()))
      .rejects.toThrow('not a valid VCALENDAR')
    await expect(fetchAndParseIcs(url.toString()))
      .rejects.not.toThrow('fixture-password')
  })

  it('sends URL-embedded Basic Auth directly and never retries credentials through a proxy', async () => {
    const url = new URL(subscription.url)
    url.username = 'fixture%40user'
    url.password = 'fixture-password'
    const fetchMock = vi.fn().mockResolvedValue(new Response(calendarText))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchAndParseIcs(url.toString(), 'https://proxy.example/?')).resolves.toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(subscription.url, {
      headers: { Authorization: `Basic ${btoa('fixture@user:fixture-password')}` },
    })

    fetchMock.mockReset().mockRejectedValue(new TypeError('CORS blocked'))
    await expect(fetchAndParseIcs(url.toString(), 'https://proxy.example/?'))
      .rejects.toThrow('credentials are not sent to a proxy')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(subscription.url, {
      headers: { Authorization: `Basic ${btoa('fixture@user:fixture-password')}` },
    })
  })

  it('rejects non-calendar documents and VEVENTs without a start time', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('BEGIN:VTODO\r\nEND:VTODO'))
      .mockResolvedValueOnce(new Response([
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'UID:missing-start@example.com',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n')))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchAndParseIcs(subscription.url)).rejects.toThrow('not a valid VCALENDAR')
    await expect(fetchAndParseIcs(subscription.url)).rejects.toThrow('missing a DTSTART')
  })

  it('rejects VEVENTs without a UID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'DTSTART:20261003T140000Z',
      'SUMMARY:Missing UID',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n'))))

    await expect(fetchAndParseIcs(subscription.url)).rejects.toThrow('missing a UID')
  })

  it('surfaces invalid ICS instead of returning a success-shaped empty result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not an iCalendar document')))

    await expect(fetchAndParseIcs(subscription.url, 'https://proxy.example/?')).rejects.toThrow()
  })
})

describe('mergeAndStripAlarms', () => {
  it('merges enabled subscription events, annotates their source, and keeps the first duplicate UID', () => {
    const duplicateSubscription = { ...subscription, id: 'sports', name: 'Sports', color: '#abcdef' }
    const events = mergeAndStripAlarms(
      [subscription, duplicateSubscription, { ...subscription, id: 'disabled', enabled: false }],
      new Map([
        ['school', [makeEvent('shared@example.com', 'School copy')]],
        ['sports', [makeEvent('shared@example.com', 'Sports copy')]],
        ['disabled', [makeEvent('ignored@example.com', 'Ignored')]],
      ]),
    )

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      uid: 'shared@example.com',
      title: 'School copy',
      sourceSubscriptionId: 'school',
      sourceName: 'School',
      color: '#123456',
    })
  })

  it('returns no events when no enabled subscriptions have fetched data', () => {
    expect(mergeAndStripAlarms([{ ...subscription, enabled: false }], new Map())).toEqual([])
  })

  it('keeps recurrence overrides from one calendar but deduplicates another calendar with the same UID', async () => {
    const recurringCalendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:weekly@example.com',
      'DTSTART:20261003T140000Z',
      'DTEND:20261003T150000Z',
      'RRULE:FREQ=WEEKLY;COUNT=3',
      'SUMMARY:Weekly meeting',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:weekly@example.com',
      'RECURRENCE-ID:20261010T140000Z',
      'DTSTART:20261010T150000Z',
      'DTEND:20261010T160000Z',
      'SUMMARY:Rescheduled meeting',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(recurringCalendar)))
    const parsedEvents = await fetchAndParseIcs(subscription.url)
    const merged = mergeAndStripAlarms(
      [subscription, { ...subscription, id: 'other', name: 'Other' }],
      new Map([
        ['school', parsedEvents],
        ['other', [makeEvent('weekly@example.com', 'Duplicate calendar event')]],
      ]),
    )

    expect(merged).toHaveLength(2)
    expect(merged.map((event) => event.title)).toEqual(['Weekly meeting', 'Rescheduled meeting'])
    expect(merged.map((event) => event.id)).toEqual([
      'school:weekly@example.com',
      'school:weekly@example.com:2026-10-10T14:00:00Z',
    ])
  })
})

describe('exportToIcsString', () => {
  it('exports a valid empty calendar', () => {
    const exported = exportToIcsString([])

    expect(exported).toContain('BEGIN:VCALENDAR')
    expect(exported).toContain('VERSION:2.0')
    expect(exported).toContain('END:VCALENDAR')
  })

  it('preserves event data while excluding VALARM components', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(calendarText)))
    const parsedEvents = await fetchAndParseIcs(subscription.url, 'https://proxy.example/?')
    const mergedEvents = mergeAndStripAlarms([subscription], new Map([['school', parsedEvents]]))
    const exported = exportToIcsString(mergedEvents)

    expect(exported).toContain('UID:school-event@example.com')
    expect(exported).toContain('RRULE:FREQ=WEEKLY;COUNT=3')
    expect(exported).not.toContain('VALARM')
  })

  it('preserves required timezone definitions in the exported calendar', async () => {
    const calendarWithTimeZone = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VTIMEZONE',
      'TZID:Example/Zone',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0000',
      'TZOFFSETTO:+0000',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      'UID:timezone-event@example.com',
      'DTSTART;TZID=Example/Zone:20261003T140000',
      'DTEND;TZID=Example/Zone:20261003T150000',
      'SUMMARY:Timezone Event',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(calendarWithTimeZone)))
    const parsedEvents = await fetchAndParseIcs(subscription.url)
    const exported = exportToIcsString(mergeAndStripAlarms([subscription], new Map([['school', parsedEvents]])))

    expect(exported).toContain('BEGIN:VTIMEZONE')
    expect(exported).toContain('TZID:Example/Zone')
  })

  it('renames conflicting source TZIDs and rewrites event and recurrence references', async () => {
    const makeCalendar = (uid: string, offset: string, eventProps: string[]) => [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VTIMEZONE',
      'TZID:Custom/Zone',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      `TZOFFSETFROM:${offset}`,
      `TZOFFSETTO:${offset}`,
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      ...eventProps,
      'SUMMARY:Zone-specific event',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const schoolCalendar = makeCalendar('school-zone@example.com', '-0500', [
      'DTSTART;TZID=Custom/Zone:20261003T140000',
      'DTEND;TZID=Custom/Zone:20261003T150000',
    ])
    const sportsCalendar = makeCalendar('sports-zone@example.com', '+0900', [
      'DTSTART;TZID=Custom/Zone:20261010T140000',
      'DTEND;TZID=Custom/Zone:20261010T150000',
      'RECURRENCE-ID;TZID=Custom/Zone:20261003T140000',
    ])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(schoolCalendar))
      .mockResolvedValueOnce(new Response(sportsCalendar))
    vi.stubGlobal('fetch', fetchMock)
    const [schoolEvents, sportsEvents] = await Promise.all([
      fetchAndParseIcs('https://example.com/school.ics'),
      fetchAndParseIcs('https://example.com/sports.ics'),
    ])
    const merged = mergeAndStripAlarms(
      [subscription, { ...subscription, id: 'sports', name: 'Sports' }],
      new Map([
        ['school', schoolEvents],
        ['sports', sportsEvents],
      ]),
    )
    const exported = exportToIcsString(merged)

    expect(exported).toContain('TZID:Custom/Zone\r\n')
    expect(exported).toContain('TZID:Custom/Zone-family-calendar-sports\r\n')
    expect(exported).toContain('DTSTART;TZID=Custom/Zone:20261003T140000')
    expect(exported).toContain('DTSTART;TZID=Custom/Zone-family-calendar-sports:20261010T140000')
    expect(exported).toContain('RECURRENCE-ID;TZID=Custom/Zone-family-calendar-sports:20261003T140000')
    expect(exported).toContain('TZOFFSETTO:-0500')
    expect(exported).toContain('TZOFFSETTO:+0900')
  })
})
