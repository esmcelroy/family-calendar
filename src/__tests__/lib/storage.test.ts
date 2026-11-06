import { afterEach, describe, expect, it, vi } from 'vitest'
import { localStorageAdapter, type StorageAdapter } from '@/lib/storage'

describe('LocalStorageAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a parsed value when the key is present', () => {
    const value = [{ id: 'event-1', title: 'Dinner' }]
    window.localStorage.setItem('events', JSON.stringify(value))

    expect(localStorageAdapter.get('events', [])).toEqual(value)
  })

  it('returns the default value when the key is absent', () => {
    const defaultValue: string[] = []

    expect(localStorageAdapter.get('missing', defaultValue)).toBe(defaultValue)
  })

  it('serializes values before writing them', () => {
    const value = { enabled: true }

    localStorageAdapter.set('config', value)

    expect(window.localStorage.getItem('config')).toBe(JSON.stringify(value))
  })

  it('returns the default and warns when stored JSON is malformed', () => {
    const defaultValue: string[] = []
    window.localStorage.setItem('events', '{invalid')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(localStorageAdapter.get('events', defaultValue)).toBe(defaultValue)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('returns the default and warns when storage reads are denied', () => {
    const defaultValue: string[] = []
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(localStorageAdapter.get('events', defaultValue)).toBe(defaultValue)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('does not throw when storage writes fail', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(() => localStorageAdapter.set('events', [])).not.toThrow()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('exposes an adapter satisfying the backend contract', () => {
    const adapter: StorageAdapter = localStorageAdapter

    expect(adapter).toBe(localStorageAdapter)
  })
})
