import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { serverApi } from '@/lib/server-api'
import { formatDate } from '@/lib/calendar'
import type { CalendarEvent } from '@/lib/types'
import { ServerCalendarApp } from './ServerCalendarApp'

describe('ServerCalendarApp', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('creates shared events through the API and reports confirmed data', async () => {
    const request = vi.spyOn(serverApi, 'request').mockImplementation(async (path, init) => {
      if (path === '/api/calendar/events' && init?.method === 'POST') {
        return {
          id: 'event-1',
          title: 'Family dinner',
          date: '2026-11-06',
          startTime: '18:00',
          endTime: '19:00',
          description: 'Bring dessert',
          memberIds: [],
          recurrence: { frequency: 'weekly', interval: 1, endType: 'none', selectedDays: [5] },
          seriesId: 'event-1',
        } as never
      }
      if (path === '/api/calendar/events') return { events: [] } as never
      if (path === '/api/calendar/members') return { members: [] } as never
      if (path === '/api/calendar/subscriptions') return { subscriptions: [] } as never
      if (path === '/api/me/preferences') return { activeFilters: [] } as never
      return {} as never
    })
    const setItem = vi.spyOn(window.localStorage, 'setItem')
    render(<ServerCalendarApp />)

    await screen.findByRole('heading', { name: 'Family Calendar' })
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }))
    fireEvent.change(screen.getByLabelText('Event Title'), { target: { value: 'Family dinner' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-06' } })
    fireEvent.change(screen.getByLabelText('Start Time (Optional)'), { target: { value: '18:00' } })
    fireEvent.change(screen.getByLabelText('End Time (Optional)'), { target: { value: '19:00' } })
    fireEvent.change(screen.getByLabelText('Description (Optional)'), { target: { value: 'Bring dessert' } })
    fireEvent.click(screen.getByLabelText('Recurrence'))
    fireEvent.click(screen.getByRole('button', { name: 'Add Event' }))

    expect(await screen.findAllByText('Family dinner')).not.toHaveLength(0)
    expect(await screen.findByRole('status')).toHaveTextContent('Event added.')
    expect(request).toHaveBeenCalledWith(
      '/api/calendar/events',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"startTime":"18:00"'),
      }),
    )
    expect(request).toHaveBeenCalledWith(
      '/api/calendar/events',
      expect.objectContaining({ body: expect.stringContaining('"frequency":"weekly"') }),
    )
    expect(setItem).not.toHaveBeenCalled()
  })

  it('shows failed writes and does not add optimistic calendar data', async () => {
    vi.spyOn(serverApi, 'request').mockImplementation(async (path, init) => {
      if (path === '/api/calendar/events' && init?.method === 'POST') {
        throw new Error('The server is unavailable. Your changes were not saved.')
      }
      if (path === '/api/calendar/events') return { events: [] } as never
      if (path === '/api/calendar/members') return { members: [] } as never
      if (path === '/api/calendar/subscriptions') return { subscriptions: [] } as never
      if (path === '/api/me/preferences') return { activeFilters: [] } as never
      return {} as never
    })
    render(<ServerCalendarApp />)

    await screen.findByRole('heading', { name: 'Family Calendar' })
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }))
    fireEvent.change(screen.getByLabelText('Event Title'), { target: { value: 'Unsaved event' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-06' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Event' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('not saved')
    expect(screen.getByLabelText('Event Title')).toHaveValue('Unsaved event')
    await waitFor(() => expect(screen.queryByText('Unsaved event')).not.toBeInTheDocument())
  })

  it('disables recurrence editing when editing a single recurring occurrence', async () => {
    const today = new Date()
    const event: CalendarEvent = {
      id: 'series-1',
      title: 'Weekly dinner',
      date: formatDate(today),
      memberIds: [],
      seriesId: 'series-1',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        selectedDays: [today.getDay()],
        endType: 'none',
      },
    }
    vi.spyOn(serverApi, 'request').mockImplementation(async (path) => {
      if (path === '/api/calendar/events') return { events: [event] } as never
      if (path === '/api/calendar/members') return { members: [] } as never
      if (path === '/api/calendar/subscriptions') return { subscriptions: [] } as never
      if (path === '/api/me/preferences') return { activeFilters: [] } as never
      return {} as never
    })
    render(<ServerCalendarApp />)

    const [eventButton] = await screen.findAllByRole('button', { name: 'View event: Weekly dinner' })
    if (!eventButton) throw new Error('Expected the recurring event to render.')
    fireEvent.click(eventButton)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'This event' }))

    expect(await screen.findByLabelText('Recurrence')).toBeDisabled()
    expect(screen.getByLabelText('Frequency')).toBeDisabled()
  })
})
