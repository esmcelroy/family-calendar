import { useEffect, useState, type FormEvent } from 'react'
import { serverApi } from '@/lib/server-api'
import { FeedSettings } from './FeedSettings'

interface AdminSettings {
  organizerName: string | null
  organizerEmail: string | null
  smtpConfigured: boolean
  smtp: {
    host: string | null
    port: number | null
    secure: boolean
    username: string | null
    fromName: string | null
    fromAddress: string | null
  } | null
}
type SmtpForm = NonNullable<AdminSettings['smtp']>

const emptySettings: AdminSettings = {
  organizerName: null,
  organizerEmail: null,
  smtpConfigured: false,
  smtp: null,
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<AdminSettings>(emptySettings)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    serverApi.request<AdminSettings>('/api/admin/settings')
      .then((saved) => { if (active) setSettings(saved) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load settings.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const smtpConfiguredInForm = Boolean(
        settings.smtp?.host || settings.smtp?.fromAddress || password || settings.smtpConfigured,
      )
      const saved = await serverApi.request<AdminSettings>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          organizerName: settings.organizerName,
          organizerEmail: settings.organizerEmail,
          ...(smtpConfiguredInForm ? {
            smtp: {
              host: settings.smtp?.host ?? '',
              port: Number(settings.smtp?.port ?? 587),
              secure: settings.smtp?.secure ?? false,
              username: settings.smtp?.username ?? '',
              password,
              fromName: settings.smtp?.fromName ?? '',
              fromAddress: settings.smtp?.fromAddress ?? '',
            },
          } : {}),
        }),
      })
      setSettings(saved)
      setPassword('')
      setMessage('Settings saved. SMTP credentials remain protected on the server.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save settings.')
    } finally {
      setBusy(false)
    }
  }

  const testSmtp = async () => {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      await serverApi.request('/api/admin/settings/smtp/test', { method: 'POST' })
      setMessage('SMTP connection verified using the saved server settings.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'SMTP test failed.')
    } finally {
      setBusy(false)
    }
  }

  const updateSmtp = <K extends keyof SmtpForm>(field: K, value: SmtpForm[K]) => {
    setSettings((current) => ({
      ...current,
      smtp: {
        host: current.smtp?.host ?? null,
        port: current.smtp?.port ?? null,
        secure: current.smtp?.secure ?? false,
        username: current.smtp?.username ?? null,
        fromName: current.smtp?.fromName ?? null,
        fromAddress: current.smtp?.fromAddress ?? null,
        [field]: value,
      },
    }))
  }

  return (
    <section aria-labelledby="admin-settings-heading" className="space-y-4 rounded-lg border p-4">
      <h2 id="admin-settings-heading" className="text-xl font-semibold">Family settings</h2>
      {loading ? <p role="status">Loading settings…</p> : (
        <form onSubmit={(event) => void save(event)} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1">
            Organizer name
            <input className="min-h-11 rounded-md border bg-background px-3 py-2" value={settings.organizerName ?? ''} onChange={(event) => setSettings((current) => ({ ...current, organizerName: event.target.value }))} />
          </label>
          <label className="grid gap-1">
            Organizer email
            <input type="email" className="min-h-11 rounded-md border bg-background px-3 py-2" value={settings.organizerEmail ?? ''} onChange={(event) => setSettings((current) => ({ ...current, organizerEmail: event.target.value }))} />
          </label>
          <label className="grid gap-1">
            SMTP host
            <input className="min-h-11 rounded-md border bg-background px-3 py-2" value={settings.smtp?.host ?? ''} onChange={(event) => updateSmtp('host', event.target.value)} />
          </label>
          <label className="grid gap-1">
            SMTP port
            <input required type="number" min="1" max="65535" className="min-h-11 rounded-md border bg-background px-3 py-2" value={settings.smtp?.port ?? 587} onChange={(event) => updateSmtp('port', Number(event.target.value))} />
          </label>
          <label className="grid gap-1">
            SMTP username
            <input className="min-h-11 rounded-md border bg-background px-3 py-2" value={settings.smtp?.username ?? ''} onChange={(event) => updateSmtp('username', event.target.value)} />
          </label>
          <label className="grid gap-1">
            SMTP password {settings.smtpConfigured ? '(leave blank to keep saved password)' : ''}
            <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-11 rounded-md border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1">
            From name
            <input className="min-h-11 rounded-md border bg-background px-3 py-2" value={settings.smtp?.fromName ?? ''} onChange={(event) => updateSmtp('fromName', event.target.value)} />
          </label>
          <label className="grid gap-1">
            From email
            <input type="email" className="min-h-11 rounded-md border bg-background px-3 py-2" value={settings.smtp?.fromAddress ?? ''} onChange={(event) => updateSmtp('fromAddress', event.target.value)} />
          </label>
          <label className="flex min-h-11 items-center gap-2 sm:col-span-2">
            <input type="checkbox" className="h-5 w-5" checked={settings.smtp?.secure ?? false} onChange={(event) => updateSmtp('secure', event.target.checked)} />
            Use implicit TLS
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className="min-h-11 rounded-md bg-primary px-4 py-2 text-primary-foreground" disabled={busy}>Save settings</button>
            <button type="button" className="min-h-11 rounded-md border px-4 py-2" disabled={busy || !settings.smtpConfigured} onClick={() => void testSmtp()}>Test saved SMTP</button>
          </div>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <FeedSettings />
    </section>
  )
}
