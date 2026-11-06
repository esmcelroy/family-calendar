import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'

export interface Credentials {
  username: string
  password: string
}

interface AuthScreensProps {
  mode: 'bootstrap' | 'login'
  onSubmit: (credentials: Credentials) => void | Promise<void>
  error?: string | null
  busy?: boolean
}

export function AuthScreens({ mode, onSubmit, error, busy = false }: AuthScreensProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const usernameRef = useRef<HTMLInputElement>(null)
  const isBootstrap = mode === 'bootstrap'
  const title = isBootstrap ? 'Create administrator' : 'Sign in'

  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSubmit({ username, password })
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <section className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm" aria-labelledby="auth-title">
        <h1 id="auth-title" className="text-2xl font-semibold">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isBootstrap
            ? 'Create the first account for this family calendar.'
            : 'Sign in to your family calendar.'}
        </p>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <label htmlFor="auth-username" className="text-sm font-medium">Username</label>
            <input
              id="auth-username"
              ref={usernameRef}
              name="username"
              autoComplete="username"
              required
              maxLength={60}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="min-h-11 w-full rounded-md border bg-background px-3 py-2"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="auth-password" className="text-sm font-medium">Password</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={isBootstrap ? 'new-password' : 'current-password'}
              required
              minLength={isBootstrap ? 8 : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-11 w-full rounded-md border bg-background px-3 py-2"
            />
          </div>
          <Button type="submit" className="min-h-11 w-full" disabled={busy}>
            {busy ? 'Please wait…' : title}
          </Button>
        </form>
      </section>
    </main>
  )
}
