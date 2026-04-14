# Data Model: Replace Spark KV with localStorage Backend

**Feature**: 003-local-storage-backend  
**Phase**: 1 — Design  
**Status**: Complete

---

## Overview

This feature introduces no new domain entities. The existing `CalendarEvent` and `FamilyMember` types in `src/lib/types.ts` are unchanged. The new entities are **infrastructure types** — the storage adapter interface, its concrete implementation, and the key constants — all living in `src/lib/storage.ts`.

---

## New Entities

### `StorageAdapter` (interface)

**File**: `src/lib/storage.ts`  
**Purpose**: The canonical contract for all persistence operations. Enables backend swapping (e.g., `LocalStorageAdapter` → `PostgresAdapter` in spec 011) without touching any component or hook.

```typescript
export interface StorageAdapter {
  /**
   * Retrieve a value from the store, deserializing from JSON.
   * Returns `defaultValue` if the key is absent or its value cannot be parsed.
   */
  get<T>(key: string, defaultValue: T): T

  /**
   * Persist a value to the store, serializing to JSON.
   * Silently no-ops (with console.warn) on quota or access errors.
   */
  set<T>(key: string, value: T): void
}
```

**Fields**: None (interface only)  
**Validation rules**: None enforced at the interface level; implementations are responsible for type-safe deserialization.  
**Backend-swap contract**: Any spec 011 `PostgresAdapter` (or equivalent) must implement this interface. Component code and `useLocalStorage` are not modified when swapping backends.

---

### `LocalStorageAdapter` (class)

**File**: `src/lib/storage.ts`  
**Implements**: `StorageAdapter`  
**Purpose**: Browser-native `window.localStorage` persistence with JSON serialization, error recovery, and SSR safety.

```typescript
export class LocalStorageAdapter implements StorageAdapter {
  get<T>(key: string, defaultValue: T): T
  set<T>(key: string, value: T): void
}
```

**Behavior contract**:

| Scenario | `get` behavior | `set` behavior |
|----------|---------------|----------------|
| Key exists, valid JSON | Parse and return typed value | N/A |
| Key absent | Return `defaultValue` | N/A |
| Key exists, malformed JSON | `console.warn`; return `defaultValue` | N/A |
| Normal write | N/A | Serialize and write |
| `QuotaExceededError` on write | N/A | `console.warn`; silent no-op |
| `SecurityError` (storage denied) | N/A | `console.warn`; silent no-op |
| `window` unavailable (SSR) | Return `defaultValue` | Silent no-op |

**No state is held by the class itself.** All reads/writes delegate directly to `window.localStorage`.

---

### `localStorageAdapter` (singleton)

**File**: `src/lib/storage.ts`  
**Type**: `LocalStorageAdapter`  
**Purpose**: Module-level singleton exported for use as the default adapter in `useLocalStorage` and in tests.

```typescript
export const localStorageAdapter: StorageAdapter = new LocalStorageAdapter()
```

Using the `StorageAdapter` interface type (not the concrete class type) enforces that consumers code against the interface.

---

### `STORAGE_KEYS` (constant)

**File**: `src/lib/storage.ts`  
**Purpose**: Single source of truth for all localStorage key strings. Prevents typos and makes key names greppable.

```typescript
export const STORAGE_KEYS = {
  events: 'family-calendar:events',
  members: 'family-calendar:members',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
```

**Values**:

| Key name | Storage key string | Stored type |
|----------|--------------------|-------------|
| `STORAGE_KEYS.events` | `family-calendar:events` | `CalendarEvent[]` |
| `STORAGE_KEYS.members` | `family-calendar:members` | `FamilyMember[]` |

**Naming convention**: `{app-name}:{entity}` — colon-namespaced to prevent collision with other apps at the same origin.

---

### `useLocalStorage<T>` (custom hook)

**File**: `src/hooks/use-local-storage.ts`  
**Purpose**: Reactive wrapper around `StorageAdapter` that integrates with React's rendering cycle. Drop-in replacement for `useKV`.

```typescript
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  adapter?: StorageAdapter
): [T, React.Dispatch<React.SetStateAction<T>>]
```

**Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `key` | `string` | — | Storage key; use a value from `STORAGE_KEYS` |
| `defaultValue` | `T` | — | Value returned when key is absent or unreadable |
| `adapter` | `StorageAdapter` (optional) | `localStorageAdapter` | Adapter to use; override in tests |

**Return value**: `[T, React.Dispatch<React.SetStateAction<T>>]`

This is structurally identical to `useState`'s return type, which means:
- The `[value, setter]` destructuring pattern in `App.tsx` is unchanged.
- `setter` accepts both direct values (`setEvents(newArray)`) and functional updaters (`setEvents(prev => [...prev, item])`).

**Internal behavior**:
1. On mount: reads `adapter.get(key, defaultValue)` → initializes `useState`.
2. On setter call: updates React state first (via `useState` setter); writes to adapter as a side effect.
3. Cross-tab sync: `useEffect` registers a `storage` event listener that re-reads from the adapter when another tab writes the same key.
4. Cleanup: removes the event listener on unmount.

**Functional updater flow**:
```
setEvents(prev => [...prev, newEvent])
  → React calls the updater with current state
  → Hook receives the result in a useEffect
  → Calls adapter.set(key, newValue)
```

---

## Unchanged Domain Types (reference)

These types from `src/lib/types.ts` are unmodified by this feature.

```typescript
// src/lib/types.ts (existing — no changes)
export interface FamilyMember {
  id: string
  name: string
  color: string
}

export interface CalendarEvent {
  id: string
  title: string
  date: string          // ISO date string: "YYYY-MM-DD"
  startTime?: string    // "HH:MM" (24h)
  endTime?: string      // "HH:MM" (24h)
  description?: string
  memberIds: string[]   // references FamilyMember.id
}
```

**Serialization**: Both types serialize cleanly to JSON. `Date` fields are stored as ISO strings (already the case). No custom serializers needed.

---

## App.tsx Migration Delta

**Before**:
```tsx
import { useKV } from '@github/spark/hooks'
// ...
const [events, setEvents] = useKV<CalendarEvent[]>('family-events', [])
const [members, setMembers] = useKV<FamilyMember[]>('family-members', [])
```

**After**:
```tsx
import { useLocalStorage } from '@/hooks/use-local-storage'
import { STORAGE_KEYS } from '@/lib/storage'
// ...
const [events, setEvents] = useLocalStorage<CalendarEvent[]>(STORAGE_KEYS.events, [])
const [members, setMembers] = useLocalStorage<FamilyMember[]>(STORAGE_KEYS.members, [])
```

All other `setEvents`/`setMembers` call-sites (functional updater pattern) are **unchanged**.

---

## File Export Map

```typescript
// src/lib/storage.ts — all exports
export interface StorageAdapter { ... }
export class LocalStorageAdapter implements StorageAdapter { ... }
export const localStorageAdapter: StorageAdapter
export const STORAGE_KEYS: { events: 'family-calendar:events'; members: 'family-calendar:members' }
export type StorageKey

// src/hooks/use-local-storage.ts — all exports
export function useLocalStorage<T>(key, defaultValue, adapter?): [T, Dispatch<SetStateAction<T>>]
```
