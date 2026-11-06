import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pool } from 'pg'
import { runner } from 'node-pg-migrate'

const migrationsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../migrations')

export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect()
  try {
    const { rows } = await client.query<{ schema_name: string }>('SELECT current_schema() AS schema_name')
    const schema = rows[0]?.schema_name ?? 'public'
    await runner({
      dbClient: client,
      direction: 'up',
      dir: migrationsDirectory,
      schema,
      migrationsTable: 'pgmigrations',
      createSchema: true,
      checkOrder: true,
    })
  } finally {
    client.release()
  }
}
