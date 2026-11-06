import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { hashPassword, verifyPassword } from '../auth/password.js'
import {
  clearSessionCookie,
  createSession,
  digestSessionToken,
  findSessionUser,
  getSessionToken,
  setSessionCookie,
} from '../auth/session.js'
import { ensureSameOrigin, requireAdmin, sendApiError } from './route-utils.js'

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,59}$/
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_LIMIT = 5
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

interface AccountRequest {
  username?: unknown
  password?: unknown
  role?: unknown
}

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().normalize('NFKC').toLowerCase()
  return USERNAME_PATTERN.test(normalized) ? normalized : null
}

function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 1024
}

function attemptKey(request: FastifyRequest, username: string): string {
  return `${request.ip}:${username}`
}

function isRateLimited(request: FastifyRequest, username: string): boolean {
  const key = attemptKey(request, username)
  const now = Date.now()
  const attempts = loginAttempts.get(key)
  if (!attempts || attempts.resetAt <= now) {
    loginAttempts.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS })
    return false
  }
  return attempts.count >= LOGIN_LIMIT
}

function recordFailedLogin(request: FastifyRequest, username: string): void {
  const key = attemptKey(request, username)
  const attempts = loginAttempts.get(key)
  if (!attempts || attempts.resetAt <= Date.now()) {
    loginAttempts.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS })
  } else {
    attempts.count += 1
  }
  if (loginAttempts.size > 2_000) {
    const now = Date.now()
    for (const [candidate, value] of loginAttempts) {
      if (value.resetAt <= now) loginAttempts.delete(candidate)
    }
  }
}

function clearFailedLogins(request: FastifyRequest, username: string): void {
  loginAttempts.delete(attemptKey(request, username))
}

export function registerAuthRoutes(
  app: FastifyInstance,
  pool: Pool,
  options: { sessionSecret: string; secureCookies: boolean },
): void {
  app.post<{ Body: AccountRequest }>('/api/auth/bootstrap', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const username = normalizeUsername(request.body?.username)
    const password = request.body?.password
    if (!username || !validPassword(password)) {
      return sendApiError(reply, 422, 'INVALID_ACCOUNT', 'Enter a valid username and a password of at least 8 characters.')
    }

    const setup = await pool.query<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM users) AS exists')
    if (setup.rows[0]?.exists) {
      return sendApiError(reply, 409, 'BOOTSTRAP_COMPLETE', 'Administrator setup has already been completed.')
    }

    const passwordHash = await hashPassword(password)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock($1)', [129202611])
      const { rows } = await client.query<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM users) AS exists')
      if (rows[0]?.exists) {
        await client.query('ROLLBACK')
        return sendApiError(reply, 409, 'BOOTSTRAP_COMPLETE', 'Administrator setup has already been completed.')
      }

      const id = randomUUID()
      await client.query(
        'INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)',
        [id, username, passwordHash, 'admin'],
      )
      const session = await createSession(client, id, options.sessionSecret)
      await client.query(
        'INSERT INTO user_preferences (user_id, data) VALUES ($1, $2::jsonb)',
        [id, JSON.stringify({ activeFilters: [] })],
      )
      await client.query('COMMIT')
      setSessionCookie(reply, session.token, options.secureCookies)
      return reply.code(201).send({ user: session.user })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      request.log.error({ err: { name: error instanceof Error ? error.name : 'unknown' } }, 'administrator bootstrap failed')
      return sendApiError(reply, 500, 'REQUEST_FAILED', 'Unable to create the administrator.')
    } finally {
      client.release()
    }
  })

  app.post<{ Body: AccountRequest }>('/api/auth/login', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const username = normalizeUsername(request.body?.username)
    const password = request.body?.password
    if (!username || typeof password !== 'string' || password.length > 1024) {
      return sendApiError(reply, 401, 'INVALID_CREDENTIALS', 'Invalid username or password.')
    }
    if (isRateLimited(request, username)) {
      return sendApiError(reply, 429, 'RATE_LIMITED', 'Too many sign-in attempts. Try again later.')
    }

    const { rows } = await pool.query<{
      id: string
      username: string
      password_hash: string
      role: 'admin' | 'member'
      created_at: Date | string
    }>('SELECT id, username, password_hash, role, created_at FROM users WHERE username = $1', [username])
    const account = rows[0]
    if (!account || !(await verifyPassword(account.password_hash, password))) {
      recordFailedLogin(request, username)
      return sendApiError(reply, 401, 'INVALID_CREDENTIALS', 'Invalid username or password.')
    }

    clearFailedLogins(request, username)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const session = await createSession(client, account.id, options.sessionSecret)
      await client.query('COMMIT')
      setSessionCookie(reply, session.token, options.secureCookies)
      return reply.code(200).send({
        user: {
          id: account.id,
          username: account.username,
          role: account.role,
          createdAt: new Date(account.created_at).toISOString(),
        },
      })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      request.log.error({ err: { name: error instanceof Error ? error.name : 'unknown' } }, 'login session failed')
      return sendApiError(reply, 500, 'REQUEST_FAILED', 'Unable to start a session.')
    } finally {
      client.release()
    }
  })

  app.get('/api/auth/session', async (request, reply) => {
    const user = await findSessionUser(pool, request, options.sessionSecret)
    if (!user) return sendApiError(reply, 401, 'UNAUTHENTICATED', 'Sign in to continue.')
    return { user }
  })

  app.post('/api/auth/logout', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const token = getSessionToken(request)
    if (!token) return sendApiError(reply, 401, 'UNAUTHENTICATED', 'Sign in to continue.')
    await pool.query(
      'UPDATE sessions SET revoked_at = NOW() WHERE token_digest = $1 AND revoked_at IS NULL',
      [digestSessionToken(token, options.sessionSecret)],
    )
    clearSessionCookie(reply, options.secureCookies)
    return reply.code(204).send()
  })

  app.get('/api/admin/users', async (request, reply) => {
    const user = await requireAdmin(pool, request, reply, options.sessionSecret)
    if (!user) return
    const { rows } = await pool.query<{
      id: string
      username: string
      role: 'admin' | 'member'
      created_at: Date | string
    }>('SELECT id, username, role, created_at FROM users ORDER BY username')
    return {
      users: rows.map((row) => ({
        id: row.id,
        username: row.username,
        role: row.role,
        createdAt: new Date(row.created_at).toISOString(),
      })),
    }
  })

  app.post<{ Body: AccountRequest }>('/api/admin/users', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const admin = await requireAdmin(pool, request, reply, options.sessionSecret)
    if (!admin) return
    const username = normalizeUsername(request.body?.username)
    const password = request.body?.password
    const role = request.body?.role
    if (!username || !validPassword(password) || (role !== 'admin' && role !== 'member')) {
      return sendApiError(reply, 422, 'INVALID_ACCOUNT', 'Enter a valid username, password, and account role.')
    }

    try {
      const passwordHash = await hashPassword(password)
      const id = randomUUID()
      const { rows } = await pool.query<{
        id: string
        username: string
        role: 'admin' | 'member'
        created_at: Date | string
      }>(
        `INSERT INTO users (id, username, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, role, created_at`,
        [id, username, passwordHash, role],
      )
      await pool.query(
        'INSERT INTO user_preferences (user_id, data) VALUES ($1, $2::jsonb)',
        [id, JSON.stringify({ activeFilters: [] })],
      )
      const row = rows[0]
      if (!row) return sendApiError(reply, 500, 'REQUEST_FAILED', 'Unable to create account.')
      return reply.code(201).send({
        id: row.id,
        username: row.username,
        role: row.role,
        createdAt: new Date(row.created_at).toISOString(),
      })
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return sendApiError(reply, 409, 'USERNAME_TAKEN', 'That username is already in use.')
      }
      request.log.error({ err: { name: error instanceof Error ? error.name : 'unknown' } }, 'account creation failed')
      return sendApiError(reply, 500, 'REQUEST_FAILED', 'Unable to create account.')
    }
  })
}
