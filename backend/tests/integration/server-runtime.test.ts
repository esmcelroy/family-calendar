import type { Pool } from 'pg'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../../src/server.js'

describe('self-hosted application runtime', () => {
  const app = buildServer({
    databaseUrl: 'postgres://unused:unused@127.0.0.1:1/unused',
    sessionSecret: 'test-session-secret-at-least-32-characters',
    smtpEncryptionKey: Buffer.alloc(32, 1),
    staticRoot: new URL('../../test-fixtures/static/', import.meta.url).pathname,
    trustProxy: false,
    db: {
      query: vi.fn().mockResolvedValue({ rows: [{ initialized: false }] }),
    } as unknown as Pool,
  })

  afterAll(async () => app.close())

  it('serves the SPA and the authoritative server-mode API from the application service', async () => {
    const page = await app.inject({ method: 'GET', url: '/' })
    const mode = await app.inject({ method: 'GET', url: '/api/mode' })

    expect(page.statusCode).toBe(200)
    expect(page.headers['content-type']).toContain('text/html')
    expect(mode.statusCode).toBe(200)
    expect(mode.json()).toMatchObject({ mode: 'server', bootstrapRequired: true })
  })

  it('does not expose SPA HTML as if the Vercel-shaped API handlers were running', async () => {
    const unsupported = await app.inject({ method: 'GET', url: '/api/not-registered' })

    expect(unsupported.statusCode).toBe(404)
    expect(unsupported.headers['content-type']).toContain('application/json')
  })
})
