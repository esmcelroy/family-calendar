import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../../src/server.js'
import { runMigrations } from '../../src/db/migrate.js'

const databaseUrl = process.env['TEST_DATABASE_URL']

describe.skipIf(!databaseUrl)('administrator settings and invitations', () => {
  const schema = `settings_test_${randomUUID().replaceAll('-', '')}`
  const mailCalls: Array<{ action: string; settings: unknown; message?: unknown }> = []
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
      smtpEncryptionKey: Buffer.alloc(32, 9),
      trustProxy: false,
      db: pool,
      staticRoot: new URL('../../test-fixtures/static/', import.meta.url).pathname,
      logger: false,
      mailTransportFactory: (settings) => ({
        async verify() {
          mailCalls.push({ action: 'verify', settings })
        },
        async sendMail(message) {
          mailCalls.push({ action: 'sendMail', settings, message })
          return { accepted: ['guest@example.org'], rejected: [] }
        },
      }),
    })
  })

  beforeEach(async () => {
    await pool.query('TRUNCATE feed_credentials, family_settings, calendar_subscriptions, calendar_event_members, calendar_events, family_members, user_preferences, sessions, users CASCADE')
    await pool.query("INSERT INTO family_settings (id, data) VALUES (1, '{}'::jsonb)")
    mailCalls.length = 0
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

  it('stores SMTP secrets encrypted and returns only sanitized settings', async () => {
    const payload = {
      organizerName: 'Family',
      organizerEmail: 'family@example.org',
      smtp: {
        host: 'smtp.example.org',
        port: 587,
        secure: false,
        username: 'mailer',
        password: 'smtp-secret-value',
        fromName: 'Family Calendar',
        fromAddress: 'calendar@example.org',
      },
    }
    const saved = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: adminCookie },
      payload,
    })
    expect(saved.statusCode).toBe(200)
    expect(saved.body).not.toContain('smtp-secret-value')
    expect(saved.json()).toMatchObject({ organizerName: 'Family', smtpConfigured: true, smtp: { username: 'mailer' } })

    const stored = await pool.query<{ data: Record<string, unknown>; smtp_password_ciphertext: string }>(
      'SELECT data, smtp_password_ciphertext FROM family_settings WHERE id = 1',
    )
    expect(JSON.stringify(stored.rows[0]?.data)).not.toContain('smtp-secret-value')
    expect(stored.rows[0]?.smtp_password_ciphertext).not.toContain('smtp-secret-value')
    expect(stored.rows[0]?.smtp_password_ciphertext).toBeTruthy()

    const read = await app.inject({ method: 'GET', url: '/api/admin/settings', headers: { cookie: adminCookie } })
    expect(read.statusCode).toBe(200)
    expect(read.body).not.toContain('password')
  })

  it('tests saved SMTP settings and sends invitations using backend-owned credentials only', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: adminCookie },
      payload: {
        organizerName: 'Family',
        organizerEmail: 'family@example.org',
        smtp: {
          host: 'smtp.example.org', port: 587, secure: false, username: 'mailer',
          password: 'saved-backend-secret', fromName: 'Family Calendar', fromAddress: 'calendar@example.org',
        },
      },
    })
    const tested = await app.inject({
      method: 'POST',
      url: '/api/admin/settings/smtp/test',
      headers: { cookie: adminCookie },
    })
    expect(tested.statusCode).toBe(200)
    expect(mailCalls[0]).toMatchObject({ action: 'verify', settings: { host: 'smtp.example.org', password: 'saved-backend-secret' } })

    const member = await app.inject({
      method: 'POST',
      url: '/api/calendar/members',
      headers: { cookie: adminCookie },
      payload: { name: 'Guest', color: 'blue', email: 'guest@example.org' },
    })
    const event = await app.inject({
      method: 'POST',
      url: '/api/calendar/events',
      headers: { cookie: adminCookie },
      payload: { title: 'Family lunch', date: '2026-11-06', memberIds: [member.json().id] },
    })
    const invitation = await app.inject({
      method: 'POST',
      url: `/api/calendar/events/${event.json().id}/invitations`,
      headers: { cookie: adminCookie },
      payload: { method: 'REQUEST', sequence: 0 },
    })
    expect(invitation.statusCode).toBe(200)
    expect(invitation.json().results).toEqual([{ status: 'sent', recipientEmail: 'guest@example.org' }])
    expect(mailCalls[1]).toMatchObject({ action: 'sendMail', settings: { password: 'saved-backend-secret' } })
    const sentMessage = mailCalls[1]?.message as { icalEvent?: { content?: string } }
    expect(sentMessage.icalEvent?.content).toContain('ORGANIZER;CN="Family":mailto:family@example.org')
    expect(sentMessage.icalEvent?.content).toContain('SUMMARY:Family lunch')
  })
})
