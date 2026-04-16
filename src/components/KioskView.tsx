import { useState, useEffect, useCallback, useMemo } from 'react'
import { CalendarEvent, FamilyMember, KioskConfig } from '@/lib/types'
import { STORAGE_KEYS, localStorageAdapter } from '@/lib/storage'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { expandRecurringEvents, formatDate, formatTime, sortEventsByTime } from '@/lib/calendar'
import { Clock, CalendarBlank } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

const DEFAULT_KIOSK_CONFIG: KioskConfig = {
  memberFilter: [],
  refreshIntervalMs: 300_000,
}

const MIN_REFRESH_INTERVAL_MS = 5_000
const MAX_TODAY_EVENTS = 8
const MAX_UPCOMING_EVENTS = 12

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

interface EventCardProps {
  event: CalendarEvent
  members: FamilyMember[]
  large?: boolean
}

function EventCard({ event, members, large = false }: EventCardProps) {
  const eventMembers = members.filter((m) => event.memberIds.includes(m.id))
  const primaryColor = eventMembers[0]?.color ?? 'oklch(0.65 0.18 240)'

  return (
    <div
      className={cn(
        'rounded-xl border-l-4 bg-card/60 backdrop-blur-sm',
        large ? 'px-5 py-4' : 'px-4 py-3',
      )}
      style={{ borderLeftColor: primaryColor }}
      title={event.title}
    >
      <div className={cn('font-semibold truncate', large ? 'text-2xl' : 'text-lg')}>
        {event.title}
      </div>
      {(event.startTime || eventMembers.length > 0) && (
        <div className={cn('flex items-center gap-3 mt-1 text-muted-foreground', large ? 'text-base' : 'text-sm')}>
          {event.startTime && (
            <span>
              {formatTime(event.startTime)}
              {event.endTime ? ` – ${formatTime(event.endTime)}` : ''}
            </span>
          )}
          {eventMembers.length > 0 && (
            <span className="flex items-center gap-1">
              {eventMembers.map((m) => (
                <span
                  key={m.id}
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: m.color }}
                  aria-label={m.name}
                  title={m.name}
                />
              ))}
              <span>{eventMembers.map((m) => m.name).join(', ')}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

interface UpcomingDayProps {
  date: Date
  events: CalendarEvent[]
  members: FamilyMember[]
}

function UpcomingDay({ date, events, members }: UpcomingDayProps) {
  const sorted = sortEventsByTime(events)
  const visible = sorted.slice(0, 3)
  const overflow = sorted.length - visible.length

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {formatShortDate(date)}
      </h3>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nothing scheduled</p>
      ) : (
        <>
          {visible.map((ev) => (
            <EventCard key={ev.id} event={ev} members={members} />
          ))}
          {overflow > 0 && (
            <p className="text-sm text-muted-foreground pl-1">+{overflow} more</p>
          )}
        </>
      )}
    </div>
  )
}

export function KioskView() {
  const [kioskConfig] = useLocalStorage<KioskConfig>(
    STORAGE_KEYS.kioskConfig,
    DEFAULT_KIOSK_CONFIG,
  )

  const [events, setEvents] = useState<CalendarEvent[]>(() =>
    localStorageAdapter.get<CalendarEvent[]>(STORAGE_KEYS.events, []),
  )
  const [members, setMembers] = useState<FamilyMember[]>(() =>
    localStorageAdapter.get<FamilyMember[]>(STORAGE_KEYS.members, []),
  )

  const [now, setNow] = useState(new Date())

  const refresh = useCallback(() => {
    setEvents(localStorageAdapter.get<CalendarEvent[]>(STORAGE_KEYS.events, []))
    setMembers(localStorageAdapter.get<FamilyMember[]>(STORAGE_KEYS.members, []))
  }, [])

  // Live clock — ticks every minute and updates today's date if day rolls over
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  // Auto-refresh data from localStorage at the configured interval.
  // Clamp to a minimum to prevent tight loops if the stored value is invalid.
  const rawInterval = kioskConfig?.refreshIntervalMs
  const refreshIntervalMs = Math.max(
    MIN_REFRESH_INTERVAL_MS,
    Number.isFinite(Number(rawInterval)) && Number(rawInterval) > 0
      ? Number(rawInterval)
      : DEFAULT_KIOSK_CONFIG.refreshIntervalMs,
  )
  useEffect(() => {
    const interval = setInterval(refresh, refreshIntervalMs)
    return () => clearInterval(interval)
  }, [refresh, refreshIntervalMs])

  // Page Visibility API — refresh immediately when the tab regains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refresh])

  // Cross-tab localStorage sync
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.events || e.key === STORAGE_KEYS.members) {
        refresh()
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [refresh])

  const allMembers = members
  // Normalize memberFilter — guard against missing/non-array values from persisted JSON
  const memberFilter: string[] = Array.isArray(kioskConfig?.memberFilter)
    ? kioskConfig.memberFilter
    : []

  // Memoize event expansion: only recompute when events change or the date rolls over.
  // Use start-of-day as reference so minute clock ticks don't trigger expensive re-expansion.
  const startOfDay = useMemo(() => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }, [formatDate(now)]) // eslint-disable-line react-hooks/exhaustive-deps

  const expandedEvents = useMemo(
    () => expandRecurringEvents(events, startOfDay),
    [events, startOfDay],
  )

  // Apply member filter if configured
  const filteredEvents =
    memberFilter.length > 0
      ? expandedEvents.filter((ev) => ev.memberIds.some((id) => memberFilter.includes(id)))
      : expandedEvents

  const todayStr = formatDate(now)
  const todayEvents = sortEventsByTime(filteredEvents.filter((ev) => ev.date === todayStr))
  const todayVisible = todayEvents.slice(0, MAX_TODAY_EVENTS)
  const todayOverflow = todayEvents.length - todayVisible.length

  // Upcoming: next 7 days (not including today) — always include all 7 so empty days show "Nothing scheduled"
  const upcomingDays: { date: Date; events: CalendarEvent[] }[] = []
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    const dStr = formatDate(d)
    const dayEvents = sortEventsByTime(filteredEvents.filter((ev) => ev.date === dStr))
    upcomingDays.push({ date: d, events: dayEvents })
  }
  const visibleUpcomingDays = upcomingDays.slice(0, MAX_UPCOMING_EVENTS)

  return (
    <div
      className="fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden"
      role="main"
      aria-label="Family Calendar Kiosk Display"
    >
      {/* Header bar */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-border/40 shrink-0">
        <div>
          <p className="text-xl font-medium text-muted-foreground">{formatFullDate(now)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 text-4xl font-bold tabular-nums"
            aria-live="polite"
            aria-label={`Current time: ${formatClockTime(now)}`}
          >
            <Clock size={32} className="text-muted-foreground" aria-hidden="true" />
            {formatClockTime(now)}
          </div>
        </div>
      </header>

      {/* Two-panel body */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* Left panel — Today */}
        <section
          className="flex-[3] flex flex-col px-8 py-6 min-w-0 border-r border-border/40"
          aria-label="Today's events"
        >
          <h2 className="text-3xl font-bold mb-6 shrink-0">Today</h2>

          {todayVisible.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-3">
              <CalendarBlank size={64} weight="duotone" aria-hidden="true" />
              <p className="text-2xl font-medium">Nothing scheduled today</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 overflow-y-auto flex-1 pr-1">
              {todayVisible.map((ev) => (
                <EventCard key={ev.id} event={ev} members={allMembers} large />
              ))}
              {todayOverflow > 0 && (
                <p className="text-lg text-muted-foreground pl-1">+{todayOverflow} more</p>
              )}
            </div>
          )}
        </section>

        {/* Right panel — Upcoming */}
        <section
          className="flex-[2] flex flex-col px-6 py-6 min-w-0"
          aria-label="Upcoming events"
        >
          <h2 className="text-2xl font-bold mb-5 shrink-0">Next 7 Days</h2>

          {visibleUpcomingDays.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-3">
              <CalendarBlank size={48} weight="duotone" aria-hidden="true" />
              <p className="text-xl font-medium">Nothing coming up</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 overflow-y-auto flex-1 pr-1">
              {visibleUpcomingDays.map(({ date, events: dayEvents }) => (
                <UpcomingDay
                  key={formatDate(date)}
                  date={date}
                  events={dayEvents}
                  members={allMembers}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
