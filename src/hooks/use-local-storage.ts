import { useState, useEffect } from 'react'
import { type StorageAdapter, localStorageAdapter } from '@/lib/storage'

/**
 * `useLocalStorage<T>` — React hook for persisted state backed by a
 * `StorageAdapter` (defaults to `localStorageAdapter`).
 *
 * ### Functional updater compatibility
 * The setter is the raw `React.Dispatch<React.SetStateAction<T>>` returned by
 * `useState`, so callers can use functional updaters:
 * ```ts
 * setEvents(prev => prev.filter(e => e.id !== id))
 * ```
 * React's reconciler handles the current-state snapshot — there is no
 * re-read from `localStorage` inside the updater, eliminating stale-data risk.
 *
 * ### Cross-tab sync
 * A `storage` event listener keeps all browser tabs in sync. When another tab
 * writes to the same key, this hook updates its React state to reflect the
 * new value.
 *
 * ### Backend injection
 * Pass a custom `StorageAdapter` as the third argument to override the
 * default `localStorageAdapter`. This is the injection point used by tests
 * and by future backends (see spec 011 `PostgresAdapter`).
 *
 * @param key - Storage key (use `STORAGE_KEYS` constants).
 * @param defaultValue - Value returned when the key is absent or unreadable.
 * @param adapter - Optional `StorageAdapter` override (default: `localStorageAdapter`).
 * @returns `[value, setValue]` — identical API to `useState`.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  adapter: StorageAdapter = localStorageAdapter,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Initialise React state from storage on first render.
  const [value, setValue] = useState<T>(() => adapter.get(key, defaultValue))

  // Sync React state → storage whenever value changes.
  useEffect(() => {
    adapter.set(key, value)
  }, [key, value, adapter])

  // Cross-tab sync: listen for storage events from other tabs/windows.
  // Note: StorageEvent only fires for window.localStorage changes, so this
  // is inherently localStorage-specific and is intentionally a no-op for
  // alternative adapter implementations (e.g. PostgresAdapter in spec 011).
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== key) return
      // Re-read via the adapter for consistent parsing and error handling.
      setValue(adapter.get(key, defaultValue))
    }

    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [key, defaultValue, adapter])

  return [value, setValue]
}
