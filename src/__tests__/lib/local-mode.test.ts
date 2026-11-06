import { beforeEach, describe, expect, it } from 'vitest'
import { localStorageAdapter, STORAGE_KEYS } from '@/lib/storage'
import type { CalendarEvent, FamilyMember } from '@/lib/types'

describe('zero-configuration local mode persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists shared events and family members in browser localStorage', () => {
    const events: CalendarEvent[] = [
      { id: 'event-1', title: 'Family dinner', date: '2026-11-06', memberIds: ['member-1'] },
    ]
    const members: FamilyMember[] = [
      { id: 'member-1', name: 'Alex', color: 'blue' },
    ]

    localStorageAdapter.set(STORAGE_KEYS.events, events)
    localStorageAdapter.set(STORAGE_KEYS.members, members)

    expect(localStorageAdapter.get(STORAGE_KEYS.events, [])).toEqual(events)
    expect(localStorageAdapter.get(STORAGE_KEYS.members, [])).toEqual(members)
    expect(window.localStorage.length).toBe(2)
  })

  it('starts with empty local data without requiring backend configuration', () => {
    expect(localStorageAdapter.get(STORAGE_KEYS.events, [])).toEqual([])
    expect(localStorageAdapter.get(STORAGE_KEYS.members, [])).toEqual([])
  })
})
