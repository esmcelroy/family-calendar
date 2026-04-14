# Research: Replace Spark KV with localStorage Backend

**Feature**: 003-local-storage-backend  
**Phase**: 0 — Research  
**Status**: Complete

---

## Research Question 1: `useKV` API Shape

**Decision**: Match `React.Dispatch<React.SetStateAction<T>>` exactly — not a simple `(value: T) => void` setter.

**Rationale**: `App.tsx` uses the functional updater pattern in 4 of 5 `setEvents`/`setMembers` call-sites:

```tsx
// App.tsx lines 52, 61, 77, 88, 92–95
setEvents((currentEvents) =>
  (currentEvents || []).map((e) => (e.id === editingEvent.id ? { ...eventData, id: editingEvent.id } : e))
)
setEvents((currentEvents) => [...(currentEvents || []), newEvent])
setEvents((currentEvents) => (currentEvents || []).filter((e) => e.id !== selectedEvent.id))
setMembers((currentMembers) => [...(currentMembers || []), newMember])
setMembers((currentMembers) => (currentMembers || []).filter((m) => m.id !== id))
```

The `useKV` hook from `@github/spark/hooks` returns `[T, Dispatch<SetStateAction<T>>]` — the same tuple type as React's `useState`. Anything narrower (e.g., `(value: T) => void`) would be a breaking change at these call-sites.

**Implementation consequence**: The `useLocalStorage` hook must use `useState` internally and derive its setter from `useState`'s setter — so functional updaters are handled by React's own reconciler, not by re-reading localStorage.

**Alternatives considered**:
- Simple `(value: T) => void` setter — rejected because it breaks functional updater call-sites.
- `useReducer` — rejected as over-engineering for this use case; `useState` handles functional updates natively.

---

## Research Question 2: StorageAdapter Generic Strategy

**Decision**: Method-level generics (`get<T>` / `set<T>`) rather than class-level generic (`class LocalStorageAdapter<T>`).

**Rationale**: A single adapter instance is shared across multiple key/type combinations (`CalendarEvent[]` and `FamilyMember[]` both use the same adapter). A class-level generic would force separate instances per type, doubling instantiation and making the singleton pattern impossible.

```typescript
// Method-level generics — one instance, multiple types:
const adapter = new LocalStorageAdapter()
const events = adapter.get<CalendarEvent[]>('family-calendar:events', [])
const members = adapter.get<FamilyMember[]>('family-calendar:members', [])
```

**Interface shape**:
```typescript
interface StorageAdapter {
  get<T>(key: string, defaultValue: T): T
  set<T>(key: string, value: T): void
}
```

**Alternatives considered**:
- Class-level `StorageAdapter<T>` — rejected; requires two instances for two types.
- Separate `getEvents`/`setEvents` methods — rejected; violates constitution Principle V (no speculative abstractions) and would require adapting the interface for every new entity.

---

## Research Question 3: Cross-Tab Synchronization

**Decision**: Implement a `window` `storage` event listener in `useLocalStorage`.

**Rationale**: The browser fires a `storage` event on all tabs *except* the one that wrote the value. Adding a listener in `useLocalStorage` gives correct multi-tab behavior at negligible cost — a `useEffect` with a single `addEventListener`. Without this, a user with two tabs open would see stale data in the second tab until a manual reload.

```typescript
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === key && e.newValue !== null) {
      try {
        setState(JSON.parse(e.newValue) as T)
      } catch {
        setState(defaultValue)
      }
    }
  }
  window.addEventListener('storage', handleStorageChange)
  return () => window.removeEventListener('storage', handleStorageChange)
}, [key])
```

**Alternatives considered**:
- No cross-tab sync — rejected; incorrect behavior in multi-tab sessions; the `storage` event is purpose-built for this and the implementation is trivial.
- BroadcastChannel API — considered for same-tab updates, but overkill; `useState` already handles same-tab reactivity.

---

## Research Question 4: Error Handling Strategy

**Decision**: Silent recovery with `console.warn` — never re-throw from adapter methods.

**Rationale**: Spec FR-008 requires the adapter to "catch `localStorage` exceptions and surface them without crashing the app." The two categories of error are:

1. **Read errors** (`SyntaxError` from malformed JSON): Return `defaultValue`. Log `console.warn` with key name and error message so developers can identify the issue in DevTools.
2. **Write errors** (`QuotaExceededError`, `SecurityError`): Log `console.warn`. Do not re-throw. The UI continues to function with in-memory state even if the write failed.

```typescript
// get — malformed JSON path
try {
  return JSON.parse(raw) as T
} catch {
  console.warn(`[storage] Failed to parse value for key "${key}". Using default.`)
  return defaultValue
}

// set — quota/access error path
try {
  window.localStorage.setItem(key, JSON.stringify(value))
} catch (err) {
  console.warn(`[storage] Failed to write key "${key}":`, err)
}
```

**Alternatives considered**:
- Throwing and catching at component level — rejected; would require every component to wrap setter calls in try/catch.
- Toasting an error to the user on write failure — rejected for this feature; silent recovery is sufficient for a local-only MVP. A user-visible warning can be added as a future enhancement.

---

## Research Question 5: SSR / `window` Availability Guard

**Decision**: Add a `typeof window === 'undefined'` guard at the top of `LocalStorageAdapter` methods.

**Rationale**: The spec assumes no SSR is in use (`window.localStorage` is always available at runtime). However, the Vite ecosystem makes it easy to accidentally run code in a Node.js context (e.g., during `vite build`'s server-side pre-rendering or in test environments that don't provide a DOM). A one-line guard costs nothing and prevents a cryptic `ReferenceError: window is not defined` if the assumption ever changes.

**Alternatives considered**:
- No guard — rejected; creates a hidden environmental assumption that breaks silently if SSR is added.
- Feature-detecting `localStorage` via try/catch — valid alternative but more verbose than `typeof window` for this case.

---

## Research Question 6: Key Naming

**Decision**: Use `family-calendar:events` and `family-calendar:members`.

**Rationale**: Colon-namespaced keys (`app-name:entity`) are the conventional localStorage naming pattern. They prevent collision when multiple apps share the same origin (e.g., two Vite dev servers running on different ports, or a multi-tenant deployment). The spec explicitly calls out these key names; the existing Spark KV keys (`family-events`, `family-members`) used a different namespace and cannot be migrated (per FR-010, fresh start is acceptable).

**Constant definition**:
```typescript
export const STORAGE_KEYS = {
  events: 'family-calendar:events',
  members: 'family-calendar:members',
} as const
```

Using `as const` makes the values narrowed string literals, enabling TypeScript to catch typos at call-sites.

---

## Research Question 7: `@github/spark` Package Removal Scope

**Decision**: Remove only the `useKV` import from `App.tsx`. Do not remove `@github/spark` from `package.json` in this feature.

**Rationale**: `grep -r '@github/spark' src/` shows only one import: `useKV` in `App.tsx`. However, the `@github/spark` package may be referenced in configuration files, Vite plugins, or runtime adapters outside `src/`. Removing the package itself is a separate concern (cleanup) that should happen after confirming zero usages across the entire project — outside the scope of this persistence feature.

**Alternatives considered**:
- Remove `@github/spark` from `package.json` immediately — deferred; the success criterion (SC-001) is met by removing the import from `src/`; full package removal is a cleanup task.

---

## Summary of All Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | `useKV` API shape | `[T, Dispatch<SetStateAction<T>>]`; functional updater required |
| 2 | StorageAdapter generics | Method-level `get<T>`/`set<T>`; one shared instance |
| 3 | Cross-tab sync | `window` `storage` event listener in hook |
| 4 | Error handling | Silent `console.warn`; return default; never re-throw |
| 5 | SSR guard | `typeof window === 'undefined'` check |
| 6 | Key naming | `family-calendar:events`, `family-calendar:members`; `as const` |
| 7 | Package removal | Remove `src/App.tsx` import only; package.json cleanup deferred |
