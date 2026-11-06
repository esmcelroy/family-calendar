import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../../src/server.js'
import { runMigrations } from '../../src/db/migrate.js'

const databaseUrl = process.env['TEST_DATABASE_URL']

describe.skipIf(!databaseUrl)('shared calendar and user preferences', () => {
  const schema = `calendar_test_${randomUUID().replaceAll('-', '')}`
  let adminPool: Pool
  let pool: Pool
  let app: ReturnType<typeof buildServer>
  let adminCookie: string

  beforeAll(async () => {
    if (!databaseUrl) return
    adminPool = new Pool({ connectionString: databaseUrl })
    await adminPool.query(`CREATE SCHEMA "${schema}"`)
    pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` })
    await runMigrations(pool)
    app = buildServer({
      sessionSecret: 'test-session-secret-at-least-32-characters',
      smtpEncryptionKey: Buffer.alloc(32, 4),
      trustProxy: false,
      db: pool,
      staticRoot: new URL('../../test-fixtures/static/', import.meta.url).pathname,
      logger: false,
    })
  })

  beforeEach(async () => {
    await pool.query('TRUNCATE feed_credentials, family_settings, calendar_subscriptions, calendar_event_members, calendar_events, family_members, user_preferences, sessions, users CASCADE')
    await pool.query("INSERT INTO family_settings (id, data) VALUES (1, '{}'::jsonb)")
    const bootstrap = await app.inject({
      method: 'POST',
      url: '/api/auth/bootstrap',
      payload: { username: 'admin', password: 'a-strong-password' },
    })
    const cookie = bootstrap.headers['set-cookie']
    adminCookie = Array.isArray(cookie) ? cookie[0] ?? '' : cookie ?? ''
  })

  afterAll(async () => {
    if (app) await app.close()
    if (pool) await pool.end()
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await adminPool.end()
    }
  })

  it('creates shared events with recurrence intact and reads them across accounts', async () => {
    const memberResponse = await app.inject({
      method: 'POST',
      url: '/api/calendar/members',
      headers: { cookie: adminCookie },
      payload: { name: 'Alex', color: 'blue' },
    })
    expect(memberResponse.statusCode).toBe(201)
    const member = memberResponse.json()

    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/calendar/events',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Weekly dinner',
        date: '2026-11-06',
        memberIds: [member.id],
        recurrence: { frequency: 'weekly', interval: 1, endType: 'none' },
        seriesExceptions: [{ date: '2026-11-13', type: 'deleted' }],
        sequence: 2,
      },
    })
    expect(eventResponse.statusCode).toBe(201)

    await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminCookie },
      payload: { username: 'alex', password: 'another-strong-password', role: 'member' },
    })
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alex', password: 'another-strong-password' },
    })
    const memberCookie = login.headers['set-cookie']
    const events = await app.inject({
      method: 'GET',
      url: '/api/calendar/events',
      headers: { cookie: Array.isArray(memberCookie) ? memberCookie[0] : memberCookie },
    })

    expect(events.statusCode).toBe(200)
    expect(events.json().events[0]).toMatchObject({
      title: 'Weekly dinner',
      memberIds: [member.id],
      seriesId: eventResponse.json().id,
      recurrence: { frequency: 'weekly' },
      seriesExceptions: [{ type: 'deleted' }],
      sequence: 2,
    })
  })

  it('shares subscription CRUD and removes deleted member references from events', async () => {
    const memberResponse = await app.inject({
      method: 'POST',
      url: '/api/calendar/members',
      headers: { cookie: adminCookie },
      payload: { name: 'Sam', color: 'green' },
    })
    const member = memberResponse.json()
    const eventResponse = await app.inject({
      method: 'POST',
      url: '/api/calendar/events',
      headers: { cookie: adminCookie },
      payload: { title: 'Appointment', date: '2026-11-08', memberIds: [member.id] },
    })
    const event = eventResponse.json()

    const subscription = await app.inject({
      method: 'POST',
      url: '/api/calendar/subscriptions',
      headers: { cookie: adminCookie },
      payload: { displayName: 'School calendar', sourceUrl: 'https://calendar.example.org/family.ics' },
    })
    expect(subscription.statusCode).toBe(201)
    const listed = await app.inject({
      method: 'GET',
      url: '/api/calendar/subscriptions',
      headers: { cookie: adminCookie },
    })
    expect(listed.json().subscriptions[0]).toMatchObject({ displayName: 'School calendar', enabled: true })

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/calendar/subscriptions/${subscription.json().id}`,
      headers: { cookie: adminCookie },
      payload: {
        displayName: 'School schedule',
        sourceUrl: 'https://calendar.example.org/family.ics',
        enabled: false,
      },
    })
    expect(updated.json()).toMatchObject({ displayName: 'School schedule', enabled: false })

    const deletedMember = await app.inject({
      method: 'DELETE',
      url: `/api/calendar/members/${member.id}`,
      headers: { cookie: adminCookie },
    })
    expect(deletedMember.statusCode).toBe(204)
    const events = await app.inject({
      method: 'GET',
      url: '/api/calendar/events',
      headers: { cookie: adminCookie },
    })
    expect(events.json().events.find((item: { id: string }) => item.id === event.id).memberIds).toEqual([])

    const deletedSubscription = await app.inject({
      method: 'DELETE',
      url: `/api/calendar/subscriptions/${subscription.json().id}`,
      headers: { cookie: adminCookie },
    })
    expect(deletedSubscription.statusCode).toBe(204)
  })

  it('isolates preferences per account and rejects missing member references', async () => {
    const memberResponse = await app.inject({
      method: 'POST',
      url: '/api/calendar/members',
      headers: { cookie: adminCookie },
      payload: { name: 'Morgan', color: 'purple' },
    })
    const member = memberResponse.json()
    const adminPreference = await app.inject({
      method: 'PUT',
      url: '/api/me/preferences',
      headers: { cookie: adminCookie },
      payload: { activeView: 'month', activeFilters: [member.id] },
    })
    expect(adminPreference.json()).toMatchObject({ activeView: 'month', activeFilters: [member.id] })

    await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: adminCookie },
      payload: { username: 'morgan', password: 'another-strong-password', role: 'member' },
    })
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'morgan', password: 'another-strong-password' },
    })
    const memberCookie = login.headers['set-cookie']
    const getPreferences = await app.inject({
      method: 'GET',
      url: '/api/me/preferences',
      headers: { cookie: Array.isArray(memberCookie) ? memberCookie[0] : memberCookie },
    })
    expect(getPreferences.json()).toMatchObject({ activeFilters: [] })

    const invalid = await app.inject({
      method: 'PUT',
      url: '/api/me/preferences',
      headers: { cookie: Array.isArray(memberCookie) ? memberCookie[0] : memberCookie },
      payload: { activeFilters: ['00000000-0000-4000-8000-000000000001'] },
    })
    expect(invalid.statusCode).toBe(422)
  })
})
