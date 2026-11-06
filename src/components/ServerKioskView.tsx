import { useEffect, useState } from 'react'
import { Clock, CalendarBlank } from '@phosphor-icons/react'
import { expandRecurringEvents, formatDate, formatTime, sortEventsByTime } from '@/lib/calendar'
import { useServerCalendar } from '@/lib/server-calendar'

export function ServerKioskView() {
  const { events, members, loading, error, reload } = useServerCalendar()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const refresh = () => {
      void reload().catch(() => undefined)
    }
    const interval = window.setInterval(refresh, 300_000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [reload])

  const today = formatDate(now)
  const upcomingThrough = new Date(now)
  upcomingThrough.setDate(upcomingThrough.getDate() + 7)
  const upcomingThroughDate = formatDate(upcomingThrough)
  const expanded = expandRecurringEvents(events, now)
  const todayEvents = sortEventsByTime(expanded.filter((event) => event.date === today))

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground"
      role="main"
      aria-label="Family Calendar Kiosk Display"
    >
      <header className="flex items-center justify-between border-b px-8 py-4">
        <p className="text-xl font-medium text-muted-foreground">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        <p className="flex items-center gap-2 text-4xl font-bold" aria-live="polite">
          <Clock size={32} aria-hidden="true" />
          {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </p>
      </header>
      <div className="grid flex-1 grid-cols-1 gap-6 overflow-auto p-8 md:grid-cols-2">
        <section aria-label="Today's events" className="space-y-4">
          <h1 className="text-3xl font-bold">Today</h1>
          {loading && <p role="status">Loading shared calendar…</p>}
          {error && <p role="alert">{error}</p>}
          {!loading && todayEvents.length === 0 && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <CalendarBlank size={40} aria-hidden="true" />
              <p>Nothing scheduled today</p>
            </div>
          )}
          {todayEvents.map((event) => {
            const assigned = members.filter((member) => event.memberIds.includes(member.id))
            return (
              <article key={event.id} className="rounded-xl border-l-4 bg-card p-4" style={{ borderColor: assigned[0]?.color ?? 'var(--border)' }}>
                <h2 className="text-xl font-semibold">{event.title}</h2>
                {(event.startTime || assigned.length > 0) && (
                  <p className="mt-1 text-muted-foreground">
                    {event.startTime ? formatTime(event.startTime) : ''}
                    {event.endTime ? ` – ${formatTime(event.endTime)}` : ''}
                    {assigned.length ? ` · ${assigned.map((member) => member.name).join(', ')}` : ''}
                  </p>
                )}
              </article>
            )
          })}
        </section>
        <section aria-label="Upcoming events" className="space-y-4">
          <h2 className="text-2xl font-bold">Next 7 Days</h2>
          {expanded
            .filter((event) => event.date > today && event.date <= upcomingThroughDate)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 12)
            .map((event) => (
              <article key={event.id} className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">{event.date}</p>
                <h3 className="font-semibold">{event.title}</h3>
              </article>
            ))}
        </section>
      </div>
    </div>
  )
}
