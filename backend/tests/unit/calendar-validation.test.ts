import { describe, expect, it } from 'vitest'
import { normalizeEvent } from '../../src/routes/calendar.js'

const eventId = 'c0a80123-4567-4890-8abc-123456789012'
const baseEvent = {
  title: 'Weekly dinner',
  date: '2026-11-06',
  memberIds: [],
}

describe('calendar event validation', () => {
  it('accepts supported recurrence rules and exception overrides', () => {
    const event = normalizeEvent({
      ...baseEvent,
      recurrence: { frequency: 'weekly', interval: 1, selectedDays: [5], endType: 'none' },
      seriesExceptions: [{
        date: '2026-11-13',
        type: 'modified',
        overrides: { title: 'Dinner moved', startTime: '18:30', memberIds: [] },
      }],
    }, eventId)

    expect(event).toMatchObject({
      recurrence: { frequency: 'weekly', interval: 1, selectedDays: [5], endType: 'none' },
      seriesExceptions: [{ date: '2026-11-13', type: 'modified' }],
    })
  })

  it.each([
    { frequency: 'fortnightly', interval: 1, endType: 'none' },
    { frequency: 'weekly', interval: 0, endType: 'none' },
    { frequency: 'weekly', interval: 1, selectedDays: [7], endType: 'none' },
    { frequency: 'daily', interval: 1, endType: 'date', endDate: 'not-a-date' },
    { frequency: 'daily', interval: 1, endType: 'count', endCount: 0 },
  ])('rejects invalid recurrence data: %o', (recurrence) => {
    expect(normalizeEvent({ ...baseEvent, recurrence }, eventId)).toBeNull()
  })

  it('rejects malformed or duplicate series exceptions', () => {
    expect(normalizeEvent({
      ...baseEvent,
      seriesExceptions: [{ date: '2026-11-13', type: 'modified', overrides: { startTime: '25:00' } }],
    }, eventId)).toBeNull()
    expect(normalizeEvent({
      ...baseEvent,
      seriesExceptions: [
        { date: '2026-11-13', type: 'deleted' },
        { date: '2026-11-13', type: 'deleted' },
      ],
    }, eventId)).toBeNull()
  })
})
