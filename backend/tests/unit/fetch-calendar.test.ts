import { describe, expect, it } from 'vitest'
import { fetchCalendarSafely } from '../../src/feed/fetch-calendar.js'

describe('bounded ICS subscription fetching', () => {
  it.each([
    'https://127.0.0.1/calendar.ics',
    'https://10.1.2.3/calendar.ics',
    'https://localhost/calendar.ics',
    'https://printer.local/calendar.ics',
  ])('rejects local or literal private destination %s before making a request', async (url) => {
    await expect(fetchCalendarSafely(url)).rejects.toThrow(/public/i)
  })

  it('rejects non-HTTPS subscriptions before resolving or connecting', async () => {
    await expect(fetchCalendarSafely('http://calendar.example.org/family.ics')).rejects.toThrow(/HTTPS/i)
  })
})
