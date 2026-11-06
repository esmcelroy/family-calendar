import { useCallback, useEffect, useState } from 'react'
import { AuthGate, type AuthUser } from './AuthGate'
import type { Credentials } from './AuthScreens'
import { ServerApiError, serverApi } from '@/lib/server-api'
import { resolveRuntimeMode } from '@/lib/runtime-mode'
import { UsersPanel } from '@/components/admin/UsersPanel'
import { ServerCalendarApp } from '@/components/ServerCalendarApp'
import { SettingsPanel } from '@/components/admin/SettingsPanel'

interface ServerApplicationProps {
  children?: import('react').ReactNode
  showAdminPanels?: boolean
}

export function ServerApplication({ children, showAdminPanels = true }: ServerApplicationProps) {
  const [bootstrapRequired, setBootstrapRequired] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadSession = useCallback(async () => {
    setUnavailable(false)
    setLoading(true)
    try {
      const mode = await resolveRuntimeMode({ configuredMode: 'server' })
      setBootstrapRequired(Boolean(mode.bootstrapRequired))
      if (mode.bootstrapRequired) {
        setUser(null)
      } else {
        try {
          const result = await serverApi.request<{ user: AuthUser }>('/api/auth/session')
          setUser(result.user)
        } catch (sessionError) {
          if (sessionError instanceof ServerApiError && sessionError.status === 401) {
            setUser(null)
          } else {
            throw sessionError
          }
        }
      }
    } catch {
      setUnavailable(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const authenticate = useCallback(async (credentials: Credentials, endpoint: string) => {
    setBusy(true)
    setError(null)
    try {
      const result = await serverApi.request<{ user: AuthUser }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(credentials),
      })
      setUser(result.user)
      setBootstrapRequired(false)
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to sign in.')
    } finally {
      setBusy(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await serverApi.request<void>('/api/auth/logout', { method: 'POST' })
      setUser(null)
      setBootstrapRequired(false)
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to sign out.')
    } finally {
      setBusy(false)
    }
  }, [])

  if (unavailable) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <p role="alert">The family calendar server is unavailable. Local browser storage was not used.</p>
        <button type="button" className="rounded-md border px-4 py-2" onClick={() => void loadSession()}>
          Try again
        </button>
      </main>
    )
  }

  return (
    <AuthGate
      user={user}
      bootstrapRequired={bootstrapRequired}
      loading={loading}
      onLogin={(credentials) => authenticate(credentials, '/api/auth/login')}
      onBootstrap={(credentials) => authenticate(credentials, '/api/auth/bootstrap')}
      onLogout={logout}
      error={error}
      busy={busy}
    >
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        {showAdminPanels && user?.role === 'admin' && (
          <>
            <UsersPanel />
            <SettingsPanel />
          </>
        )}
        {children ?? <ServerCalendarApp />}
      </div>
    </AuthGate>
  )
}
