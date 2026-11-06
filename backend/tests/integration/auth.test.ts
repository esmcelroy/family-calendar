import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../../src/server.js'
import { runMigrations } from '../../src/db/migrate.js'

const databaseUrl = process.env['TEST_DATABASE_URL']

describe.skipIf(!databaseUrl)('account authentication and authorization', () => {
  const schema = `auth_test_${randomUUID().replaceAll('-', '')}`
  let adminPool: Pool
  let pool: Pool
  let app: ReturnType<typeof buildServer>

  beforeAll(async () => {
    if (!databaseUrl) return
    adminPool = new Pool({ connectionString: databaseUrl })
    await adminPool.query(`CREATE SCHEMA "${schema}"`)
    pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` })
    await runMigrations(pool)
    app = buildServer({
      sessionSecret: 'test-session-secret-at-least-32-characters',
      smtpEncryptionKey: Buffer.alloc(32, 7),
      trustProxy: false,
      db: pool,
      staticRoot: new URL('../../test-fixtures/static/', import.meta.url).pathname,
      logger: false,
    })
  })

  beforeEach(async () => {
    if (!pool) return
    await pool.query('TRUNCATE feed_credentials, family_settings, calendar_subscriptions, calendar_event_members, calendar_events, family_members, user_preferences, sessions, users CASCADE')
    await pool.query("INSERT INTO family_settings (id, data) VALUES (1, '{}'::jsonb)")
  })

  afterAll(async () => {
    if (app) await app.close()
    if (pool) await pool.end()
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await adminPool.end()
    }
  })

  it('allows exactly one concurrent first administrator bootstrap and stores a password hash', async () => {
    const request = () => app.inject({
      method: 'POST',
      url: '/api/auth/bootstrap',
      payload: { username: 'Admin', password: 'a-strong-password' },
    })

    const responses = await Promise.all([request(), request()])

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409])
    const user = await pool.query<{ username: string; role: string; password_hash: string }>(
      'SELECT username, role, password_hash FROM users',
    )
    expect(user.rows).toHaveLength(1)
    expect(user.rows[0]).toMatchObject({ username: 'admin', role: 'admin' })
    expect(user.rows[0]?.password_hash).toMatch(/^\$argon2id\$/)
    expect(user.rows[0]?.password_hash).not.toBe('a-strong-password')
  })

  it('authenticates, denies invalid credentials, establishes a session, and revokes it on logout', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/bootstrap',
      payload: { username: 'admin', password: 'a-strong-password' },
    })

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'incorrect-password' },
    })
    expect(invalid.statusCode).toBe(401)

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'ADMIN', password: 'a-strong-password' },
    })
    const cookie = login.headers['set-cookie']
    expect(login.statusCode).toBe(200)
    expect(login.json()).toMatchObject({ user: { username: 'admin', role: 'admin' } })
    expect(cookie).toBeTruthy()

    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: Array.isArray(cookie) ? cookie[0] : cookie },
    })
    expect(session.statusCode).toBe(200)

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: Array.isArray(cookie) ? cookie[0] : cookie },
    })
    expect(logout.statusCode, logout.body).toBe(204)

    const revoked = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: Array.isArray(cookie) ? cookie[0] : cookie },
    })
    expect(revoked.statusCode).toBe(401)
  })

  it('restricts account administration to admins and rejects normalized duplicate usernames', async () => {
    const bootstrap = await app.inject({
      method: 'POST',
      url: '/api/auth/bootstrap',
      payload: { username: 'admin', password: 'a-strong-password' },
    })
    const adminCookie = bootstrap.headers['set-cookie']
    const cookieHeader = Array.isArray(adminCookie) ? adminCookie[0] : adminCookie

    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: cookieHeader },
      payload: { username: 'Taylor', password: 'another-strong-password', role: 'member' },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ username: 'taylor', role: 'member' })

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      headers: { cookie: cookieHeader },
      payload: { username: 'TAYLOR', password: 'another-strong-password', role: 'member' },
    })
    expect(duplicate.statusCode).toBe(409)

    const memberLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'taylor', password: 'another-strong-password' },
    })
    const memberCookie = memberLogin.headers['set-cookie']
    const forbidden = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { cookie: Array.isArray(memberCookie) ? memberCookie[0] : memberCookie },
    })
    expect(forbidden.statusCode).toBe(403)
  })

  it('requires a valid password and does not allow bootstrap after the first account exists', async () => {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/auth/bootstrap',
      payload: { username: 'admin', password: 'short' },
    })
    expect(invalid.statusCode).toBe(422)

    await app.inject({
      method: 'POST',
      url: '/api/auth/bootstrap',
      payload: { username: 'admin', password: 'a-strong-password' },
    })
    const closed = await app.inject({
      method: 'POST',
      url: '/api/auth/bootstrap',
      payload: { username: 'other', password: 'a-strong-password' },
    })
    expect(closed.statusCode).toBe(409)
  })
})
