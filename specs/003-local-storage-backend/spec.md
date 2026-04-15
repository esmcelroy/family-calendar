# Feature Specification: Replace Spark KV with localStorage Backend

**Feature Branch**: `003-local-storage-backend`  
**Created**: 2026-04-13  
**Status**: Clarified  
**Input**: Replace GitHub Spark useKV hook with typed localStorage persistence layer

## User Scenarios & Testing *(mandatory)*

### User Story 1 - App Works Without GitHub Spark Dependency (Priority: P1)

A developer (or future contributor) clones and runs the app in any environment without needing the `@github/spark` package. Events and family members persist across page reloads using the browser's built-in storage.

**Why this priority**: Removing the hard platform dependency is the primary goal. Without this, the app is locked to GitHub Spark's hosting environment.

**Independent Test**: Remove or uninstall `@github/spark`. Run the app. Add an event. Reload the page. Confirm the event is still present.

**Acceptance Scenarios**:

1. **Given** the app is running without `@github/spark` installed, **When** the app loads, **Then** it starts without errors and displays the calendar.
2. **Given** a user has added events and family members, **When** the page is reloaded, **Then** all previously saved data is restored exactly.
3. **Given** the app is opened in a fresh browser session with no prior data, **When** it loads, **Then** it starts with sensible defaults (empty events list, empty members list) rather than crashing.

---

### User Story 2 - Corrupted or Missing Storage is Handled Gracefully (Priority: P2)

A user whose localStorage has been cleared or contains malformed data is not shown a broken app — instead, they get a fresh, clean state.

**Why this priority**: Storage can be cleared at any time by the browser or user. The app must not crash when this happens.

**Independent Test**: Manually corrupt the localStorage entries in DevTools. Reload the app. Confirm it recovers to empty defaults without throwing an error.

**Acceptance Scenarios**:

1. **Given** localStorage contains malformed JSON for events or members, **When** the app loads, **Then** it resets to empty defaults and continues without crashing.
2. **Given** localStorage is completely empty, **When** the app loads, **Then** it displays the empty state prompts normally.

---

### User Story 3 - Storage Access is Centralized, Type-Safe, and Backend-Swappable (Priority: P3)

A developer reading or writing persisted data always does so through a single, typed utility — never with raw `JSON.parse` or `localStorage.setItem` scattered across components. The storage layer is designed around a `StorageAdapter` interface so a future backend (e.g., PostgreSQL for spec 011) can be swapped in by providing a new adapter — without changing any component code.

**Why this priority**: Constitution Principle IV (v1.1.0) explicitly requires the abstraction to support backend swapping. Without this design, spec 011 (self-hosted PostgreSQL) would require revisiting every file that touches storage.

**Independent Test**: Search the codebase for direct `localStorage` calls outside the storage adapter — none should exist. Confirm the `StorageAdapter` interface is exported from `src/lib/` and could be implemented by a different backend.

**Acceptance Scenarios**:

1. **Given** the `StorageAdapter` interface exists, **When** a developer wants to add a new backend, **Then** they only need to implement the interface in a new file in `src/lib/` — no component changes required.
2. **Given** the storage utility is the sole interface for reads and writes, **When** a component updates events, **Then** it calls the utility function, not `localStorage` directly.
3. **Given** the storage utility functions, **When** TypeScript compiles the project, **Then** there are no type errors in any persistence-related code.

---

### Edge Cases

- What happens when the browser has storage disabled (private/incognito mode or storage quota exceeded)? The app must catch the storage error and display a non-fatal warning rather than crashing.
- What happens when the serialized data exceeds the browser's storage quota (typically ~5 MB)? The write operation fails gracefully; the user sees a warning that data could not be saved.
- What happens when the app runs in a context where `window.localStorage` is unavailable (e.g., server-side rendering)? Guard with a runtime check; treat as empty storage.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `@github/spark` package dependency MUST be removed from all application persistence paths.
- **FR-002**: A `StorageAdapter` interface MUST be defined in `src/lib/` with generic `get<T>` and `set<T>` methods, enabling backend swapping without component changes.
- **FR-003**: A `LocalStorageAdapter` MUST implement `StorageAdapter` and serve as the default adapter for the app.
- **FR-004**: A `useLocalStorage<T>` custom hook MUST be created in `src/hooks/` as a reactive drop-in replacement for `useKV`, wrapping the `StorageAdapter` and triggering React re-renders when values change.
- **FR-005**: All calls to `useKV` in `App.tsx` MUST be replaced with `useLocalStorage<T>` using the same key names and default values.
- **FR-006**: The storage adapter MUST serialize and deserialize data through a single code path — no raw `JSON.parse`/`JSON.stringify` spread across components.
- **FR-007**: The adapter MUST return typed defaults when a key is missing or its value cannot be parsed.
- **FR-008**: The adapter MUST catch `localStorage` exceptions (quota exceeded, access denied) and surface them without crashing the app.
- **FR-009**: All existing functionality (event creation, editing, deletion, family member management) MUST continue to work identically after the migration.
- **FR-010**: No migration of Spark KV data to localStorage is required — fresh start is acceptable.

### Key Entities

- **`StorageAdapter<T>` interface**: Defines `get(key: string, defaultValue: T): T` and `set(key: string, value: T): void`. The canonical contract that enables backend swapping.
- **`LocalStorageAdapter`**: The concrete implementation of `StorageAdapter` backed by `window.localStorage`. Lives in `src/lib/storage.ts`.
- **`useLocalStorage<T>` hook**: A React hook that wraps `StorageAdapter` with React state, providing reactive reads and writes. Lives in `src/hooks/use-local-storage.ts`.
- **Storage Key**: A namespaced string identifier for each persisted data collection (e.g., `family-calendar:events`, `family-calendar:members`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The app builds and runs successfully with `@github/spark` uninstalled or removed from `package.json` dependencies.
- **SC-002**: All existing features (calendar navigation, event CRUD, family member management, event filtering) work identically after the migration — verified by manual smoke test.
- **SC-003**: Zero direct `localStorage` calls exist outside the `LocalStorageAdapter` implementation (verifiable by grep/search).
- **SC-004**: No TypeScript errors introduced by the migration (verified by `tsc --noEmit`).
- **SC-005**: Data persists correctly across at least 3 consecutive page reloads in a standard browser session.
- **SC-006**: The `StorageAdapter` interface and `LocalStorageAdapter` are exported from `src/lib/` and documented for use by future adapter implementations.

## Assumptions

- The `@github/spark` `useKV` hook is the only Spark API currently used in the app for persistence; no other Spark hooks are being retained.
- The browser `localStorage` 5 MB quota is sufficient for typical family calendar usage (hundreds of events and a small number of members).
- No server-side rendering is in use; `window.localStorage` is always available at runtime.
- No migration of existing Spark KV user data to localStorage is required; fresh start is acceptable for self-hosted deployments.
- Namespacing storage keys with a `family-calendar:` prefix prevents collisions with other apps sharing the same origin's localStorage.
- The `useLocalStorage<T>` hook is a behavioral drop-in for `useKV`; component API call-sites (`[events, setEvents]` destructuring pattern) remain unchanged.

