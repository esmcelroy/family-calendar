import { isIP } from 'node:net'
import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { requireUser, ensureSameOrigin, sendApiError } from './route-utils.js'

interface CalendarEventInput {
  title?: unknown
  date?: unknown
  startTime?: unknown
  endTime?: unknown
  description?: unknown
  memberIds?: unknown
  seriesId?: unknown
  recurrence?: unknown
  seriesExceptions?: unknown
  recurrenceMeta?: unknown
  sequence?: unknown
}

interface FamilyMemberInput {
  name?: unknown
  color?: unknown
  email?: unknown
  preferredPlatform?: unknown
}

interface SubscriptionInput {
  displayName?: unknown
  sourceUrl?: unknown
  color?: unknown
  enabled?: unknown
}

interface EventRecord {
  id: string
  data: Record<string, unknown>
  member_ids: string[]
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const PLATFORMS = new Set(['google', 'apple', 'outlook', 'other'])
const RECURRENCE_FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'yearly'])
const RECURRENCE_END_TYPES = new Set(['none', 'date', 'count'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

function validOverrides(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const allowedFields = new Set(['title', 'date', 'startTime', 'endTime', 'description', 'memberIds', 'seriesId', 'sequence'])
  if (!Object.keys(value).every((key) => allowedFields.has(key))) return false
  if ('title' in value && (typeof value['title'] !== 'string' || value['title'].trim().length === 0 || value['title'].length > 500)) return false
  if ('date' in value && !validDate(value['date'])) return false
  if ('startTime' in value && !TIME_PATTERN.test(String(value['startTime']))) return false
  if ('endTime' in value && !TIME_PATTERN.test(String(value['endTime']))) return false
  if ('description' in value && (typeof value['description'] !== 'string' || value['description'].length > 10_000)) return false
  if ('memberIds' in value && (!Array.isArray(value['memberIds']) ||
    !value['memberIds'].every((memberId) => typeof memberId === 'string' && UUID_PATTERN.test(memberId)))) return false
  if ('seriesId' in value && typeof value['seriesId'] !== 'string') return false
  if ('sequence' in value && (!Number.isInteger(value['sequence']) || Number(value['sequence']) < 0)) return false
  return true
}

function validRecurrence(value: unknown): boolean {
  if (!isRecord(value)) return false
  const allowedFields = new Set(['frequency', 'interval', 'selectedDays', 'endType', 'endDate', 'endCount'])
  if (!Object.keys(value).every((key) => allowedFields.has(key))) return false
  if (typeof value['frequency'] !== 'string' || !RECURRENCE_FREQUENCIES.has(value['frequency'])) return false
  if (!Number.isInteger(value['interval']) || Number(value['interval']) < 1) return false
  if (typeof value['endType'] !== 'string' || !RECURRENCE_END_TYPES.has(value['endType'])) return false
  if (value['selectedDays'] !== undefined &&
    (!Array.isArray(value['selectedDays']) ||
      value['frequency'] !== 'weekly' ||
      !value['selectedDays'].every((day) => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6))) return false

  if (value['endType'] === 'date') {
    return validDate(value['endDate']) && value['endCount'] === undefined
  }
  if (value['endType'] === 'count') {
    return Number.isInteger(value['endCount']) && Number(value['endCount']) >= 1 && value['endDate'] === undefined
  }
  return value['endDate'] === undefined && value['endCount'] === undefined
}

function validSeriesExceptions(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  const dates = new Set<string>()
  for (const exception of value) {
    if (!isRecord(exception) || !validDate(exception['date']) ||
      (exception['type'] !== 'modified' && exception['type'] !== 'deleted') ||
      !Object.keys(exception).every((key) => ['date', 'type', 'overrides'].includes(key))) return false
    if (dates.has(exception['date'])) return false
    dates.add(exception['date'])
    if (exception['type'] === 'deleted' && exception['overrides'] !== undefined) return false
    if (exception['type'] === 'modified' && !validOverrides(exception['overrides'])) return false
  }
  return true
}

export function normalizeEvent(input: CalendarEventInput, id: string): Record<string, unknown> | null {
  if (
    typeof input.title !== 'string' ||
    input.title.trim().length === 0 ||
    input.title.length > 500 ||
    !validDate(input.date) ||
    !Array.isArray(input.memberIds) ||
    !input.memberIds.every((memberId) => typeof memberId === 'string' && UUID_PATTERN.test(memberId))
  ) return null

  if (input.startTime !== undefined && !TIME_PATTERN.test(String(input.startTime))) return null
  if (input.endTime !== undefined && !TIME_PATTERN.test(String(input.endTime))) return null
  if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 10_000)) return null
  if (input.sequence !== undefined && (!Number.isInteger(input.sequence) || Number(input.sequence) < 0)) return null
  if (input.recurrence !== undefined && input.recurrence !== null && !validRecurrence(input.recurrence)) return null
  if (input.seriesExceptions !== undefined && !validSeriesExceptions(input.seriesExceptions)) return null

  const memberIds = [...new Set(input.memberIds as string[])]
  const recurrence = input.recurrence !== undefined ? input.recurrence : undefined
  return {
    id,
    title: input.title.trim(),
    date: input.date,
    ...(input.startTime ? { startTime: input.startTime } : {}),
    ...(input.endTime ? { endTime: input.endTime } : {}),
    ...(input.description ? { description: input.description } : {}),
    memberIds,
    ...(typeof input.seriesId === 'string'
      ? { seriesId: input.seriesId }
      : recurrence !== undefined && recurrence !== null
        ? { seriesId: id }
        : {}),
    ...(input.recurrence !== undefined ? { recurrence: input.recurrence } : {}),
    ...(input.seriesExceptions !== undefined ? { seriesExceptions: input.seriesExceptions } : {}),
    ...(input.recurrenceMeta !== undefined ? { recurrenceMeta: input.recurrenceMeta } : {}),
    ...(input.sequence !== undefined ? { sequence: input.sequence } : {}),
  }
}

function normalizeMember(input: FamilyMemberInput, id: string): Record<string, unknown> | null {
  if (
    typeof input.name !== 'string' ||
    input.name.trim().length === 0 ||
    input.name.length > 200 ||
    typeof input.color !== 'string' ||
    input.color.trim().length === 0 ||
    input.color.length > 100
  ) return null

  if (input.email !== undefined && input.email !== null &&
    (typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))) return null
  if (input.preferredPlatform !== undefined && input.preferredPlatform !== null &&
    (typeof input.preferredPlatform !== 'string' || !PLATFORMS.has(input.preferredPlatform))) return null

  return {
    id,
    name: input.name.trim(),
    color: input.color.trim(),
    ...(input.email ? { email: input.email } : {}),
    ...(input.preferredPlatform ? { preferredPlatform: input.preferredPlatform } : {}),
  }
}

function isPublicCalendarUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2_000) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return false
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false
    if (isIP(host)) return false
    url.hash = ''
    return true
  } catch {
    return false
  }
}

function normalizeSubscription(input: SubscriptionInput): Record<string, unknown> | null {
  if (
    typeof input.displayName !== 'string' ||
    input.displayName.trim().length === 0 ||
    input.displayName.length > 200 ||
    !isPublicCalendarUrl(input.sourceUrl)
  ) return null
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') return null
  if (input.color !== undefined && input.color !== null &&
    (typeof input.color !== 'string' || input.color.length > 100)) return null

  return {
    displayName: input.displayName.trim(),
    sourceUrl: input.sourceUrl,
    ...(typeof input.color === 'string' ? { color: input.color } : {}),
    enabled: input.enabled ?? true,
  }
}

async function memberReferencesExist(pool: Pool, memberIds: string[]): Promise<boolean> {
  const uniqueIds = [...new Set(memberIds)]
  if (uniqueIds.length === 0) return true
  const { rows } = await pool.query<{ id: string }>(
    'SELECT id FROM family_members WHERE id = ANY($1::uuid[])',
    [uniqueIds],
  )
  return rows.length === uniqueIds.length
}

function eventMemberReferences(event: Record<string, unknown>): string[] {
  const references = Array.isArray(event['memberIds']) ? [...event['memberIds']] : []
  const exceptions = Array.isArray(event['seriesExceptions']) ? event['seriesExceptions'] : []
  for (const exception of exceptions) {
    if (!isRecord(exception) || exception['type'] !== 'modified' || !isRecord(exception['overrides'])) continue
    const overrideMembers = exception['overrides']['memberIds']
    if (Array.isArray(overrideMembers)) references.push(...overrideMembers)
  }
  return references.filter((memberId): memberId is string => typeof memberId === 'string')
}

function withoutMemberReference(data: Record<string, unknown>, memberId: string): Record<string, unknown> {
  const memberIds = Array.isArray(data['memberIds'])
    ? data['memberIds'].filter((value) => value !== memberId)
    : []
  const exceptions = Array.isArray(data['seriesExceptions'])
    ? data['seriesExceptions'].map((exception) => {
      if (!isRecord(exception) || exception['type'] !== 'modified' || !isRecord(exception['overrides'])) return exception
      const overrides = exception['overrides']
      return {
        ...exception,
        overrides: Array.isArray(overrides['memberIds'])
          ? { ...overrides, memberIds: overrides['memberIds'].filter((value) => value !== memberId) }
          : overrides,
      }
    })
    : data['seriesExceptions']
  return { ...data, memberIds, ...(exceptions ? { seriesExceptions: exceptions } : {}) }
}

async function persistEvent(pool: Pool, event: Record<string, unknown>, id: string, create: boolean) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (create) {
      await client.query('INSERT INTO calendar_events (id, data) VALUES ($1, $2::jsonb)', [id, JSON.stringify(event)])
    } else {
      const updated = await client.query(
        'UPDATE calendar_events SET data = $2::jsonb, updated_at = NOW() WHERE id = $1',
        [id, JSON.stringify(event)],
      )
      if (updated.rowCount === 0) {
        await client.query('ROLLBACK')
        return false
      }
    }

    await client.query('DELETE FROM calendar_event_members WHERE event_id = $1', [id])
    const memberIds = event['memberIds'] as string[]
    if (memberIds.length > 0) {
      await client.query(
        'INSERT INTO calendar_event_members (event_id, member_id) SELECT $1, unnest($2::uuid[])',
        [id, memberIds],
      )
    }
    await client.query('COMMIT')
    return true
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

function eventListQuery() {
  return `SELECT e.id, e.data,
      COALESCE(array_agg(em.member_id) FILTER (WHERE em.member_id IS NOT NULL), ARRAY[]::uuid[]) AS member_ids
    FROM calendar_events e
    LEFT JOIN calendar_event_members em ON em.event_id = e.id
    GROUP BY e.id
    ORDER BY e.data->>'date', e.data->>'startTime', e.id`
}

export function registerCalendarRoutes(app: FastifyInstance, pool: Pool, sessionSecret: string): void {
  app.get('/api/calendar/events', async (request, reply) => {
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const { rows } = await pool.query<EventRecord>(eventListQuery())
    return { events: rows.map((row) => ({ ...row.data, id: row.id, memberIds: row.member_ids })) }
  })

  app.post<{ Body: CalendarEventInput }>('/api/calendar/events', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const id = randomUUID()
    const event = normalizeEvent(request.body ?? {}, id)
    if (!event) return sendApiError(reply, 422, 'INVALID_EVENT', 'Enter a valid calendar event.')
    if (!(await memberReferencesExist(pool, eventMemberReferences(event)))) {
      return sendApiError(reply, 422, 'INVALID_MEMBER_REFERENCE', 'Choose existing family members for this event.')
    }
    await persistEvent(pool, event, id, true)
    return reply.code(201).send(event)
  })

  app.put<{ Params: { eventId: string }; Body: CalendarEventInput }>('/api/calendar/events/:eventId', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const id = request.params.eventId
    if (!UUID_PATTERN.test(id)) return sendApiError(reply, 404, 'NOT_FOUND', 'Event not found.')
    const event = normalizeEvent(request.body ?? {}, id)
    if (!event) return sendApiError(reply, 422, 'INVALID_EVENT', 'Enter a valid calendar event.')
    if (!(await memberReferencesExist(pool, eventMemberReferences(event)))) {
      return sendApiError(reply, 422, 'INVALID_MEMBER_REFERENCE', 'Choose existing family members for this event.')
    }
    if (!(await persistEvent(pool, event, id, false))) return sendApiError(reply, 404, 'NOT_FOUND', 'Event not found.')
    return event
  })

  app.delete<{ Params: { eventId: string } }>('/api/calendar/events/:eventId', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const { rowCount } = await pool.query('DELETE FROM calendar_events WHERE id = $1', [request.params.eventId])
    if (!rowCount) return sendApiError(reply, 404, 'NOT_FOUND', 'Event not found.')
    return reply.code(204).send()
  })

  app.get('/api/calendar/members', async (request, reply) => {
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const { rows } = await pool.query<{ id: string; data: Record<string, unknown> }>(
      `SELECT id, data FROM family_members ORDER BY data->>'name', id`,
    )
    return { members: rows.map((row) => ({ ...row.data, id: row.id })) }
  })

  app.post<{ Body: FamilyMemberInput }>('/api/calendar/members', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const id = randomUUID()
    const member = normalizeMember(request.body ?? {}, id)
    if (!member) return sendApiError(reply, 422, 'INVALID_MEMBER', 'Enter a valid family member.')
    await pool.query('INSERT INTO family_members (id, data) VALUES ($1, $2::jsonb)', [id, JSON.stringify(member)])
    return reply.code(201).send(member)
  })

  app.put<{ Params: { memberId: string }; Body: FamilyMemberInput }>('/api/calendar/members/:memberId', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const id = request.params.memberId
    if (!UUID_PATTERN.test(id)) return sendApiError(reply, 404, 'NOT_FOUND', 'Family member not found.')
    const member = normalizeMember(request.body ?? {}, id)
    if (!member) return sendApiError(reply, 422, 'INVALID_MEMBER', 'Enter a valid family member.')
    const { rowCount } = await pool.query(
      'UPDATE family_members SET data = $2::jsonb, updated_at = NOW() WHERE id = $1',
      [id, JSON.stringify(member)],
    )
    if (!rowCount) return sendApiError(reply, 404, 'NOT_FOUND', 'Family member not found.')
    return member
  })

  app.delete<{ Params: { memberId: string } }>('/api/calendar/members/:memberId', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const id = request.params.memberId
    if (!UUID_PATTERN.test(id)) return sendApiError(reply, 404, 'NOT_FOUND', 'Family member not found.')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const member = await client.query('SELECT id FROM family_members WHERE id = $1 FOR UPDATE', [id])
      if (member.rowCount === 0) {
        await client.query('ROLLBACK')
        return sendApiError(reply, 404, 'NOT_FOUND', 'Family member not found.')
      }
      const events = await client.query<{ id: string; data: Record<string, unknown> }>('SELECT id, data FROM calendar_events')
      for (const event of events.rows) {
        await client.query(
          'UPDATE calendar_events SET data = $2::jsonb, updated_at = NOW() WHERE id = $1',
          [event.id, JSON.stringify(withoutMemberReference(event.data, id))],
        )
      }
      await client.query(
        `UPDATE user_preferences
         SET data = jsonb_set(
           data,
           '{activeFilters}',
           COALESCE((
             SELECT jsonb_agg(to_jsonb(filter_id))
             FROM jsonb_array_elements_text(COALESCE(data->'activeFilters', '[]'::jsonb)) AS filters(filter_id)
             WHERE filter_id <> $1
           ), '[]'::jsonb),
           true
         ), updated_at = NOW()`,
        [id],
      )
      await client.query('DELETE FROM family_members WHERE id = $1', [id])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
    return reply.code(204).send()
  })

  app.get('/api/calendar/subscriptions', async (request, reply) => {
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const { rows } = await pool.query<{
      id: string
      display_name: string
      source_url: string
      color: string | null
      enabled: boolean
      last_fetched_at: Date | null
      last_fetch_error: string | null
    }>('SELECT id, display_name, source_url, color, enabled, last_fetched_at, last_fetch_error FROM calendar_subscriptions ORDER BY display_name')
    return {
      subscriptions: rows.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        sourceUrl: row.source_url,
        color: row.color,
        enabled: row.enabled,
        lastFetchedAt: row.last_fetched_at?.toISOString() ?? null,
        lastFetchError: row.last_fetch_error,
      })),
    }
  })

  app.post<{ Body: SubscriptionInput }>('/api/calendar/subscriptions', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const subscription = normalizeSubscription(request.body ?? {})
    if (!subscription) return sendApiError(reply, 422, 'INVALID_SUBSCRIPTION', 'Enter a valid HTTPS calendar subscription URL.')
    const id = randomUUID()
    await pool.query(
      `INSERT INTO calendar_subscriptions (id, display_name, source_url, color, enabled)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, subscription['displayName'], subscription['sourceUrl'], subscription['color'] ?? null, subscription['enabled']],
    )
    return reply.code(201).send({ ...subscription, id, lastFetchedAt: null, lastFetchError: null })
  })

  app.put<{ Params: { subscriptionId: string }; Body: SubscriptionInput }>('/api/calendar/subscriptions/:subscriptionId', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const id = request.params.subscriptionId
    if (!UUID_PATTERN.test(id)) return sendApiError(reply, 404, 'NOT_FOUND', 'Calendar subscription not found.')
    const subscription = normalizeSubscription(request.body ?? {})
    if (!subscription) return sendApiError(reply, 422, 'INVALID_SUBSCRIPTION', 'Enter a valid HTTPS calendar subscription URL.')
    const { rowCount } = await pool.query(
      `UPDATE calendar_subscriptions
       SET display_name = $2, source_url = $3, color = $4, enabled = $5, updated_at = NOW()
       WHERE id = $1`,
      [id, subscription['displayName'], subscription['sourceUrl'], subscription['color'] ?? null, subscription['enabled']],
    )
    if (!rowCount) return sendApiError(reply, 404, 'NOT_FOUND', 'Calendar subscription not found.')
    return { ...subscription, id, lastFetchedAt: null, lastFetchError: null }
  })

  app.delete<{ Params: { subscriptionId: string } }>('/api/calendar/subscriptions/:subscriptionId', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const { rowCount } = await pool.query('DELETE FROM calendar_subscriptions WHERE id = $1', [request.params.subscriptionId])
    if (!rowCount) return sendApiError(reply, 404, 'NOT_FOUND', 'Calendar subscription not found.')
    return reply.code(204).send()
  })
}
