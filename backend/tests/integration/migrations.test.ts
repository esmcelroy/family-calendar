import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runMigrations } from '../../src/db/migrate.js'

const databaseUrl = process.env['TEST_DATABASE_URL']

describe.skipIf(!databaseUrl)('PostgreSQL migrations', () => {
  const schema = `migration_test_${randomUUID().replaceAll('-', '')}`
  let admin: Pool
  let database: Pool

  beforeAll(async () => {
    if (!databaseUrl) return
    admin = new Pool({ connectionString: databaseUrl })
    await admin.query(`CREATE SCHEMA "${schema}"`)
    database = new Pool({
      connectionString: databaseUrl,
      options: `-c search_path=${schema}`,
    })
  })

  afterAll(async () => {
    if (database) await database.end()
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await admin.end()
    }
  })

  it('applies the schema once, tolerates repeat startup, and records the version', async () => {
    await runMigrations(database!)
    await runMigrations(database!)

    const versions = await database!.query('SELECT * FROM pgmigrations')
    const tables = await database!.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
      [schema],
    )

    expect(versions.rowCount).toBeGreaterThan(0)
    expect(tables.rows.map((row: { table_name: string }) => row.table_name)).toContain('users')
    expect(tables.rows.map((row: { table_name: string }) => row.table_name)).toContain('calendar_events')
  })
})
