import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { access, readFile } from 'node:fs/promises'

const execFileAsync = promisify(execFile)
const composeSmoke = process.env['RUN_COMPOSE_SMOKE'] === '1'
const project = `family-calendar-smoke-${process.pid}`
const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
let port = 0

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const assigned = typeof address === 'object' && address ? address.port : 0
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return assigned
}

async function compose(args: string[]) {
  return execFileAsync('docker', ['compose', '-p', project, ...args], {
    cwd: projectRoot,
    env: { ...process.env, APP_PORT: String(port), SESSION_SECRET: 'smoke-test-session-secret-with-more-than-32-characters', SMTP_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'), POSTGRES_PASSWORD: 'smoke-password-strong' },
    timeout: 240_000,
  })
}

describe('Docker Compose deployment', () => {
  it('declares an app/API service, PostgreSQL, readiness checks, and persistent database volume', async () => {
    await access(new URL('../../../compose.yaml', import.meta.url))
    const config = await readFile(new URL('../../../compose.yaml', import.meta.url), 'utf8')
    expect(config).toContain('postgres:')
    expect(config).toContain('healthcheck:')
    expect(config).toContain('family-calendar-data:')
    const rendered = await compose(['config', '--quiet'])
    expect(rendered.stderr).toBe('')
  })

  it.skipIf(!composeSmoke)('starts, serves its API, applies migrations, and retains data after container recreation', async () => {
    port = await freePort()
    try {
      await compose(['up', '--build', '-d', '--wait'])
      const base = `http://127.0.0.1:${port}`
      const health = await fetch(`${base}/healthz`)
      expect(health.status).toBe(200)
      const mode = await fetch(`${base}/api/mode`)
      expect(await mode.json()).toMatchObject({ mode: 'server', bootstrapRequired: true })

      const bootstrap = await fetch(`${base}/api/auth/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'a-strong-password' }),
      })
      expect(bootstrap.status).toBe(201)
      await compose(['up', '--force-recreate', '-d', '--wait'])
      const afterRestart = await fetch(`${base}/api/mode`)
      expect(await afterRestart.json()).toMatchObject({ mode: 'server', bootstrapRequired: false })
    } finally {
      await compose(['down', '-v', '--remove-orphans'])
    }
  }, 240_000)

  afterAll(async () => {
    if (composeSmoke) await compose(['down', '-v', '--remove-orphans']).catch(() => undefined)
  })
})
