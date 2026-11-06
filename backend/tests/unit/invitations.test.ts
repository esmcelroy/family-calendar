import { describe, expect, it } from 'vitest'
import { buildInvitationIcs, deliveryResults } from '../../src/routes/invitations.js'

describe('invitation calendar payloads', () => {
  it('preserves timed event start and end values', () => {
    const calendar = buildInvitationIcs(
      { title: 'Family lunch', date: '2026-11-06', startTime: '09:30', endTime: '10:15' },
      'event-id',
      'REQUEST',
      0,
    )

    expect(calendar).toContain('DTSTART:20261106T093000')
    expect(calendar).toContain('DTEND:20261106T101500')
    expect(calendar).not.toContain('DTSTART;VALUE=DATE')
  })

  it('uses the next day as the end for all-day events', () => {
    const calendar = buildInvitationIcs(
      { title: 'Family day', date: '2026-11-06' },
      'event-id',
      'REQUEST',
      0,
    )

    expect(calendar).toContain('DTSTART;VALUE=DATE:20261106')
    expect(calendar).toContain('DTEND;VALUE=DATE:20261107')
  })

  it('moves an overnight event end to the following day', () => {
    const calendar = buildInvitationIcs(
      { title: 'Late event', date: '2026-11-06', startTime: '23:30', endTime: '00:15' },
      'event-id',
      'REQUEST',
      0,
    )

    expect(calendar).toContain('DTSTART:20261106T233000')
    expect(calendar).toContain('DTEND:20261107T001500')
  })

  it('identifies the requested recurring occurrence in an invitation', () => {
    const calendar = buildInvitationIcs(
      { title: 'Family lunch', date: '2026-11-13', startTime: '09:30', endTime: '10:15' },
      'event-id',
      'REQUEST',
      1,
      '2026-11-13',
    )

    expect(calendar).toContain('DTSTART:20261113T093000')
    expect(calendar).toContain('RECURRENCE-ID:20261113T093000')
  })

  it('keeps the original recurrence start when an occurrence time changes', () => {
    const calendar = buildInvitationIcs(
      { title: 'Family lunch', date: '2026-11-13', startTime: '10:30', endTime: '11:15' },
      'event-id',
      'REQUEST',
      1,
      '2026-11-13',
      '09:30',
    )

    expect(calendar).toContain('DTSTART:20261113T103000')
    expect(calendar).toContain('RECURRENCE-ID:20261113T093000')
  })

  it('keeps all-day recurrence identity when an occurrence gains a time', () => {
    const calendar = buildInvitationIcs(
      { title: 'Family lunch', date: '2026-11-13', startTime: '10:30', endTime: '11:15' },
      'event-id',
      'REQUEST',
      1,
      '2026-11-13',
      null,
    )

    expect(calendar).toContain('RECURRENCE-ID;VALUE=DATE:20261113')
  })

  it('includes the configured organizer identity in the invitation calendar', () => {
    const calendar = buildInvitationIcs(
      { title: 'Family lunch', date: '2026-11-06' },
      'event-id',
      'REQUEST',
      0,
      undefined,
      undefined,
      { name: 'Family; Calendar', email: 'family@example.org' },
    )

    expect(calendar).toContain('ORGANIZER;CN="Family; Calendar":mailto:family@example.org')
  })

  it('serializes whole-series recurrence, exceptions, and recipients', () => {
    const calendar = buildInvitationIcs(
      {
        title: 'Family lunch',
        date: '2026-11-06',
        startTime: '09:30',
        endTime: '10:15',
        recurrence: { frequency: 'weekly', interval: 1, endType: 'count', endCount: 4 },
        seriesExceptions: [
          { date: '2026-11-13', type: 'deleted' },
          {
            date: '2026-11-20',
            type: 'modified',
            overrides: { title: 'Later lunch', startTime: '10:30', endTime: '11:15' },
          },
        ],
      },
      'event-id',
      'REQUEST',
      2,
      undefined,
      undefined,
      undefined,
      [{ name: 'Alex; Smith', email: 'alex@example.org' }],
    )

    expect(calendar).toContain('RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=4')
    expect(calendar).toContain('EXDATE:20261113T093000')
    expect(calendar).toContain('RECURRENCE-ID:20261120T093000')
    expect(calendar).toContain('DTSTART:20261120T103000')
    expect(calendar).toContain('SUMMARY:Later lunch')
    expect(calendar).toContain('ATTENDEE;CN="Alex; Smith";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:alex@example.org')
  })

  it('rejects impossible dates rather than normalizing them', () => {
    expect(() => buildInvitationIcs(
      { title: 'Invalid date', date: '2026-02-31' },
      'event-id',
      'REQUEST',
      0,
    )).toThrow('Invalid event date.')
  })

  it('marks each recipient according to the SMTP accepted list', () => {
    expect(deliveryResults(
      ['rejected@example.org', 'accepted@example.org'],
      ['accepted@example.org'],
    )).toEqual([
      { status: 'failed', recipientEmail: 'rejected@example.org', error: 'Delivery failed.' },
      { status: 'sent', recipientEmail: 'accepted@example.org' },
    ])
  })

  it('does not report all recipients as sent when SMTP accepts none', () => {
    expect(deliveryResults(['rejected@example.org'], [])).toEqual([
      { status: 'failed', recipientEmail: 'rejected@example.org', error: 'Delivery failed.' },
    ])
  })
})
