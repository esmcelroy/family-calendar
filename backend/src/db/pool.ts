import { Pool } from 'pg'

export function createPool(connectionString = process.env['DATABASE_URL']): Pool {
  if (!connectionString) {
    throw new Error('DATABASE_URL must be configured for server mode')
  }

  return new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
    application_name: 'family-calendar',
  })
}
