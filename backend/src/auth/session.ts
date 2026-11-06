import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import type { Pool, PoolClient } from 'pg'

export const SESSION_COOKIE = 'family_calendar_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

export interface AuthenticatedUser {
  id: string
  username: string
  role: 'admin' | 'member'
  createdAt: string
}

interface SessionRow {
  id: string
  user_id: string
  username: string
  role: 'admin' | 'member'
  created_at: Date | string
}

export function digestSessionToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex')
}

export function getSessionToken(request: FastifyRequest): string | null {
  const cookie = request.headers.cookie
  if (!cookie) return null
  const pair = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))
  if (!pair) return null
  const token = pair.slice(SESSION_COOKIE.length + 1)
  return /^[A-Za-z0-9_-]{40,60}$/.test(token) ? token : null
}

export async function createSession(
  client: PoolClient,
  userId: string,
  secret: string,
): Promise<{ token: string; user: AuthenticatedUser }> {
  const token = randomBytes(32).toString('base64url')
  const id = randomUUID()
  const { rows } = await client.query<SessionRow>(
    `INSERT INTO sessions (id, user_id, token_digest, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 second'))
     RETURNING id, user_id, (SELECT username FROM users WHERE id = $2) AS username,
               (SELECT role FROM users WHERE id = $2) AS role,
               (SELECT created_at FROM users WHERE id = $2) AS created_at`,
    [id, userId, digestSessionToken(token, secret), SESSION_TTL_SECONDS],
  )
  const row = rows[0]
  if (!row) throw new Error('Unable to create account session')
  return {
    token,
    user: {
      id: row.user_id,
      username: row.username,
      role: row.role,
      createdAt: new Date(row.created_at).toISOString(),
    },
  }
}

export async function findSessionUser(
  pool: Pool,
  request: FastifyRequest,
  secret: string,
): Promise<AuthenticatedUser | null> {
  const token = getSessionToken(request)
  if (!token) return null
  const { rows } = await pool.query<SessionRow>(
    `SELECT u.id, u.username, u.role, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_digest = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
    [digestSessionToken(token, secret)],
  )
  const user = rows[0]
  if (!user) return null
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: new Date(user.created_at).toISOString(),
  }
}

export function setSessionCookie(reply: { header: (name: string, value: string) => unknown }, token: string, secure: boolean): void {
  reply.header(
    'set-cookie',
    `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`,
  )
}

export function clearSessionCookie(reply: { header: (name: string, value: string) => unknown }, secure: boolean): void {
  reply.header(
    'set-cookie',
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`,
  )
}
