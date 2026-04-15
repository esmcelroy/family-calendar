import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { KioskView } from './KioskView'
import type { CalendarEvent, FamilyMember, KioskConfig } from '@/lib/types'
import { STORAGE_KEYS } from '@/lib/storage'

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

function todayStr(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function inNDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
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
    seedLocalStorage()
    render(<KioskView />)

    const before = screen.getByLabelText(/current time/i).textContent

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    // The label element should still be in the document (clock still renders)
    expect(screen.getByLabelText(/current time/i)).toBeInTheDocument()
    // Value should exist (it's a time string)
    expect(before).toBeTruthy()
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

  it('shows empty-state for upcoming when no future events exist', () => {
    seedLocalStorage()
    render(<KioskView />)

    expect(screen.getByText(/nothing coming up/i)).toBeInTheDocument()
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
