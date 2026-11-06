import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { requireUser, ensureSameOrigin, sendApiError } from './route-utils.js'

interface PreferencesInput {
  activeView?: unknown
  activeFilters?: unknown
}

export function registerPreferenceRoutes(app: FastifyInstance, pool: Pool, sessionSecret: string): void {
  app.get('/api/me/preferences', async (request, reply) => {
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const { rows } = await pool.query<{ data: Record<string, unknown> }>(
      'SELECT data FROM user_preferences WHERE user_id = $1',
      [user.id],
    )
    return rows[0]?.data ?? { activeFilters: [] }
  })

  app.put<{ Body: PreferencesInput }>('/api/me/preferences', async (request, reply) => {
    if (!ensureSameOrigin(request, reply)) return
    const user = await requireUser(pool, request, reply, sessionSecret)
    if (!user) return
    const activeView = request.body?.activeView
    const activeFilters = request.body?.activeFilters
    if (
      (activeView !== undefined && (typeof activeView !== 'string' || activeView.length > 40)) ||
      (activeFilters !== undefined &&
        (!Array.isArray(activeFilters) ||
          !activeFilters.every((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))))
    ) return sendApiError(reply, 422, 'INVALID_PREFERENCES', 'Enter valid view and filter preferences.')

    const filters = (activeFilters ?? []) as string[]
    if (filters.length > 0) {
      const { rows } = await pool.query<{ id: string }>(
        'SELECT id FROM family_members WHERE id = ANY($1::uuid[])',
        [filters],
      )
      if (rows.length !== new Set(filters).size) {
        return sendApiError(reply, 422, 'INVALID_PREFERENCES', 'Filters must reference existing family members.')
      }
    }

    const preferences = {
      ...(typeof activeView === 'string' ? { activeView } : {}),
      activeFilters: filters,
    }
    await pool.query(
      `INSERT INTO user_preferences (user_id, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [user.id, JSON.stringify(preferences)],
    )
    return preferences
  })
}
