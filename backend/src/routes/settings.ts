import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { requireAdmin, ensureSameOrigin, sendApiError } from './route-utils.js'
import { decryptSecret, encryptSecret } from '../settings/secret.js'
import type { MailTransportFactory, SmtpSettings } from '../settings/mail.js'

interface SettingsInput {
  organizerName?: unknown
  organizerEmail?: unknown
  smtp?: {
    host?: unknown
    port?: unknown
    secure?: unknown
    username?: unknown
    password?: unknown
    fromName?: unknown
    fromAddress?: unknown
  }
}

interface StoredSettings {
  data: Record<string, unknown>
  smtp_password_ciphertext: string | null
}

function validOptionalString(value: unknown, maxLength = 200): value is string | null | undefined {
  return value === undefined || value === null || (typeof value === 'string' && value.length <= maxLength)
}

function emailValid(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function loadStored(pool: Pool): Promise<StoredSettings> {
  const result = await pool.query<StoredSettings>(
    'SELECT data, smtp_password_ciphertext FROM family_settings WHERE id = 1',
  )
  return result.rows[0] ?? { data: {}, smtp_password_ciphertext: null }
}

function sanitizeSettings(stored: StoredSettings) {
  const smtp = stored.data['smtp'] as Record<string, unknown> | undefined
  return {
    organizerName: stored.data['organizerName'] ?? null,
    organizerEmail: stored.data['organizerEmail'] ?? null,
    smtpConfigured: Boolean(
      smtp?.['host'] && smtp?.['fromAddress'] && stored.smtp_password_ciphertext,
    ),
    smtp: smtp ? {
      host: smtp['host'] ?? null,
      port: smtp['port'] ?? null,
      secure: smtp['secure'] === true,
      username: smtp['username'] ?? null,
      fromName: smtp['fromName'] ?? null,
      fromAddress: smtp['fromAddress'] ?? null,
    } : null,
  }
}

async function smtpSettings(pool: Pool, key: Buffer): Promise<SmtpSettings | null> {
  const stored = await loadStored(pool)
  const smtp = stored.data['smtp'] as Record<string, unknown> | undefined
  if (!smtp || !stored.smtp_password_ciphertext || typeof smtp['host'] !== 'string' ||
      typeof smtp['fromAddress'] !== 'string' || typeof smtp['port'] !== 'number') return null
  return {
    host: smtp['host'],
    port: smtp['port'],
    secure: smtp['secure'] === true,
    username: typeof smtp['username'] === 'string' ? smtp['username'] : null,
    password: decryptSecret(stored.smtp_password_ciphertext, key),
    fromName: typeof smtp['fromName'] === 'string' ? smtp['fromName'] : null,
    fromAddress: smtp['fromAddress'],
  }
}

export function registerSettingsRoutes(
  app: FastifyInstance,
  pool: Pool,
  sessionSecret: string,
  encryptionKey: Buffer,
  mailTransportFactory: MailTransportFactory,
): void {
  app.get('/api/admin/settings', async (request, reply) => {
    const user = await requireAdmin(pool, request, reply, sessionSecret)
    if (!user) return
    return sanitizeSettings(await loadStored(pool))
  })

  app.put<{ Body: SettingsInput }>('/api/admin/settings', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireAdmin(pool, request, reply, sessionSecret)
    if (!user) return
    const body = request.body ?? {}
    if (!validOptionalString(body.organizerName) ||
        (body.organizerEmail !== undefined && body.organizerEmail !== null && !emailValid(body.organizerEmail))) {
      return sendApiError(reply, 422, 'INVALID_SETTINGS', 'Enter a valid organizer name and email.')
    }

    const previous = await loadStored(pool)
    const existingSmtp = (previous.data['smtp'] as Record<string, unknown> | undefined) ?? {}
    const nextData: Record<string, unknown> = {
      ...previous.data,
      organizerName: body.organizerName ?? null,
      organizerEmail: body.organizerEmail ?? null,
    }
    let cipherText = previous.smtp_password_ciphertext
    if (body.smtp !== undefined) {
      const smtp = body.smtp
      if (!smtp || typeof smtp.host !== 'string' || smtp.host.trim().length === 0 || smtp.host.length > 255 ||
          !Number.isInteger(smtp.port) || Number(smtp.port) < 1 || Number(smtp.port) > 65535 ||
          typeof smtp.secure !== 'boolean' || !validOptionalString(smtp.username) ||
          !validOptionalString(smtp.password, 4096) || !validOptionalString(smtp.fromName) ||
          !emailValid(smtp.fromAddress)) {
        return sendApiError(reply, 422, 'INVALID_SMTP_SETTINGS', 'Enter valid SMTP settings.')
      }
      if (typeof smtp.password === 'string' && smtp.password.length > 0) {
        cipherText = encryptSecret(smtp.password, encryptionKey)
      }
      nextData['smtp'] = {
        host: smtp.host.trim(),
        port: Number(smtp.port),
        secure: smtp.secure,
        username: smtp.username ?? null,
        fromName: smtp.fromName ?? null,
        fromAddress: smtp.fromAddress,
      }
      if (smtp.password === '' && !cipherText) {
        // Keep configuration incomplete until a secret is provided.
        cipherText = null
      }
    } else if (Object.keys(existingSmtp).length > 0) {
      nextData['smtp'] = existingSmtp
    }

    await pool.query(
      `UPDATE family_settings SET data = $1::jsonb, smtp_password_ciphertext = $2,
       updated_at = NOW(), updated_by_user_id = $3 WHERE id = 1`,
      [JSON.stringify(nextData), cipherText, user.id],
    )
    return sanitizeSettings({ data: nextData, smtp_password_ciphertext: cipherText })
  })

  app.post('/api/admin/settings/smtp/test', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireAdmin(pool, request, reply, sessionSecret)
    if (!user) return
    const settings = await smtpSettings(pool, encryptionKey)
    if (!settings) return sendApiError(reply, 422, 'SMTP_NOT_CONFIGURED', 'Configure and save SMTP settings first.')
    try {
      await mailTransportFactory(settings).verify()
      return { status: 'ok' }
    } catch {
      return sendApiError(reply, 502, 'SMTP_TEST_FAILED', 'The saved SMTP settings could not be verified.')
    }
  })
}

export { loadStored as loadFamilySettings, smtpSettings as loadSmtpSettings }
