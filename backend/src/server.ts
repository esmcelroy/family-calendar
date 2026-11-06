import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import fastifyStatic from '@fastify/static'
import type { Pool } from 'pg'
import { createPool } from './db/pool.js'
import { runMigrations } from './db/migrate.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerCalendarRoutes } from './routes/calendar.js'
import { registerPreferenceRoutes } from './routes/preferences.js'
import { registerSettingsRoutes } from './routes/settings.js'
import { registerInvitationRoutes } from './routes/invitations.js'
import { registerFeedRoutes } from './routes/feed.js'
import nodemailer from 'nodemailer'
import type { MailTransportFactory } from './settings/mail.js'

export interface ServerOptions {
  databaseUrl?: string
  sessionSecret: string
  smtpEncryptionKey: Buffer
  staticRoot?: string
  trustProxy: boolean
  db?: Pool
  closeDbOnClose?: boolean
  logger?: boolean
  mailTransportFactory?: MailTransportFactory
  calendarFetcher?: (url: string) => Promise<string>
}

export function buildServer(options: ServerOptions): FastifyInstance {
  if (options.sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters')
  }
  if (options.smtpEncryptionKey.byteLength !== 32) {
    throw new Error('SMTP_ENCRYPTION_KEY must be exactly 32 bytes')
  }

  const ownsPool = !options.db || options.closeDbOnClose === true
  const pool = options.db ?? createPool(options.databaseUrl)
  const staticRoot =
    options.staticRoot ??
    process.env['STATIC_ROOT'] ??
    resolve(fileURLToPath(new URL('../../public', import.meta.url)))
  const app = fastify({
    trustProxy: options.trustProxy,
    logger: options.logger === false
      ? false
      : {
          level: process.env['LOG_LEVEL'] ?? 'info',
          redact: {
            paths: ['req.url', 'req.headers.cookie', 'req.headers.authorization'],
            remove: true,
          },
        },
  })
  registerAuthRoutes(app, pool, {
    sessionSecret: options.sessionSecret,
    secureCookies: process.env['NODE_ENV'] === 'production',
  })
  registerCalendarRoutes(app, pool, options.sessionSecret)
  registerPreferenceRoutes(app, pool, options.sessionSecret)
  const mailTransportFactory = options.mailTransportFactory ?? ((settings) => nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    ...(settings.username ? { auth: { user: settings.username, pass: settings.password ?? '' } } : {}),
  }))
  registerSettingsRoutes(app, pool, options.sessionSecret, options.smtpEncryptionKey, mailTransportFactory)
  registerInvitationRoutes(app, pool, options.sessionSecret, options.smtpEncryptionKey, mailTransportFactory)
  registerFeedRoutes(app, pool, options.sessionSecret, options.smtpEncryptionKey, options.calendarFetcher)

  app.addHook('onClose', async () => {
    if (ownsPool) await pool.end()
  })

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: { name: error.name, code: error.code, statusCode: error.statusCode } }, 'request failed')
    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500
    const code = statusCode === 404 ? 'NOT_FOUND' : statusCode === 401 ? 'UNAUTHENTICATED' : 'REQUEST_FAILED'
    void reply.code(statusCode).send({
      error: { code, message: statusCode >= 500 ? 'The request could not be completed.' : error.message },
    })
  })

  app.get('/healthz', async (_request, reply) => {
    await pool.query('SELECT 1')
    return reply.code(200).send({ status: 'ok' })
  })

  app.get('/api/mode', async () => {
    const result = await pool.query<{ initialized: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM users LIMIT 1) AS initialized',
    )
    return {
      mode: 'server' as const,
      bootstrapRequired: !result.rows[0]?.initialized,
    }
  })

  app.register(fastifyStatic, {
    root: staticRoot,
    wildcard: false,
    prefix: '/',
    decorateReply: true,
  })

  const serveSpa = async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).type('application/json').send({ error: { code: 'NOT_FOUND', message: 'Not found.' } })
    }
    return reply.sendFile('index.html')
  }

  app.get('/*', serveSpa)

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).type('application/json').send({
        error: { code: 'NOT_FOUND', message: 'Not found.' },
      })
    }
    return reply.sendFile('index.html')
  })

  return app
}

export async function startServer(): Promise<FastifyInstance> {
  const sessionSecret = process.env['SESSION_SECRET']
  const encryptionKey = process.env['SMTP_ENCRYPTION_KEY']
  if (!sessionSecret || !encryptionKey) {
    throw new Error('SESSION_SECRET and SMTP_ENCRYPTION_KEY are required')
  }
  const key = Buffer.from(encryptionKey, 'base64')
  const databaseUrl = process.env['DATABASE_URL']
  const pool = createPool(databaseUrl)
  await runMigrations(pool)
  const app = buildServer({
    ...(databaseUrl ? { databaseUrl } : {}),
    sessionSecret,
    smtpEncryptionKey: key,
    trustProxy: process.env['TRUST_PROXY'] === 'true',
    db: pool,
    closeDbOnClose: true,
  })
  await app.listen({ host: process.env['HOST'] ?? '0.0.0.0', port: Number(process.env['PORT'] ?? 3000) })
  return app
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer().catch((error: unknown) => {
    console.error('Unable to start application server', error instanceof Error ? error.message : 'unknown error')
    process.exitCode = 1
  })
}
