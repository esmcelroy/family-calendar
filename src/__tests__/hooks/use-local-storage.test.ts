import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { localStorageAdapter, type StorageAdapter } from '@/lib/storage'

describe('useLocalStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes state from the adapter', () => {
    window.localStorage.setItem('events', JSON.stringify(['existing']))

    const { result } = renderHook(() => useLocalStorage('events', [] as string[]))

    expect(result.current[0]).toEqual(['existing'])
  })

  it('updates state and storage when set directly', async () => {
    const { result } = renderHook(() => useLocalStorage('events', [] as string[]))

    act(() => result.current[1](['new']))

    expect(result.current[0]).toEqual(['new'])
    await waitFor(() => {
      expect(localStorageAdapter.get('events', [])).toEqual(['new'])
    })
  })

  it('supports functional state updates', async () => {
    window.localStorage.setItem('events', JSON.stringify(['first']))
    const { result } = renderHook(() => useLocalStorage('events', [] as string[]))

    act(() => result.current[1]((current) => [...current, 'second']))

    expect(result.current[0]).toEqual(['first', 'second'])
    await waitFor(() => {
      expect(localStorageAdapter.get('events', [])).toEqual(['first', 'second'])
    })
  })

  it('updates state when another tab changes the stored key', () => {
    const { result } = renderHook(() => useLocalStorage('events', [] as string[]))
    const updatedValue = ['from another tab']

    act(() => {
      window.localStorage.setItem('events', JSON.stringify(updatedValue))
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'events',
          newValue: JSON.stringify(updatedValue),
        }),
      )
    })

    expect(result.current[0]).toEqual(updatedValue)
  })

  it('uses the injected adapter instead of browser storage', async () => {
    const adapter: StorageAdapter = {
      get<T>(key: string, defaultValue: T): T {
        expect(key).toBe('events')
        return defaultValue
      },
      set<T>(key: string, value: T) {
        expect(key).toBe('events')
        expect(value).toEqual([])
      },
    }
    const get = vi.spyOn(adapter, 'get')
    const set = vi.spyOn(adapter, 'set')
    const setItem = vi.spyOn(window.localStorage, 'setItem')
    const { result } = renderHook(() => useLocalStorage('events', [], adapter))

    expect(result.current[0]).toEqual([])
    expect(get).toHaveBeenCalledWith('events', [])
    await waitFor(() => {
      expect(set).toHaveBeenCalledWith('events', [])
    })
    expect(setItem).not.toHaveBeenCalled()
  })
})
