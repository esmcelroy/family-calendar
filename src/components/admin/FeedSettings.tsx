import { useCallback, useEffect, useState } from 'react'
import { serverApi } from '@/lib/server-api'

interface FeedStatus {
  enabled: boolean
  feedUrl?: string
}

export function FeedSettings() {
  const [status, setStatus] = useState<FeedStatus>({ enabled: false })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setStatus(await serverApi.request<FeedStatus>('/api/admin/feed'))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load feed status.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const rotate = async () => {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      setStatus(await serverApi.request<FeedStatus>('/api/admin/feed', { method: 'POST' }))
      setMessage('Live calendar feed URL updated.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to rotate feed URL.')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      await serverApi.request<void>('/api/admin/feed', { method: 'DELETE' })
      setStatus({ enabled: false })
      setMessage('Live calendar feed revoked.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to revoke feed URL.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="feed-settings-heading" className="space-y-3 border-t pt-4">
      <h3 id="feed-settings-heading" className="text-lg font-semibold">Live calendar feed</h3>
      <p className="text-sm text-muted-foreground">This secret URL exposes the current merged family calendar to subscribed calendar apps.</p>
      {status.enabled && status.feedUrl ? (
        <>
          <label className="grid gap-1">
            Feed URL
            <input readOnly aria-label="Feed URL" className="min-h-11 w-full rounded-md border bg-muted px-3 py-2" value={status.feedUrl} onFocus={(event) => event.currentTarget.select()} />
          </label>
          <button type="button" className="min-h-11 rounded-md border px-4 py-2" disabled={busy} onClick={() => void revoke()}>Revoke feed URL</button>
        </>
      ) : <p>The live feed is disabled.</p>}
      <button type="button" className="min-h-11 rounded-md border px-4 py-2" disabled={busy} onClick={() => void rotate()}>
        {status.enabled ? 'Rotate feed URL' : 'Enable live feed'}
      </button>
      {message && <p role="status" aria-live="polite">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
