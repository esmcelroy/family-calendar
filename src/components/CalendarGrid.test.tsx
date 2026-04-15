import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarGrid } from './CalendarGrid'
import { formatDate } from '@/lib/calendar'
import type { CalendarEvent, FamilyMember } from '@/lib/types'

describe('CalendarGrid', () => {
  it('renders events for matching days', () => {
    const members: FamilyMember[] = [{ id: 'm1', name: 'Alex', color: 'oklch(0.55 0.20 220)' }]
    const eventDate = new Date(2026, 0, 15)
    const events: CalendarEvent[] = [
      {
        id: 'event-1',
        title: 'Family Dinner',
        date: formatDate(eventDate),
        memberIds: ['m1'],
      },
    ]

    render(
      <CalendarGrid
        currentDate={new Date(2026, 0, 1)}
        events={events}
        members={members}
        onDateClick={vi.fn()}
        onEventClick={vi.fn()}
        activeFilters={[]}
      />,
    )

    expect(screen.getByRole('button', { name: /View event: Family Dinner/i })).toBeInTheDocument()
  })
})
