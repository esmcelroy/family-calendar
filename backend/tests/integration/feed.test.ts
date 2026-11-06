import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import ical from 'node-ical'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../../src/server.js'
import { runMigrations } from '../../src/db/migrate.js'

const databaseUrl = process.env['TEST_DATABASE_URL']
const subscribedCalendar = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:school-event',
  'DTSTART;VALUE=DATE:20261107',
  'SUMMARY:School fair',
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  'DESCRIPTION:Alarm',
  'END:VALARM',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe.skipIf(!databaseUrl)('live merged calendar feed', () => {
  const schema = `feed_test_${randomUUID().replaceAll('-', '')}`
  let adminPool: Pool
  let pool: Pool
  let app: ReturnType<typeof buildServer>
  let adminCookie: string
  const fetchCalls: string[] = []

  beforeAll(async () => {
    if (!databaseUrl) return
    adminPool = new Pool({ connectionString: databaseUrl })
    await adminPool.query(`CREATE SCHEMA "${schema}"`)
    pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` })
    await runMigrations(pool)
    app = buildServer({
      sessionSecret: 'test-session-secret-at-least-32-characters',
      smtpEncryptionKey: Buffer.alloc(32, 3),
      trustProxy: false,
      db: pool,
      staticRoot: new URL('../../test-fixtures/static/', import.meta.url).pathname,
      logger: false,
      calendarFetcher: async (url) => {
        fetchCalls.push(url)
        return subscribedCalendar
      },
    })
  })

  beforeEach(async () => {
    await pool.query('TRUNCATE feed_credentials, family_settings, calendar_subscriptions, calendar_event_members, calendar_events, family_members, user_preferences, sessions, users CASCADE')
    await pool.query("INSERT INTO family_settings (id, data) VALUES (1, '{}'::jsonb)")
    fetchCalls.length = 0
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

  it('keeps the feed URL stable, serves current shared and enabled subscription content, strips alarms, and rotates access', async () => {
    const first = await app.inject({ method: 'POST', url: '/api/admin/feed', headers: { cookie: adminCookie } })
    expect(first.statusCode).toBe(200)
    const feedUrl = first.json().feedUrl as string
    expect(feedUrl).toContain('/api/feeds/')
    const status = await app.inject({ method: 'GET', url: '/api/admin/feed', headers: { cookie: adminCookie } })
    expect(status.json()).toMatchObject({ enabled: true, feedUrl })

    await app.inject({
      method: 'POST',
      url: '/api/calendar/events',
      headers: { cookie: adminCookie },
      payload: { title: 'Family breakfast', date: '2026-11-06', memberIds: [] },
    })
    await app.inject({
      method: 'POST',
      url: '/api/calendar/subscriptions',
      headers: { cookie: adminCookie },
      payload: { displayName: 'School', sourceUrl: 'https://calendar.example.org/school.ics', enabled: true },
    })
    await app.inject({
      method: 'POST',
      url: '/api/calendar/subscriptions',
      headers: { cookie: adminCookie },
      payload: { displayName: 'Disabled', sourceUrl: 'https://calendar.example.org/disabled.ics', enabled: false },
    })

    const feedPath = new URL(feedUrl).pathname
    const feed = await app.inject({ method: 'GET', url: feedPath })
    expect(feed.statusCode).toBe(200)
    expect(feed.headers['content-type']).toContain('text/calendar')
    expect(feed.headers['cache-control']).toContain('no-store')
    expect(feed.body).toContain('SUMMARY:Family breakfast')
    expect(feed.body).toContain('SUMMARY:School fair')
    expect(feed.body).not.toContain('Disabled')
    expect(feed.body).not.toContain('VALARM')
    expect(Object.values(ical.parseICS(feed.body)).filter((component) => component.type === 'VEVENT')).toHaveLength(2)
    expect(fetchCalls).toEqual(['https://calendar.example.org/school.ics'])

    const rotated = await app.inject({ method: 'POST', url: '/api/admin/feed', headers: { cookie: adminCookie } })
    const nextFeedPath = new URL(rotated.json().feedUrl).pathname
    expect(nextFeedPath).not.toBe(feedPath)
    expect((await app.inject({ method: 'GET', url: feedPath })).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url: nextFeedPath })).statusCode).toBe(200)
    expect((await app.inject({
      method: 'DELETE',
      url: '/api/admin/feed',
      headers: { cookie: adminCookie },
    })).statusCode).toBe(204)
    expect((await app.inject({ method: 'GET', url: nextFeedPath })).statusCode).toBe(404)
    expect((await app.inject({
      method: 'GET',
      url: '/api/admin/feed',
      headers: { cookie: adminCookie },
    })).json()).toEqual({ enabled: false })
  })

  it('serializes concurrent token rotations so only one credential remains active', async () => {
    const rotations = await Promise.all(Array.from({ length: 5 }, () =>
      app.inject({ method: 'POST', url: '/api/admin/feed', headers: { cookie: adminCookie } }),
    ))
    expect(rotations.every((response) => response.statusCode === 200)).toBe(true)

    const activeCredentials = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM feed_credentials WHERE revoked_at IS NULL',
    )
    expect(activeCredentials.rows[0]?.count).toBe('1')
  })
})
