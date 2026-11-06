import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { loadFamilySettings, loadSmtpSettings } from './settings.js'
import { requireUser, ensureSameOrigin, sendApiError } from './route-utils.js'
import type { MailTransportFactory } from '../settings/mail.js'

interface InvitationInput {
  method?: unknown
  sequence?: unknown
  recurrenceId?: unknown
}

interface EventData {
  title?: string
  date?: string
  startTime?: string
  endTime?: string
  description?: string
  memberIds?: string[]
  seriesExceptions?: Array<{
    date: string
    type: 'modified' | 'deleted'
    overrides?: Partial<EventData>
  }>
}

function escapeIcal(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function formatIcalDateTime(value: Date): string {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function parseIcalDate(date: string): Date {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Invalid event date.')
  }
  return parsed
}

function isValidIcalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    parseIcalDate(value)
    return true
  } catch {
    return false
  }
}

function parseIcalDateTime(date: string, time: string): Date {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Invalid event date or time.')
  }
  const parsed = parseIcalDate(date)
  const [hours, minutes] = time.split(':').map(Number)
  parsed.setUTCHours(Number(hours), Number(minutes))
  return parsed
}

export function buildInvitationIcs(
  event: EventData,
  id: string,
  method: 'REQUEST' | 'CANCEL',
  sequence: number,
  recurrenceId?: string,
  recurrenceTime?: string | null,
  organizer?: { name?: string | null; email?: string | null },
) {
  const date = recurrenceId ?? event.date ?? ''
  const parsedDate = parseIcalDate(date)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Family Calendar//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${id}@family-calendar`,
    `DTSTAMP:${formatIcalDateTime(new Date())}`,
  ]
  if (event.startTime) {
    const start = parseIcalDateTime(date, event.startTime)
    lines.push(`DTSTART:${formatIcalDateTime(start)}`)
    const end = event.endTime
      ? parseIcalDateTime(date, event.endTime)
      : new Date(start.getTime() + 60 * 60 * 1000)
    if (event.endTime && end <= start) end.setUTCDate(end.getUTCDate() + 1)
    lines.push(`DTEND:${formatIcalDateTime(end)}`)
  } else {
    const end = new Date(parsedDate)
    end.setUTCDate(end.getUTCDate() + 1)
    lines.push(`DTSTART;VALUE=DATE:${date.replaceAll('-', '')}`)
    lines.push(`DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll('-', '')}`)
  }
  if (recurrenceId) {
    const recurrenceDate = parseIcalDate(recurrenceId)
    const originalStartTime = recurrenceTime === undefined ? event.startTime : recurrenceTime
    lines.push(originalStartTime
      ? `RECURRENCE-ID:${formatIcalDateTime(parseIcalDateTime(recurrenceId, originalStartTime))}`
      : `RECURRENCE-ID;VALUE=DATE:${recurrenceDate.toISOString().slice(0, 10).replaceAll('-', '')}`)
  }
  if (organizer?.email) {
    const organizerName = organizer.name
      ? `;CN="${organizer.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      : ''
    const mailtoAddress = encodeURIComponent(organizer.email).replace(/%40/gi, '@')
    lines.push(`ORGANIZER${organizerName}:mailto:${mailtoAddress}`)
  }
  lines.push(
    `SUMMARY:${escapeIcal(event.title ?? '')}`,
    `SEQUENCE:${sequence}`,
  )
  if (event.description) lines.push(`DESCRIPTION:${escapeIcal(event.description)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export function deliveryResults(recipients: string[], accepted: string[]) {
  const acceptedAddresses = new Set(accepted.map((address) => address.toLowerCase()))
  return recipients.map((recipientEmail) => acceptedAddresses.has(recipientEmail.toLowerCase())
    ? { status: 'sent' as const, recipientEmail }
    : { status: 'failed' as const, recipientEmail, error: 'Delivery failed.' })
}

export function registerInvitationRoutes(
  app: FastifyInstance,
  pool: Pool,
  sessionSecret: string,
  encryptionKey: Buffer,
  mailTransportFactory: MailTransportFactory,
): void {
  app.post<{ Params: { eventId: string }; Body: InvitationInput }>(
    '/api/calendar/events/:eventId/invitations',
    async (request, reply) => {
      if (!ensureSameOrigin(request, reply)) return
      const user = await requireUser(pool, request, reply, sessionSecret)
      if (!user) return
      const input = request.body ?? {}
      if (!['REQUEST', 'CANCEL'].includes(String(input.method)) ||
          !Number.isInteger(input.sequence) || Number(input.sequence) < 0 ||
          (input.recurrenceId !== undefined &&
            !isValidIcalDate(input.recurrenceId))) {
        return sendApiError(reply, 422, 'INVALID_INVITATION', 'Enter a valid invitation action.')
      }

      const eventResult = await pool.query<{ id: string; data: EventData }>(
        'SELECT id, data FROM calendar_events WHERE id = $1',
        [request.params.eventId],
      )
      const event = eventResult.rows[0]
      if (!event) return sendApiError(reply, 404, 'NOT_FOUND', 'Event not found.')
      const recurrenceId = typeof input.recurrenceId === 'string' ? input.recurrenceId : undefined
      const exception = recurrenceId
        ? event.data.seriesExceptions?.find((item) => item.date === recurrenceId)
        : undefined
      const eventData: EventData = {
        ...event.data,
        ...(recurrenceId ? { date: recurrenceId } : {}),
        ...(exception?.type === 'modified' ? exception.overrides : {}),
      }
      const memberIds = eventData.memberIds ?? []
      const members = await pool.query<{ email: string | null }>(
        `SELECT data->>'email' AS email FROM family_members WHERE id = ANY($1::uuid[])`,
        [memberIds],
      )
      const recipients = [...new Set(members.rows.map((row) => row.email).filter((email): email is string => Boolean(email)))]
      const settings = await loadSmtpSettings(pool, encryptionKey)
      const familySettings = await loadFamilySettings(pool)
      if (!settings) {
        return sendApiError(reply, 422, 'SMTP_NOT_CONFIGURED', 'Configure and save SMTP settings before sending invitations.')
      }
      if (recipients.length === 0) return { results: [] }

      const message = {
        from: settings.fromName ? { name: settings.fromName, address: settings.fromAddress } : settings.fromAddress,
        to: recipients,
        subject: `${input.method === 'CANCEL' ? 'Cancelled: ' : ''}${event.data.title ?? 'Calendar event'}`,
        text: `${input.method === 'CANCEL' ? 'Cancelled: ' : ''}${event.data.title ?? 'Calendar event'} on ${event.data.date ?? ''}`,
        icalEvent: {
          method: input.method,
          filename: 'invite.ics',
          content: buildInvitationIcs(
            eventData,
            event.id,
            input.method as 'REQUEST' | 'CANCEL',
            Number(input.sequence),
            recurrenceId,
            event.data.startTime ?? null,
            {
              name: typeof familySettings.data['organizerName'] === 'string'
                ? familySettings.data['organizerName']
                : null,
              email: typeof familySettings.data['organizerEmail'] === 'string'
                ? familySettings.data['organizerEmail']
                : null,
            },
          ),
        },
      }
      try {
        const transport = mailTransportFactory(settings)
        const result = await transport.sendMail(message)
        return { results: deliveryResults(recipients, (result.accepted ?? []).map(String)) }
      } catch {
        return {
          results: recipients.map((recipientEmail) => ({
            status: 'failed',
            recipientEmail,
            error: 'Delivery failed.',
          })),
        }
      }
    },
  )
}
