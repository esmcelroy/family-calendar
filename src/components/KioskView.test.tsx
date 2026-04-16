import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { KioskView } from './KioskView'
import type { CalendarEvent, FamilyMember, KioskConfig } from '@/lib/types'
import { STORAGE_KEYS } from '@/lib/storage'
import { formatDate } from '@/lib/calendar'

// ─── helpers ────────────────────────────────────────────────────────────────

function seedLocalStorage(
  events: CalendarEvent[] = [],
  members: FamilyMember[] = [],
  kioskConfig?: Partial<KioskConfig>,
) {
  const cfg: KioskConfig = {
    memberFilter: [],
    refreshIntervalMs: 300_000,
    ...kioskConfig,
  }
  localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events))
  localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(members))
  localStorage.setItem(STORAGE_KEYS.kioskConfig, JSON.stringify(cfg))
}

// Use formatDate (UTC-based, matches how events are stored in production)
function todayStr(): string {
  return formatDate(new Date())
}

function inNDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return formatDate(d)
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('KioskView', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()
  })

  afterEach(() => {
    expect(consoleErrorSpy, 'No React errors should be thrown').not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
    vi.useRealTimers()
  })

  it('renders the kiosk display with today heading and clock', () => {
    seedLocalStorage()
    render(<KioskView />)

    expect(screen.getByRole('main', { name: /kiosk display/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /today/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /next 7 days/i })).toBeInTheDocument()
  })

  it('shows empty-state message when there are no events today', () => {
    seedLocalStorage()
    render(<KioskView />)

    expect(screen.getByText(/nothing scheduled today/i)).toBeInTheDocument()
  })

  it('renders today\'s events in the today panel', () => {
    const members: FamilyMember[] = [{ id: 'm1', name: 'Alice', color: 'oklch(0.55 0.20 220)' }]
    const events: CalendarEvent[] = [
      { id: 'e1', title: 'Morning Walk', date: todayStr(), memberIds: ['m1'] },
    ]
    seedLocalStorage(events, members)
    render(<KioskView />)

    expect(screen.getByText('Morning Walk')).toBeInTheDocument()
  })

  it('renders upcoming events for future days', () => {
    const members: FamilyMember[] = [{ id: 'm1', name: 'Bob', color: 'oklch(0.65 0.18 240)' }]
    const events: CalendarEvent[] = [
      { id: 'e2', title: 'Team Meeting', date: inNDays(2), memberIds: ['m1'] },
    ]
    seedLocalStorage(events, members)
    render(<KioskView />)

    expect(screen.getByText('Team Meeting')).toBeInTheDocument()
  })

  it('shows "+N more" badge when today has more than the visible limit', () => {
    const members: FamilyMember[] = [{ id: 'm1', name: 'Alice', color: 'oklch(0.55 0.20 220)' }]
    const events: CalendarEvent[] = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      title: `Event ${i + 1}`,
      date: todayStr(),
      memberIds: ['m1'],
    }))
    seedLocalStorage(events, members)
    render(<KioskView />)

    // 8 visible max → 2 overflow
    expect(screen.getByText(/\+2 more/i)).toBeInTheDocument()
  })

  it('updates the clock every minute', () => {
    vi.setSystemTime(new Date('2026-04-16T10:00:00'))
    seedLocalStorage()
    render(<KioskView />)

    const labelBefore = screen.getByLabelText(/current time/i).textContent ?? ''
    expect(labelBefore).toMatch(/10:00 AM/i)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    const labelAfter = screen.getByLabelText(/current time/i).textContent ?? ''
    expect(labelAfter).toMatch(/10:01 AM/i)
    expect(labelAfter).not.toBe(labelBefore)
  })

  it('filters events by memberFilter when configured', () => {
    const members: FamilyMember[] = [
      { id: 'm1', name: 'Alice', color: 'oklch(0.55 0.20 220)' },
      { id: 'm2', name: 'Bob', color: 'oklch(0.65 0.18 240)' },
    ]
    const events: CalendarEvent[] = [
      { id: 'e1', title: 'Alice Only', date: todayStr(), memberIds: ['m1'] },
      { id: 'e2', title: 'Bob Only', date: todayStr(), memberIds: ['m2'] },
    ]
    seedLocalStorage(events, members, { memberFilter: ['m1'] })
    render(<KioskView />)

    expect(screen.getByText('Alice Only')).toBeInTheDocument()
    expect(screen.queryByText('Bob Only')).not.toBeInTheDocument()
  })

  it('shows all events when memberFilter is empty', () => {
    const members: FamilyMember[] = [
      { id: 'm1', name: 'Alice', color: 'oklch(0.55 0.20 220)' },
      { id: 'm2', name: 'Bob', color: 'oklch(0.65 0.18 240)' },
    ]
    const events: CalendarEvent[] = [
      { id: 'e1', title: 'Alice Only', date: todayStr(), memberIds: ['m1'] },
      { id: 'e2', title: 'Bob Only', date: todayStr(), memberIds: ['m2'] },
    ]
    seedLocalStorage(events, members, { memberFilter: [] })
    render(<KioskView />)

    expect(screen.getByText('Alice Only')).toBeInTheDocument()
    expect(screen.getByText('Bob Only')).toBeInTheDocument()
  })

  it('shows "Nothing scheduled" for each empty upcoming day when no future events exist', () => {
    seedLocalStorage()
    render(<KioskView />)

    // All 7 upcoming days are always rendered; each empty day shows "Nothing scheduled"
    const nothingScheduled = screen.getAllByText(/nothing scheduled/i)
    expect(nothingScheduled.length).toBeGreaterThan(0)
  })

  it('displays event start time when provided', () => {
    const members: FamilyMember[] = [{ id: 'm1', name: 'Alice', color: 'oklch(0.55 0.20 220)' }]
    const events: CalendarEvent[] = [
      { id: 'e1', title: 'Dentist', date: todayStr(), startTime: '14:30', endTime: '15:00', memberIds: ['m1'] },
    ]
    seedLocalStorage(events, members)
    render(<KioskView />)

    expect(screen.getByText(/2:30 PM/i)).toBeInTheDocument()
  })

  it('refreshes data when Page Visibility API fires visible event', () => {
    seedLocalStorage()
    render(<KioskView />)

    // Update storage with a new event
    const newEvents: CalendarEvent[] = [
      { id: 'e99', title: 'Surprise Event', date: todayStr(), memberIds: [] },
    ]
    localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(newEvents))

    // Simulate tab becoming visible
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(screen.getByText('Surprise Event')).toBeInTheDocument()
  })
})
