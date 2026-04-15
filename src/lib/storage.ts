/**
 * StorageAdapter — backend-agnostic persistence interface.
 *
 * Contract:
 * - Implementations MUST be synchronous.
 * - Implementations MUST NOT throw — all errors must be absorbed internally
 *   (emit `console.warn`, return `defaultValue`).
 * - Implementations MUST NOT cache values internally; callers (e.g. React
 *   state) own the in-memory copy.
 *
 * Backend-swap pattern (spec 011):
 * The next planned implementor is `PostgresAdapter` (spec 011), which will
 * replace `LocalStorageAdapter` for server-side persistence. To swap backends,
 * instantiate the new adapter and pass it as the third argument to
 * `useLocalStorage` — no other code changes are required.
 */
export interface StorageAdapter {
  /**
   * Read a value from storage, deserialised as `T`.
   * Returns `defaultValue` when the key is absent or the stored value cannot
   * be deserialised.
   */
  get<T>(key: string, defaultValue: T): T

  /**
   * Serialise `value` and persist it under `key`.
   * Silently no-ops on any write error (quota exceeded, security error, etc.).
   */
  set<T>(key: string, value: T): void
}

// ---------------------------------------------------------------------------
// Key constants
// ---------------------------------------------------------------------------

/**
 * Namespaced storage keys used by this application.
 * Using `as const` makes the values a literal union, enabling `StorageKey`.
 */
export const STORAGE_KEYS = {
  events: 'family-calendar:events',
  members: 'family-calendar:members',
} as const

/** Union of all known storage key strings. */
export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

// ---------------------------------------------------------------------------
// LocalStorageAdapter
// ---------------------------------------------------------------------------

/**
 * `StorageAdapter` implementation backed by `window.localStorage`.
 *
 * - Guards against SSR / non-browser environments via `typeof window` checks.
 * - Absorbs all read/write errors — never throws.
 * - No internal cache; every `get` reads directly from `localStorage`.
 */
class LocalStorageAdapter implements StorageAdapter {
  get<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue

    const raw = window.localStorage.getItem(key)
    if (raw === null) return defaultValue

    try {
      return JSON.parse(raw) as T
    } catch {
      console.warn(`[storage] Failed to parse value for key "${key}". Using default.`)
      return defaultValue
    }
  }

  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (err) {
      console.warn(`[storage] Failed to write key "${key}":`, err)
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Shared `LocalStorageAdapter` instance.
 * Typed as the interface so callers are decoupled from the concrete class.
 */
export const localStorageAdapter: StorageAdapter = new LocalStorageAdapter()
