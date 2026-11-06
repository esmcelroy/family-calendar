import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AuthScreens, type Credentials } from './AuthScreens'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'member'
  createdAt: string
}

interface AuthGateProps {
  user: AuthUser | null
  bootstrapRequired: boolean
  loading: boolean
  onLogin?: (credentials: Credentials) => void | Promise<void>
  onBootstrap?: (credentials: Credentials) => void | Promise<void>
  onLogout: () => void | Promise<void>
  error?: string | null
  busy?: boolean
  children: ReactNode
}

export function AuthGate({
  user,
  bootstrapRequired,
  loading,
  onLogin,
  onBootstrap,
  onLogout,
  error,
  busy = false,
  children,
}: AuthGateProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const userId = user?.id

  useEffect(() => {
    if (userId) contentRef.current?.focus()
  }, [userId])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p role="status">Checking session…</p>
      </main>
    )
  }

  if (!user) {
    return (
      <AuthScreens
        mode={bootstrapRequired ? 'bootstrap' : 'login'}
        onSubmit={bootstrapRequired ? (onBootstrap ?? (() => undefined)) : (onLogin ?? (() => undefined))}
        error={error}
        busy={busy}
      />
    )
  }

  return (
    <>
      <div ref={contentRef} tabIndex={-1}>
        <div className="flex min-h-11 items-center justify-end gap-3 border-b px-4 py-2 text-sm">
          <span>{user.username}</span>
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void onLogout()}>
            Log out
          </Button>
        </div>
        {children}
      </div>
    </>
  )
}
