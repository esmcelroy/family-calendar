import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { findSessionUser, type AuthenticatedUser } from '../auth/session.js'

export function sendApiError(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } })
}

export function ensureSameOrigin(request: FastifyRequest, reply: FastifyReply): boolean {
  const origin = request.headers.origin
  if (!origin) return true
  const expected = `${request.protocol}://${request.headers.host}`
  if (origin === expected) return true
  void sendApiError(reply, 403, 'CROSS_ORIGIN_REQUEST', 'Cross-origin requests are not allowed.')
  return false
}

export async function requireUser(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  secret: string,
): Promise<AuthenticatedUser | null> {
  const user = await findSessionUser(pool, request, secret)
  if (!user) {
    await sendApiError(reply, 401, 'UNAUTHENTICATED', 'Sign in to continue.')
    return null
  }
  return user
}

export async function requireAdmin(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
  secret: string,
): Promise<AuthenticatedUser | null> {
  const user = await requireUser(pool, request, reply, secret)
  if (user && user.role !== 'admin') {
    await sendApiError(reply, 403, 'FORBIDDEN', 'Administrator access is required.')
    return null
  }
  return user
}
