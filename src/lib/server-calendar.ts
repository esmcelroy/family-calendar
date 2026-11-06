import { useCallback, useEffect, useState } from 'react'
import type { CalendarEvent, FamilyMember } from './types'
import { serverApi } from './server-api'

export interface CalendarSubscription {
  id: string
  displayName: string
  sourceUrl: string
  color?: string | null
  enabled: boolean
  lastFetchedAt: string | null
  lastFetchError: string | null
}

export interface UserPreferences {
  activeView?: string
  activeFilters: string[]
}

interface EventsResponse { events: CalendarEvent[] }
interface MembersResponse { members: FamilyMember[] }
interface SubscriptionsResponse { subscriptions: CalendarSubscription[] }

export interface ServerCalendarState {
  events: CalendarEvent[]
  members: FamilyMember[]
  subscriptions: CalendarSubscription[]
  preferences: UserPreferences
  loading: boolean
  pendingMutation: boolean
  error: string | null
  reload: () => Promise<void>
  createEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent>
  updateEvent: (event: CalendarEvent) => Promise<CalendarEvent>
  deleteEvent: (eventId: string) => Promise<void>
  addMember: (member: Omit<FamilyMember, 'id'>) => Promise<FamilyMember>
  updateMember: (memberId: string, updates: Partial<Omit<FamilyMember, 'id'>>) => Promise<FamilyMember>
  deleteMember: (memberId: string) => Promise<void>
  createSubscription: (subscription: Omit<CalendarSubscription, 'id' | 'lastFetchedAt' | 'lastFetchError'>) => Promise<CalendarSubscription>
  updateSubscription: (subscription: CalendarSubscription) => Promise<CalendarSubscription>
  deleteSubscription: (subscriptionId: string) => Promise<void>
  updatePreferences: (preferences: UserPreferences) => Promise<UserPreferences>
}

const EMPTY_PREFERENCES: UserPreferences = { activeFilters: [] }

export function useServerCalendar(): ServerCalendarState {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [subscriptions, setSubscriptions] = useState<CalendarSubscription[]>([])
  const [preferences, setPreferences] = useState<UserPreferences>(EMPTY_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [pendingMutation, setPendingMutation] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [eventResult, memberResult, subscriptionResult, preferenceResult] = await Promise.all([
        serverApi.request<EventsResponse>('/api/calendar/events'),
        serverApi.request<MembersResponse>('/api/calendar/members'),
        serverApi.request<SubscriptionsResponse>('/api/calendar/subscriptions'),
        serverApi.request<UserPreferences>('/api/me/preferences'),
      ])
      setEvents(eventResult.events)
      setMembers(memberResult.members)
      setSubscriptions(subscriptionResult.subscriptions)
      setPreferences({ ...EMPTY_PREFERENCES, ...preferenceResult })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load shared calendar data.')
      throw cause
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload().catch(() => undefined)
  }, [reload])

  const mutate = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    setPendingMutation(true)
    setError(null)
    try {
      return await operation()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The server did not save your change.')
      throw cause
    } finally {
      setPendingMutation(false)
    }
  }, [])

  const createEvent = useCallback((event: Omit<CalendarEvent, 'id'>) => mutate(async () => {
    const saved = await serverApi.request<CalendarEvent>('/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify(event),
    })
    setEvents((current) => [...current, saved])
    return saved
  }), [mutate])

  const updateEvent = useCallback((event: CalendarEvent) => mutate(async () => {
    const { id, ...body } = event
    const saved = await serverApi.request<CalendarEvent>(`/api/calendar/events/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    setEvents((current) => current.map((item) => item.id === id ? saved : item))
    return saved
  }), [mutate])

  const deleteEvent = useCallback((eventId: string) => mutate(async () => {
    await serverApi.request<void>(`/api/calendar/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
    setEvents((current) => current.filter((event) => event.id !== eventId))
  }), [mutate])

  const addMember = useCallback((member: Omit<FamilyMember, 'id'>) => mutate(async () => {
    const saved = await serverApi.request<FamilyMember>('/api/calendar/members', {
      method: 'POST',
      body: JSON.stringify(member),
    })
    setMembers((current) => [...current, saved])
    return saved
  }), [mutate])

  const updateMember = useCallback((memberId: string, updates: Partial<Omit<FamilyMember, 'id'>>) => mutate(async () => {
    const current = members.find((member) => member.id === memberId)
    if (!current) throw new Error('Family member no longer exists.')
    const saved = await serverApi.request<FamilyMember>(`/api/calendar/members/${encodeURIComponent(memberId)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...current, ...updates }),
    })
    setMembers((items) => items.map((member) => member.id === memberId ? saved : member))
    return saved
  }), [members, mutate])

  const deleteMember = useCallback((memberId: string) => mutate(async () => {
    await serverApi.request<void>(`/api/calendar/members/${encodeURIComponent(memberId)}`, { method: 'DELETE' })
    setMembers((current) => current.filter((member) => member.id !== memberId))
    setEvents((current) => current.map((event) => ({
      ...event,
      memberIds: event.memberIds.filter((id) => id !== memberId),
      seriesExceptions: event.seriesExceptions?.map((exception) => ({
        ...exception,
        ...(exception.type === 'modified' && exception.overrides?.memberIds
          ? {
            overrides: {
              ...exception.overrides,
              memberIds: exception.overrides.memberIds.filter((id) => id !== memberId),
            },
          }
          : {}),
      })),
    })))
    setPreferences((current) => ({
      ...current,
      activeFilters: current.activeFilters.filter((id) => id !== memberId),
    }))
  }), [mutate])

  const createSubscription = useCallback((
    subscription: Omit<CalendarSubscription, 'id' | 'lastFetchedAt' | 'lastFetchError'>,
  ) => mutate(async () => {
    const saved = await serverApi.request<CalendarSubscription>('/api/calendar/subscriptions', {
      method: 'POST',
      body: JSON.stringify(subscription),
    })
    setSubscriptions((current) => [...current, saved])
    return saved
  }), [mutate])

  const updateSubscription = useCallback((subscription: CalendarSubscription) => mutate(async () => {
    const { id, ...body } = subscription
    const saved = await serverApi.request<CalendarSubscription>(
      `/api/calendar/subscriptions/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(body) },
    )
    setSubscriptions((current) => current.map((item) => item.id === id ? saved : item))
    return saved
  }), [mutate])

  const deleteSubscription = useCallback((subscriptionId: string) => mutate(async () => {
    await serverApi.request<void>(
      `/api/calendar/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: 'DELETE' },
    )
    setSubscriptions((current) => current.filter((item) => item.id !== subscriptionId))
  }), [mutate])

  const updatePreferences = useCallback((next: UserPreferences) => mutate(async () => {
    const saved = await serverApi.request<UserPreferences>('/api/me/preferences', {
      method: 'PUT',
      body: JSON.stringify(next),
    })
    setPreferences({ ...EMPTY_PREFERENCES, ...saved })
    return saved
  }), [mutate])

  return {
    events,
    members,
    subscriptions,
    preferences,
    loading,
    pendingMutation,
    error,
    reload,
    createEvent,
    updateEvent,
    deleteEvent,
    addMember,
    updateMember,
    deleteMember,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    updatePreferences,
  }
}
