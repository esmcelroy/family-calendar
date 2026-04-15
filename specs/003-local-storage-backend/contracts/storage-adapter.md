# Contract: `StorageAdapter` Interface

**Feature**: 003-local-storage-backend  
**File**: `src/lib/storage.ts`  
**Consumer**: `useLocalStorage<T>` hook (`src/hooks/use-local-storage.ts`)  
**Implementors**: `LocalStorageAdapter` (this feature); `PostgresAdapter` (spec 011)

---

## Purpose

`StorageAdapter` is the **backend-swap contract** for all persistence in the Family Calendar app. Any component or hook that reads or writes persisted data does so through this interface — never through raw `localStorage`, `fetch`, or any other store-specific API.

By coding against this interface, component code is decoupled from the underlying store. Swapping from `localStorage` to PostgreSQL (spec 011) requires:
1. A new class implementing `StorageAdapter`.
2. Injecting that instance into `useLocalStorage` (or its replacement).
3. No changes to any component file.

---

## TypeScript Definition

```typescript
/**
 * StorageAdapter
 *
 * The canonical contract for all key-value persistence in the Family Calendar app.
 * Implementations must be synchronous for compatibility with `useLocalStorage`.
 *
 * Future async backends (e.g., PostgreSQL via fetch) will require a separate
 * `AsyncStorageAdapter` interface and a corresponding `useAsyncStorage` hook.
 * This interface covers the local-first, synchronous baseline (spec 003).
 */
export interface StorageAdapter {
  /**
   * Retrieve the value stored under `key`, deserializing from the underlying format.
   *
   * @param key           - The storage key; prefer values from `STORAGE_KEYS`.
   * @param defaultValue  - Returned when the key is absent or its stored value
   *                        cannot be deserialized.
   * @returns             - The stored value, or `defaultValue` on any failure.
   */
  get<T>(key: string, defaultValue: T): T

  /**
   * Persist `value` under `key`, serializing to the underlying format.
   *
   * Must never throw. Implementations must catch and log all errors internally
   * (quota exceeded, access denied, serialization failures) and silently no-op.
   *
   * @param key   - The storage key; prefer values from `STORAGE_KEYS`.
   * @param value - The value to persist.
   */
  set<T>(key: string, value: T): void
}
```

---

## Contract Rules

### Rule 1 — `get` must never throw

If the key is absent, return `defaultValue`.  
If the stored value cannot be deserialized (malformed JSON, type mismatch), return `defaultValue` and emit a `console.warn`.  
Under no circumstances should `get` propagate an exception to the caller.

### Rule 2 — `set` must never throw

If the write fails (quota exceeded, storage access denied, serialization error), log a `console.warn` and perform a silent no-op.  
The caller (the React hook's `useEffect`) must not be required to wrap setter calls in try/catch.

### Rule 3 — Synchronous only (this version)

Both `get` and `set` are synchronous. This is required for `useLocalStorage`'s `useState`-based initialization pattern (React does not await synchronous state initializers).

Future async backends (spec 011) will require a new `AsyncStorageAdapter` interface and a new `useAsyncStorage` hook. They do not extend this interface.

### Rule 4 — No state in the adapter

Adapters must not cache values internally. Every `get` reads the underlying store; every `set` writes it. React state (in `useLocalStorage`) is the cache.

### Rule 5 — Keys are opaque strings

The adapter does not interpret, validate, or namespace keys. Key namespacing is the caller's responsibility (via `STORAGE_KEYS`).

---

## Implementing a New Adapter

Minimum viable implementation skeleton:

```typescript
import type { StorageAdapter } from './storage'

export class MyCustomAdapter implements StorageAdapter {
  get<T>(key: string, defaultValue: T): T {
    try {
      const raw = this.readFromStore(key)
      if (raw === null || raw === undefined) return defaultValue
      return JSON.parse(raw) as T
    } catch {
      console.warn(`[MyCustomAdapter] Failed to read key "${key}". Using default.`)
      return defaultValue
    }
  }

  set<T>(key: string, value: T): void {
    try {
      this.writeToStore(key, JSON.stringify(value))
    } catch (err) {
      console.warn(`[MyCustomAdapter] Failed to write key "${key}":`, err)
    }
  }

  private readFromStore(key: string): string | null {
    // TODO: implement
    return null
  }

  private writeToStore(key: string, serialized: string): void {
    // TODO: implement
  }
}
```

---

## `LocalStorageAdapter` (reference implementation)

```typescript
export class LocalStorageAdapter implements StorageAdapter {
  get<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) return defaultValue
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

export const localStorageAdapter: StorageAdapter = new LocalStorageAdapter()
```

---

## Compatibility Matrix

| Backend | Interface version | Sync/Async | Spec |
|---------|-------------------|-----------|------|
| `LocalStorageAdapter` | `StorageAdapter` (this doc) | Sync | 003 |
| `PostgresAdapter` (planned) | `AsyncStorageAdapter` (TBD) | Async | 011 |

> `AsyncStorageAdapter` will be a separate interface defined in spec 011. It does not extend `StorageAdapter`. The `useLocalStorage` hook will not be modified; a new `useRemoteStorage` or equivalent hook will wrap async adapters.
