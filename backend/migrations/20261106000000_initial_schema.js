export const shorthands = undefined // No application-specific shorthands.

export async function up(pgm) {
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true },
    username: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    role: { type: 'text', notNull: true, default: 'member', check: "role IN ('admin', 'member')" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('sessions', {
    id: { type: 'uuid', primaryKey: true },
    user_id: { type: 'uuid', notNull: true, references: '"users"', onDelete: 'CASCADE' },
    token_digest: { type: 'text', notNull: true, unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    expires_at: { type: 'timestamptz', notNull: true },
    revoked_at: { type: 'timestamptz' },
  })
  pgm.createIndex('sessions', 'user_id')

  pgm.createTable('family_members', {
    id: { type: 'uuid', primaryKey: true },
    data: { type: 'jsonb', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('calendar_events', {
    id: { type: 'uuid', primaryKey: true },
    data: { type: 'jsonb', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.createTable('calendar_event_members', {
    event_id: { type: 'uuid', notNull: true, references: '"calendar_events"', onDelete: 'CASCADE' },
    member_id: { type: 'uuid', notNull: true, references: '"family_members"', onDelete: 'CASCADE' },
  })
  pgm.addConstraint('calendar_event_members', 'calendar_event_members_pkey', {
    primaryKey: ['event_id', 'member_id'],
  })

  pgm.createTable('calendar_subscriptions', {
    id: { type: 'uuid', primaryKey: true },
    display_name: { type: 'text', notNull: true },
    source_url: { type: 'text', notNull: true },
    color: { type: 'text' },
    enabled: { type: 'boolean', notNull: true, default: true },
    last_fetched_at: { type: 'timestamptz' },
    last_fetch_error: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('user_preferences', {
    user_id: { type: 'uuid', primaryKey: true, references: '"users"', onDelete: 'CASCADE' },
    data: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('family_settings', {
    id: { type: 'integer', primaryKey: true, check: 'id = 1' },
    data: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    smtp_password_ciphertext: { type: 'text' },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_by_user_id: { type: 'uuid', references: '"users"', onDelete: 'SET NULL' },
  })
  pgm.sql('INSERT INTO family_settings (id, data) VALUES (1, \'{}\'::jsonb)')

  pgm.createTable('feed_credentials', {
    id: { type: 'uuid', primaryKey: true },
    token_digest: { type: 'text', notNull: true, unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    rotated_at: { type: 'timestamptz' },
    revoked_at: { type: 'timestamptz' },
    created_by_user_id: { type: 'uuid', references: '"users"', onDelete: 'SET NULL' },
  })
  pgm.addColumn('feed_credentials', {
    token_ciphertext: { type: 'text' },
  })
}

export async function down(pgm) {
  pgm.dropColumn('feed_credentials', 'token_ciphertext')
  pgm.dropTable('feed_credentials')
  pgm.dropTable('family_settings')
  pgm.dropTable('user_preferences')
  pgm.dropTable('calendar_subscriptions')
  pgm.dropTable('calendar_event_members')
  pgm.dropTable('calendar_events')
  pgm.dropTable('family_members')
  pgm.dropTable('sessions')
  pgm.dropTable('users')
}
