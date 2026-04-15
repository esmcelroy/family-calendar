# Quickstart: localStorage Persistence Layer

**Feature**: 003-local-storage-backend  
**Audience**: Contributors implementing this feature or implementing a future storage backend (spec 011)

---

## What Was Built

This feature replaces `useKV` from `@github/spark/hooks` with a purpose-built, backend-swappable persistence layer:

- **`src/lib/storage.ts`** — `StorageAdapter` interface + `LocalStorageAdapter` implementation + `STORAGE_KEYS` constants
- **`src/hooks/use-local-storage.ts`** — `useLocalStorage<T>` hook, a drop-in for `useKV`

---

## Using `useLocalStorage` in a Component

```tsx
import { useLocalStorage } from '@/hooks/use-local-storage'
import { STORAGE_KEYS } from '@/lib/storage'
import type { CalendarEvent } from '@/lib/types'

function MyComponent() {
  // Same destructuring API as useState / useKV
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>(STORAGE_KEYS.events, [])

  // Direct value update
  const clearEvents = () => setEvents([])

  // Functional updater (supported — identical to useState)
  const addEvent = (event: CalendarEvent) =>
    setEvents(prev => [...prev, event])

  return <div>{events.length} events</div>
}
```

**Key rules**:
- Always use a key from `STORAGE_KEYS`. Never pass a raw string literal.
- The `defaultValue` is returned when the key is absent or unreadable — always pass a safe empty value (`[]`, `{}`).
- No error handling needed in the component; the adapter handles all storage exceptions internally.

---

## Adding a New Persisted Key

1. Add the key string to `STORAGE_KEYS` in `src/lib/storage.ts`:

```typescript
export const STORAGE_KEYS = {
  events: 'family-calendar:events',
  members: 'family-calendar:members',
  settings: 'family-calendar:settings', // ← new
} as const
```

2. Use it in your component:

```tsx
const [settings, setSettings] = useLocalStorage<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
```

That's it. No changes to the adapter or hook are needed.

---

## Implementing a New Storage Backend (spec 011)

To swap `localStorage` for PostgreSQL (or any other store):

1. Create a new file, e.g., `src/lib/postgres-adapter.ts`:

```typescript
import type { StorageAdapter } from './storage'

export class PostgresAdapter implements StorageAdapter {
  get<T>(key: string, defaultValue: T): T {
    // fetch from API / IndexedDB / etc.
    // ...
    return defaultValue
  }

  set<T>(key: string, value: T): void {
    // persist to API / etc.
    // ...
  }
}
```

2. Inject the new adapter into `useLocalStorage` at the `App.tsx` level (or via React context):

```tsx
import { PostgresAdapter } from '@/lib/postgres-adapter'
const pgAdapter = new PostgresAdapter()

// Pass as third argument:
const [events, setEvents] = useLocalStorage<CalendarEvent[]>(STORAGE_KEYS.events, [], pgAdapter)
```

**No changes to `App.tsx` setter call-sites, `CalendarGrid`, `EventDialog`, or any other component are required.** The `StorageAdapter` interface is the only contract.

> **Note**: If the new adapter is async (e.g., fetches from an API), `useLocalStorage` will need to be extended to handle `Promise<T>`. That extension is out of scope for this feature and will be addressed in spec 011.

---

## Inspecting Stored Data

Open browser DevTools → Application → Local Storage → `http://localhost:5173` (or your origin).

| Key | Contents |
|-----|----------|
| `family-calendar:events` | JSON array of `CalendarEvent` objects |
| `family-calendar:members` | JSON array of `FamilyMember` objects |

To simulate a corrupted entry for testing:
```javascript
// DevTools Console
localStorage.setItem('family-calendar:events', 'not valid json{{{')
// Reload the page — app should reset events to [] without crashing
```

---

## Running the Tests

> Tests require Vitest to be configured (spec 006). Once set up:

```bash
# All storage tests
npx vitest run src/__tests__/lib/storage.test.ts

# Hook tests
npx vitest run src/__tests__/hooks/use-local-storage.test.ts

# TypeScript check
npx tsc --noEmit
```

---

## Verifying the Migration (SC-001 through SC-006)

```bash
# SC-001 / SC-003: Confirm no Spark imports or raw localStorage calls in src/
grep -r '@github/spark' src/          # should return nothing
grep -rn 'localStorage\.' src/ --include='*.ts' --include='*.tsx'
# ↑ should return ONLY: src/lib/storage.ts

# SC-004: TypeScript clean
npx tsc --noEmit

# SC-002, SC-005: Manual smoke test
# 1. Open app in browser
# 2. Add an event and a family member
# 3. Reload the page 3 times — data should persist each time
# 4. Corrupt localStorage in DevTools → reload → app shows empty state, no crash
```
