import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { serverApi } from './server-api'
import { useServerCalendar } from './server-calendar'
import type { CalendarEvent, FamilyMember } from './types'

const event: CalendarEvent = {
  id: 'event-1',
  title: 'Shared dinner',
  date: '2026-11-06',
  memberIds: [],
}
const member: FamilyMember = { id: 'member-1', name: 'Alex', color: 'blue' }

function setupApi() {
  return vi.spyOn(serverApi, 'request').mockImplementation(async (path) => {
    if (path === '/api/calendar/events') return { events: [event] } as never
    if (path === '/api/calendar/members') return { members: [member] } as never
    if (path === '/api/calendar/subscriptions') return { subscriptions: [] } as never
    if (path === '/api/me/preferences') return { activeFilters: [] } as never
    return {} as never
  })
}

describe('server calendar API state', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('loads events, family members, subscriptions, and preferences asynchronously', async () => {
    const request = setupApi()
    const { result } = renderHook(() => useServerCalendar())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.events).toEqual([event])
    expect(result.current.members).toEqual([member])
    expect(result.current.subscriptions).toEqual([])
    expect(result.current.preferences.activeFilters).toEqual([])
    expect(request).toHaveBeenCalledWith('/api/calendar/events')
  })

  it('surfaces a rejected write and never queues it or touches browser storage', async () => {
    const request = setupApi()
    request.mockImplementation(async (path, init) => {
      if (path === '/api/calendar/events' && init?.method === 'POST') {
        throw new Error('The server is unavailable.')
      }
      if (path === '/api/calendar/events') return { events: [event] } as never
      if (path === '/api/calendar/members') return { members: [member] } as never
      if (path === '/api/calendar/subscriptions') return { subscriptions: [] } as never
      return { activeFilters: [] } as never
    })
    const setItem = vi.spyOn(window.localStorage, 'setItem')
    const { result } = renderHook(() => useServerCalendar())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(result.current.createEvent({ title: 'Not saved', date: '2026-11-07', memberIds: [] }))
        .rejects.toThrow('The server is unavailable.')
    })

    expect(result.current.error).toContain('server is unavailable')
    expect(request.mock.calls.filter(([path, init]) => path === '/api/calendar/events' && init?.method === 'POST')).toHaveLength(1)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('persists preferences through the current-user endpoint and updates local view state only after confirmation', async () => {
    const request = setupApi()
    request.mockImplementation(async (path, init) => {
      if (path === '/api/me/preferences' && init?.method === 'PUT') {
        return { activeFilters: ['member-1'], activeView: 'month' } as never
      }
      if (path === '/api/calendar/events') return { events: [event] } as never
      if (path === '/api/calendar/members') return { members: [member] } as never
      if (path === '/api/calendar/subscriptions') return { subscriptions: [] } as never
      return { activeFilters: [] } as never
    })
    const { result } = renderHook(() => useServerCalendar())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updatePreferences({ activeFilters: ['member-1'], activeView: 'month' })
    })

    expect(result.current.preferences).toMatchObject({ activeFilters: ['member-1'], activeView: 'month' })
    expect(request).toHaveBeenCalledWith(
      '/api/me/preferences',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('removes a deleted member from recurrence overrides and active filters', async () => {
    const request = setupApi()
    request.mockImplementation(async (path) => {
      if (path === '/api/calendar/events') {
        return {
          events: [{
            ...event,
            memberIds: ['member-1'],
            seriesExceptions: [{
              date: '2026-11-13',
              type: 'modified',
              overrides: { memberIds: ['member-1'] },
            }],
          }],
        } as never
      }
      if (path === '/api/calendar/members') return { members: [member] } as never
      if (path === '/api/calendar/subscriptions') return { subscriptions: [] } as never
      if (path === '/api/me/preferences') return { activeFilters: ['member-1'] } as never
      return {} as never
    })
    const { result } = renderHook(() => useServerCalendar())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteMember('member-1')
    })

    expect(result.current.events[0]).toMatchObject({
      memberIds: [],
      seriesExceptions: [{ overrides: { memberIds: [] } }],
    })
    expect(result.current.preferences.activeFilters).toEqual([])
  })
})
