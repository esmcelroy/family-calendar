# Tasks: Replace GitHub Spark KV with localStorage Backend

**Feature**: 003-local-storage-backend  
**Spec**: [specs/003-local-storage-backend/spec.md](./spec.md)  
**Plan**: [specs/003-local-storage-backend/plan.md](./plan.md)  
**Branch**: `003-local-storage-backend`

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task in the same phase)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in every task description

## Key Constraints (read before starting)

- `useLocalStorage<T>` setter **MUST** be `React.Dispatch<React.SetStateAction<T>>` — `App.tsx` uses functional updaters (`setEvents(prev => ...)`) at **5 call-sites**. A narrower `(v: T) => void` setter breaks them.
- `StorageAdapter` uses **method-level** generics (`get<T>` / `set<T>`) — one shared instance serves both `CalendarEvent[]` and `FamilyMember[]`.
- Cross-tab sync via `window` `storage` event is part of the hook contract (not optional).
- `@github/spark` package **stays in `package.json`** — only the `useKV` import in `src/App.tsx` is removed.
- Key names change: `'family-events'` → `STORAGE_KEYS.events` (`'family-calendar:events'`), `'family-members'` → `STORAGE_KEYS.members` (`'family-calendar:members'`). No data migration required (FR-010).
- **Test tasks are stubs only** — all depend on Vitest setup from spec 006. Create file structure and test bodies now; they become runnable after spec 006 completes.

---

## Phase 1: Setup

**Purpose**: Feature branch preparation — no production code yet.

- [X] T001 Create and check out feature branch `003-local-storage-backend` from `main`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type definitions and key constants that every subsequent task builds on. Nothing in Phase 3+ can be implemented until the `StorageAdapter` contract and `STORAGE_KEYS` exist.

**⚠️ CRITICAL**: Both tasks write to `src/lib/storage.ts` — complete them sequentially before moving on.

- [X] T002 Define and export `StorageAdapter` interface with `get<T>(key: string, defaultValue: T): T` and `set<T>(key: string, value: T): void` including JSDoc contract notes (never throw, synchronous only, no internal caching) in `src/lib/storage.ts`
- [X] T003 Define and export `STORAGE_KEYS` constant (`{ events: 'family-calendar:events', members: 'family-calendar:members' } as const`) and `StorageKey` union type (`(typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]`) in `src/lib/storage.ts`

**Checkpoint**: `StorageAdapter` interface and `STORAGE_KEYS` committed. All remaining phases can begin.

---

## Phase 3: User Story 1 — App Works Without GitHub Spark Dependency (Priority: P1) 🎯 MVP

**Goal**: Replace all `useKV` / `@github/spark` persistence with a typed localStorage layer. Events and family members persist across page reloads. The app runs cleanly without any Spark API for persistence.

**Independent Test**: Run `npm run dev`. Add an event and a family member. Reload the page. Confirm all data is still present. Run `grep -r '@github/spark' src/` — must return empty.

### Test Stubs for User Story 1

> ⚠️ **Depends on spec 006** (Vitest + jsdom setup). Create file structure and test cases as pending stubs — do not attempt to run until spec 006 is complete.

- [X] T004 [P] [US1] Create `src/__tests__/lib/storage.test.ts` with test stubs for `LocalStorageAdapter`: (a) key present → returns parsed value typed as `T`; (b) key absent → returns `defaultValue`; (c) `set` → serializes value and writes to `window.localStorage` ⚠️ Vitest required (spec 006)
- [X] T005 [P] [US1] Create `src/__tests__/hooks/use-local-storage.test.ts` with test stubs for `useLocalStorage`: (a) initial state reads from adapter on mount; (b) direct setter call (`setValue(newVal)`) updates React state and writes to adapter; (c) functional updater (`setValue(prev => [...prev, item])`) updates state and writes result to adapter ⚠️ Vitest required (spec 006)

### Implementation for User Story 1

- [X] T006 [US1] Implement `LocalStorageAdapter` class in `src/lib/storage.ts`: `get<T>` adds SSR guard (`if (typeof window === 'undefined') return defaultValue`), calls `window.localStorage.getItem(key)`, returns `defaultValue` when result is `null`, otherwise returns `JSON.parse(raw) as T`; `set<T>` adds SSR guard, calls `window.localStorage.setItem(key, JSON.stringify(value))`
- [X] T007 [US1] Export `localStorageAdapter` singleton typed as the interface (`export const localStorageAdapter: StorageAdapter = new LocalStorageAdapter()`) in `src/lib/storage.ts`
- [X] T008 [US1] Implement `useLocalStorage<T>(key: string, defaultValue: T, adapter?: StorageAdapter): [T, React.Dispatch<React.SetStateAction<T>>]` in `src/hooks/use-local-storage.ts`: initialize `useState` with `(adapter ?? localStorageAdapter).get(key, defaultValue)`; add a `useEffect` keyed on `[value]` that calls `adapter.set(key, value)` to sync React state back to storage; return the `useState` setter directly as `React.Dispatch<React.SetStateAction<T>>`
- [X] T009 [US1] Add cross-tab sync to `useLocalStorage` in `src/hooks/use-local-storage.ts`: add a second `useEffect` keyed on `[key, defaultValue]` that calls `window.addEventListener('storage', handler)` where `handler` checks `e.key === key && e.newValue !== null`, parses `e.newValue` via `JSON.parse`, and calls `setState` with the result (fall back to `defaultValue` on parse error); return cleanup via `window.removeEventListener('storage', handler)`
- [X] T010 [US1] In `src/App.tsx`: remove `import { useKV } from '@github/spark/hooks'`; add `import { useLocalStorage } from '@/hooks/use-local-storage'` and `import { STORAGE_KEYS } from '@/lib/storage'`
- [X] T011 [US1] In `src/App.tsx`: replace `useKV<CalendarEvent[]>('family-events', [])` with `useLocalStorage<CalendarEvent[]>(STORAGE_KEYS.events, [])` and `useKV<FamilyMember[]>('family-members', [])` with `useLocalStorage<FamilyMember[]>(STORAGE_KEYS.members, [])`; confirm all 5 functional-updater call-sites (`setEvents(currentEvents => ...)` lines 52, 61, 77, 93–95 and `setMembers(currentMembers => ...)` lines 88, 92) are left completely unchanged

**Checkpoint**: US1 complete. `grep -r '@github/spark' src/` → empty. Add data → reload → data present. App builds.

---

## Phase 4: User Story 2 — Corrupted or Missing Storage is Handled Gracefully (Priority: P2)

**Goal**: The app must never crash on bad storage state. Malformed JSON silently resets to defaults with a `console.warn`; write errors (quota exceeded, access denied) are absorbed internally.

**Independent Test**: Open DevTools → Application → Local Storage. Paste into the console: `localStorage.setItem('family-calendar:events', 'not valid json{{{')`. Reload the page. Confirm the events list shows empty state with no JS error in the console — only a `[storage] Failed to parse…` warning.

### Test Stubs for User Story 2

> ⚠️ **Depends on spec 006** (Vitest setup). Stubs only.

- [X] T012 [P] [US2] Add test stubs to `src/__tests__/lib/storage.test.ts`: (a) raw malformed string in mocked `localStorage` → `get` returns `defaultValue` without throwing; (b) `localStorage.setItem` mocked to throw `DOMException('QuotaExceededError')` → `set` silently no-ops (does not throw, does not crash) ⚠️ Vitest required (spec 006)
- [X] T013 [P] [US2] Add test stub to `src/__tests__/hooks/use-local-storage.test.ts`: firing a `StorageEvent` with the matching key on `window` triggers `setState` with the newly parsed value in an already-mounted `useLocalStorage` hook ⚠️ Vitest required (spec 006)

### Implementation for User Story 2

- [X] T014 [US2] Harden `LocalStorageAdapter.get` in `src/lib/storage.ts`: wrap the `JSON.parse(raw)` call in `try/catch`; on any error emit `console.warn(\`[storage] Failed to parse value for key "${key}". Using default.\`)` and `return defaultValue` — do not re-throw
- [X] T015 [US2] Harden `LocalStorageAdapter.set` in `src/lib/storage.ts`: wrap `window.localStorage.setItem(key, JSON.stringify(value))` in `try/catch`; on any error (including `QuotaExceededError`, `SecurityError`) emit `console.warn(\`[storage] Failed to write key "${key}":\`, err)` without re-throwing

**Checkpoint**: US2 complete. Corrupt localStorage → app recovers to empty defaults. Quota/access errors are non-fatal.

---

## Phase 5: User Story 3 — Storage Access is Centralized, Type-Safe, and Backend-Swappable (Priority: P3)

**Goal**: Verify no component calls `localStorage` directly; confirm TypeScript compiles cleanly in strict mode; document the `StorageAdapter` interface as the backend-swap contract for spec 011.

**Independent Test**: Run `grep -rn 'localStorage\.' src/ --include='*.ts' --include='*.tsx'` — output must show **only** `src/lib/storage.ts`. Run `npx tsc --noEmit` — must exit 0 with no errors.

### Test Stubs for User Story 3

> ⚠️ **Depends on spec 006** (Vitest setup). Stubs only.

- [ ] T016 [P] [US3] Add test stub to `src/__tests__/lib/storage.test.ts`: (a) verify `localStorageAdapter` is assignable to `StorageAdapter` type; (b) create a mock adapter implementing `StorageAdapter`, inject it into `useLocalStorage` as the third argument, and verify calls go to the mock — not to `window.localStorage` ⚠️ Vitest required (spec 006)

### Implementation for User Story 3

- [ ] T017 [P] [US3] Run `grep -rn 'localStorage\.' src/ --include='*.ts' --include='*.tsx'` and confirm the **only** match is in `src/lib/storage.ts`; if any other file appears, refactor it to route through `localStorageAdapter` instead of calling `localStorage` directly (SC-003)
- [ ] T018 [P] [US3] Run `npx tsc --noEmit` and resolve any TypeScript errors in `src/lib/storage.ts`, `src/hooks/use-local-storage.ts`, and `src/App.tsx`; target: zero errors, zero uses of `any` without justification (SC-004)
- [ ] T019 [US3] Add JSDoc to `StorageAdapter` interface in `src/lib/storage.ts` documenting the backend-swap pattern (note spec 011 `PostgresAdapter` as the intended next implementor) and to `useLocalStorage` in `src/hooks/use-local-storage.ts` documenting the optional `adapter` injection point; confirm both are exported from their respective modules (SC-006)

**Checkpoint**: US3 complete. Architecture is verifiably centralized, type-safe, and documented for backend swapping.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all success criteria before merging.

- [ ] T020 [P] Manual smoke test per quickstart.md: run `npm run dev` → add an event → add a family member → reload ×3 → confirm all data present after each reload; then corrupt `family-calendar:events` in DevTools (`localStorage.setItem('family-calendar:events', '{invalid}')`) → reload → confirm clean empty-state with only a `console.warn`, no crash (SC-002, SC-005)
- [ ] T021 [P] Run `grep -r '@github/spark' src/` and confirm **empty** output — no Spark persistence imports remain in any source file (SC-001)
- [ ] T022 [P] Run `npm run build` (or `npx vite build`) and confirm a successful production build with no errors or warnings related to missing modules

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1; **BLOCKS** all user story phases
- **US1 (Phase 3)**: Depends on Phase 2 only — no dependency on US2 or US3
- **US2 (Phase 4)**: Depends on Phase 3 (hardens the `LocalStorageAdapter` built in US1)
- **US3 (Phase 5)**: Depends on Phases 3 and 4 (verifies the finalized state of all implementation files); T018/T019 should run after T014/T015 so TypeScript check reflects the hardened code
- **Polish (Phase 6)**: Depends on all prior phases complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational (Phase 2). Independent of US2 and US3.
- **US2 (P2)**: Depends on US1. Hardens the same `LocalStorageAdapter` class — cannot be started before T006.
- **US3 (P3)**: Depends on US1 and US2. Verification tasks (T017, T018) must run against the fully hardened code.

### Within Phase 3 (US1) — Task Order

```
T002 (StorageAdapter interface) ──────────────────────────┐
T003 (STORAGE_KEYS constant) ─────────────────────────────┤
                                                           │
T004 [P] test stub: storage.test.ts     ←─ parallel pair  │
T005 [P] test stub: use-local-storage.test.ts             │
                                                           ↓
T006 (LocalStorageAdapter implementation) ────────────────→ T007 (singleton export)
                                                                      │
T008 (useLocalStorage: useState + sync useEffect) ────────────────────→ T009 (cross-tab storage event)
                                                                                        │
T010 (App.tsx: swap imports) ───────────────────────────────────────────────────────────→ T011 (App.tsx: swap call sites)
```

### Within Phase 4 (US2) — Task Order

```
T006/T007 from Phase 3 must be complete before:
  T014 (harden get) ─┐ sequential in same file (src/lib/storage.ts)
  T015 (harden set) ─┘

T012 [P] ─┐ parallel: different test files
T013 [P] ─┘
```

---

## Parallel Execution Examples

### Phase 3 (US1) — Test Stubs in Parallel

```bash
# Both create new files with no overlap — safe to launch simultaneously:
Task T004: src/__tests__/lib/storage.test.ts
Task T005: src/__tests__/hooks/use-local-storage.test.ts
```

### Phase 3 (US1) — Implementation, Two Files

```bash
# After T002+T003 are complete, these two tasks work on different files:
Task T006+T007: src/lib/storage.ts          (LocalStorageAdapter + singleton)
Task T008+T009: src/hooks/use-local-storage.ts  (hook)
# Note: T008 imports localStorageAdapter — start T006/T007 first, or stub the import.
```

### Phase 6 (Polish) — Fully Parallel

```bash
# All three are read-only or scripted — no file conflicts:
Task T020: manual smoke test in browser
Task T021: grep -r '@github/spark' src/
Task T022: npm run build
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete **Phase 1** — create branch
2. Complete **Phase 2** — define `StorageAdapter` interface and `STORAGE_KEYS`
3. Complete **Phase 3** — implement full storage layer and migrate `App.tsx`
4. **STOP AND VALIDATE**: `grep -r '@github/spark' src/` → empty; add event → reload → data present
5. US1 is independently shippable as the feature MVP

### Incremental Delivery

| Step | Phases | Deliverable | Shippable? |
|------|--------|-------------|-----------|
| 1 | 1 + 2 + 3 | App decoupled from Spark; data persists across reloads | ✅ MVP |
| 2 | + 4 | Graceful recovery from corrupted/missing storage | ✅ |
| 3 | + 5 | Architecture verified; documented for spec 011 backend swap | ✅ |
| 4 | + 6 | Final validation; build clean; branch ready to merge | ✅ Ship |

---

## Success Criteria Verification Map

| SC | Criterion | Verified By |
|----|-----------|-------------|
| SC-001 | App runs without `@github/spark` in persistence paths | T021: `grep -r '@github/spark' src/` → empty |
| SC-002 | All features work identically after migration | T020: manual smoke test against spec acceptance scenarios |
| SC-003 | Zero direct `localStorage` calls outside `LocalStorageAdapter` | T017: `grep -rn 'localStorage\.' src/` → only `src/lib/storage.ts` |
| SC-004 | No TypeScript errors introduced | T018: `npx tsc --noEmit` exits 0 |
| SC-005 | Data persists across ≥3 consecutive reloads | T020: reload ×3 with data present |
| SC-006 | `StorageAdapter` and `LocalStorageAdapter` exported and documented | T019: JSDoc added; T016: test stub confirms interface contract |

---

## Notes

- **Test stubs (T004, T005, T012, T013, T016)**: Create the file, `describe` blocks, and `it`/`test` bodies now. Mark them `.todo` or `it.skip` so they compile without running. Activate after spec 006 (Vitest setup) is complete.
- **`@github/spark` stays in `package.json`**: The constraint is `grep -r '@github/spark' src/` → empty. The package may still be referenced outside `src/` (Vite config, etc.); full removal is deferred cleanup.
- **No data migration**: Spark KV keys (`family-events`, `family-members`) are inaccessible from `localStorage`; the new `family-calendar:` namespace starts fresh. This is acceptable per FR-010.
- **Functional updater compatibility is the critical correctness constraint**: The `useLocalStorage` setter must be the raw setter from `useState` — not a wrapper. This ensures `setEvents(prev => ...)` is handled by React's own reconciler with the correct current state, not by re-reading from `localStorage` (which would risk stale data).
- **Same file, sequential tasks**: T002 and T003 are both in `src/lib/storage.ts`; T006 and T007 are also in that file. Write sequentially — do not attempt to parallelize edits within the same file.
