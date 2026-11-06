import { createHash, randomBytes } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { requireAdmin, ensureSameOrigin } from './route-utils.js'
import { decryptSecret, encryptSecret } from '../settings/secret.js'
import { fetchCalendarSafely } from '../feed/fetch-calendar.js'
import { buildMergedCalendar } from '../feed/ical.js'

interface FeedCredential {
  token_digest: string
  token_ciphertext: string
}

interface Subscription {
  source_url: string
}

function urlForRequest(request: FastifyRequest, token: string) {
  return `${request.protocol}://${request.headers.host}/api/feeds/${encodeURIComponent(token)}.ics`
}

function digestToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function registerFeedRoutes(
  app: FastifyInstance,
  pool: Pool,
  sessionSecret: string,
  encryptionKey: Buffer,
  fetchCalendar: (url: string) => Promise<string> = fetchCalendarSafely,
): void {
  const cache = new Map<string, { expiresAt: number; body: string }>()
  const cachedFetch = async (url: string) => {
    const cached = cache.get(url)
    if (cached && cached.expiresAt > Date.now()) return cached.body
    const body = await fetchCalendar(url)
    if (cache.size >= 32) {
      const oldest = cache.keys().next().value
      if (oldest) cache.delete(oldest)
    }
    cache.set(url, { body, expiresAt: Date.now() + 5 * 60_000 })
    return body
  }

  app.get('/api/admin/feed', async (request, reply) => {
    const user = await requireAdmin(pool, request, reply, sessionSecret)
    if (!user) return
    const result = await pool.query<FeedCredential>(
      'SELECT token_digest, token_ciphertext FROM feed_credentials WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1',
    )
    const credential = result.rows[0]
    if (!credential) return { enabled: false }
    const token = decryptSecret(credential.token_ciphertext, encryptionKey)
    return { enabled: true, feedUrl: urlForRequest(request, token) }
  })

  app.post('/api/admin/feed', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireAdmin(pool, request, reply, sessionSecret)
    if (!user) return
    const token = randomBytes(32).toString('base64url')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('UPDATE feed_credentials SET revoked_at = NOW(), rotated_at = NOW() WHERE revoked_at IS NULL')
      await client.query(
        `INSERT INTO feed_credentials (id, token_digest, token_ciphertext, created_by_user_id)
         VALUES (gen_random_uuid(), $1, $2, $3)`,
        [digestToken(token), encryptSecret(token, encryptionKey), user.id],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
    cache.clear()
    return reply.code(200).send({ enabled: true, feedUrl: urlForRequest(request, token) })
  })

  app.delete('/api/admin/feed', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireAdmin(pool, request, reply, sessionSecret)
    if (!user) return
    await pool.query('UPDATE feed_credentials SET revoked_at = NOW() WHERE revoked_at IS NULL')
    cache.clear()
    return reply.code(204).send()
  })

  app.get<{ Params: { feedToken: string } }>('/api/feeds/:feedToken.ics', async (request, reply) => {
    const token = request.params.feedToken
    if (token.length < 32 || token.length > 128) return reply.code(404).send()
    const credential = await pool.query<{ id: string }>(
      'SELECT id FROM feed_credentials WHERE token_digest = $1 AND revoked_at IS NULL LIMIT 1',
      [digestToken(token)],
    )
    if (!credential.rows[0]) return reply.code(404).send()

    const [events, subscriptions] = await Promise.all([
      pool.query<{ id: string; data: Record<string, unknown> }>("SELECT id, data FROM calendar_events ORDER BY data->>'date'"),
      pool.query<Subscription>('SELECT source_url FROM calendar_subscriptions WHERE enabled = true ORDER BY display_name'),
    ])
    const subscriptionResults = await Promise.allSettled(subscriptions.rows.map(({ source_url }) => cachedFetch(source_url)))
    const calendars = subscriptionResults.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
    const body = buildMergedCalendar(events.rows, calendars)
    return reply
      .header('Cache-Control', 'no-store')
      .type('text/calendar; charset=utf-8')
      .send(body)
  })
}
