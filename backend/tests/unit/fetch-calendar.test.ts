import { describe, expect, it, vi } from 'vitest'
import { createPinnedLookup, fetchCalendarSafely, raceWithAbort } from '../../src/feed/fetch-calendar.js'

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

  it('returns the pinned DNS address in the shape requested by Node', () => {
    const lookup = createPinnedLookup('calendar.example.org', { address: '203.0.113.1', family: 4 })
    const allResults = vi.fn()
    const singleResult = vi.fn()

    lookup('calendar.example.org', { all: true }, allResults)
    lookup('calendar.example.org', { all: false }, singleResult)

    expect(allResults).toHaveBeenCalledWith(null, [{ address: '203.0.113.1', family: 4 }])
    expect(singleResult).toHaveBeenCalledWith(null, '203.0.113.1', 4)
  })

  it('aborts in-flight DNS work when the overall deadline expires', async () => {
    const controller = new AbortController()
    const pending = new Promise<string>(() => undefined)
    const result = raceWithAbort(pending, controller.signal)
    controller.abort()

    await expect(result).rejects.toThrow(/timed out/i)
  })
})
