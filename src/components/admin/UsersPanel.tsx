import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { serverApi } from '@/lib/server-api'
import type { AuthUser } from '@/components/auth/AuthGate'

interface UsersResponse {
  users: AuthUser[]
}

interface CreateUserRequest {
  username: string
  password: string
  role: 'admin' | 'member'
}

export function UsersPanel() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    serverApi.request<UsersResponse>('/api/admin/users')
      .then((response) => {
        if (active) setUsers(response.users)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load accounts.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body: CreateUserRequest = { username, password, role }
    setSaving(true)
    setStatus(null)
    setError(null)
    try {
      const created = await serverApi.request<AuthUser>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setUsers((current) => [...current, created].sort((a, b) => a.username.localeCompare(b.username)))
      setUsername('')
      setPassword('')
      setRole('member')
      setStatus('Account created.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create account.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-5 rounded-xl border bg-card p-5" aria-labelledby="accounts-title">
      <div>
        <h2 id="accounts-title" className="text-xl font-semibold">Family accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Only administrators can add accounts.</p>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {status && <p role="status" aria-live="polite" className="text-sm">{status}</p>}

      <div>
        <h3 className="font-medium">Existing accounts</h3>
        {loading ? (
          <p role="status" className="mt-2 text-sm text-muted-foreground">Loading accounts…</p>
        ) : (
          <ul className="mt-2 divide-y">
            {users.map((user) => (
              <li key={user.id} className="flex items-center justify-between py-2">
                <span>{user.username}</span>
                <span className="text-sm text-muted-foreground">{user.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void createUser(event)}>
        <div className="space-y-1">
          <label htmlFor="new-account-username" className="text-sm font-medium">New username</label>
          <input
            id="new-account-username"
            autoComplete="off"
            required
            maxLength={60}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="min-h-11 w-full rounded-md border bg-background px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-account-password" className="text-sm font-medium">Temporary password</label>
          <input
            id="new-account-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11 w-full rounded-md border bg-background px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-account-role" className="text-sm font-medium">Account role</label>
          <select
            id="new-account-role"
            value={role}
            onChange={(event) => setRole(event.target.value as 'admin' | 'member')}
            className="min-h-11 w-full rounded-md border bg-background px-3 py-2"
          >
            <option value="member">Family member</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={saving} className="min-h-11 w-full">
            {saving ? 'Creating…' : 'Create account'}
          </Button>
        </div>
      </form>
    </section>
  )
}
