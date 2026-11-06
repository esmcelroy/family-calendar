import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadICalendar, generateICalendar } from './ical'
import type { CalendarEvent, FamilyMember } from './types'

const event: CalendarEvent = {
  id: 'event-1',
  title: 'Family dinner',
  date: '2026-11-06',
  startTime: '18:00',
  endTime: '19:00',
  memberIds: ['member-1'],
}

const members: FamilyMember[] = [
  { id: 'member-1', name: 'Alex', color: 'blue' },
]

describe('local iCalendar export', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('generates a local calendar file from current events and family members', () => {
    const ical = generateICalendar([event], members)

    expect(ical).toContain('BEGIN:VCALENDAR')
    expect(ical).toContain('METHOD:PUBLISH')
    expect(ical).toContain('SUMMARY:Family dinner')
    expect(ical).toContain('CATEGORIES:Alex')
    expect(ical).toContain('END:VCALENDAR')
  })

  it('downloads the generated content as a text/calendar file', () => {
    const click = vi.fn()
    const appendChild = vi.spyOn(document.body, 'appendChild')
    const removeChild = vi.spyOn(document.body, 'removeChild')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-calendar')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLAnchorElement
      element.click = click
      return element
    })

    downloadICalendar(generateICalendar([event], members), 'family-calendar.ics')

    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(appendChild).toHaveBeenCalledOnce()
    expect(removeChild).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-calendar')
  })
})
