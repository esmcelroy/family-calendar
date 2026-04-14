# Implementation Plan: Replace Spark KV with localStorage Backend

**Branch**: `003-local-storage-backend` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)  
**Input**: Replace `useKV` from `@github/spark/hooks` with a typed, backend-swappable localStorage persistence layer.

---

## Summary

The app currently depends on `@github/spark`'s `useKV` hook for persisting `events` and `members` state. This couples the app to the Spark hosting environment and blocks self-hosted and standalone deployments. This feature replaces that dependency with a purpose-built persistence layer consisting of:

1. A `StorageAdapter` interface (in `src/lib/storage.ts`) that abstracts the underlying store — enabling backend swapping without touching components (required by spec 011's PostgreSQL path).
2. A `LocalStorageAdapter` concrete implementation backed by `window.localStorage`.
3. A `useLocalStorage<T>` hook (in `src/hooks/use-local-storage.ts`) that wraps the adapter with React state and matches the `[value, setter]` destructuring API of `useKV`, including support for functional updaters (`setState(prev => next)`).
4. A one-line swap in `App.tsx` replacing the two `useKV` calls with `useLocalStorage`.

No data migration is required. Key names change from `family-events` / `family-members` (Spark KV) to `family-calendar:events` / `family-calendar:members` (namespaced localStorage).

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Primary Dependencies**: React 19, Vite, `@github/spark` (being removed from persistence paths), Tailwind CSS v4, shadcn/ui  
**Storage**: `window.localStorage` (browser-native; no new packages required)  
**Testing**: Vitest (configured by spec 006; test file targets noted in each phase below)  
**Target Platform**: Browser only (no SSR; `window.localStorage` is always available at runtime per spec assumption)  
**Project Type**: Single-page web application  
**Performance Goals**: localStorage reads/writes are synchronous and sub-millisecond for the data volumes in scope (hundreds of events, <20 members). No async complexity introduced.  
**Constraints**: localStorage 5 MB quota; all reads/writes centralized in adapter; zero raw `JSON.parse`/`localStorage.setItem` outside `LocalStorageAdapter`  
**Scale/Scope**: Two persisted keys (`family-calendar:events`, `family-calendar:members`); two call-sites in `App.tsx`

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design below.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Component-Driven Architecture | ✅ PASS | `useLocalStorage` goes in `src/hooks/`; adapter in `src/lib/`. No business logic leaks into components. |
| II | TypeScript Strictness | ✅ PASS | All new code is typed; no `any` without justification; shared types stay in `src/lib/types.ts`. Generic `<T>` on adapter methods and hook. |
| III | Accessibility First | ✅ PASS | Storage layer is invisible to UI; no accessibility impact. |
| IV | Local-First Data Persistence | ✅ PASS — this feature *implements* Principle IV. `StorageAdapter` interface explicitly supports backend swapping for spec 011. No raw `localStorage` outside the adapter. |
| V | Simplicity & YAGNI | ✅ PASS | No new third-party packages. Abstraction is used in exactly two places (adapter + hook), satisfying the "two or more uses" rule. |

**Post-Design Re-check (Phase 1)**: ✅ All gates still pass. The `StorageAdapter` interface introduces one layer of indirection justified by its two consumers (adapter + future PostgreSQL adapter in spec 011). The `useLocalStorage` hook is used in two call-sites in `App.tsx`.

---

## Project Structure

### Documentation (this feature)

```text
specs/003-local-storage-backend/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── storage-adapter.md   ← StorageAdapter interface contract
└── tasks.md             ← Phase 2 output (via /speckit.tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── hooks/
│   ├── use-mobile.ts            # existing
│   └── use-local-storage.ts     # NEW — reactive hook wrapping StorageAdapter
├── lib/
│   ├── types.ts                 # existing — CalendarEvent, FamilyMember unchanged
│   ├── calendar.ts              # existing — unchanged
│   ├── utils.ts                 # existing — unchanged
│   └── storage.ts               # NEW — StorageAdapter interface + LocalStorageAdapter
└── App.tsx                      # MODIFIED — swap useKV → useLocalStorage

src/__tests__/                   # (created by spec 006; plan notes target files)
├── lib/
│   └── storage.test.ts          # unit tests for LocalStorageAdapter
└── hooks/
    └── use-local-storage.test.ts  # hook tests with jsdom localStorage mock
```

**Structure Decision**: Single Vite SPA project. New files follow the existing `src/hooks/` and `src/lib/` conventions. No new top-level directories.

---

## Complexity Tracking

> No constitution violations. No entries required.

---

## Phase 0: Research

> See [research.md](./research.md) for full findings. Summary of decisions:

| Topic | Decision | Rationale |
|-------|----------|-----------|
| `useKV` API shape | Returns `[T, Dispatch<SetStateAction<T>>]`; setter supports functional updaters | App.tsx uses `setEvents(prev => ...)` pattern in 4 of 5 call-sites — hook must match |
| StorageAdapter generics | `get<T>(key, default): T` / `set<T>(key, value): void` on instance | Avoids class-level generic; each call-site passes its own `T` independently |
| Cross-tab sync | Implement `window.storage` event listener in hook | Provides correct behavior when user opens two tabs; low cost |
| Error handling | Try/catch in adapter `set`; `console.warn` + silent no-op on quota/access errors | Matches spec FR-008; avoids crashing the app on write failure |
| SSR guard | `typeof window !== 'undefined'` check in adapter | Zero-cost; future-proofs if Vite SSR is ever added |
| Key naming | `family-calendar:events` and `family-calendar:members` | Namespaced to prevent collision with other apps at same origin |
| `@github/spark` removal | Remove import from `App.tsx` only; package itself can stay in `package.json` until no other usages exist | `grep` confirms `useKV` is the only Spark API in use in persistence paths |

---

## Phase 1: Design & Contracts

> See [data-model.md](./data-model.md), [contracts/storage-adapter.md](./contracts/storage-adapter.md), and [quickstart.md](./quickstart.md) for full design artifacts.

### Key Design Decisions

**`StorageAdapter` is an interface, not a class.** `LocalStorageAdapter` is a plain class implementing it. The hook receives an adapter instance (defaulting to a module-level singleton). This means spec 011 can inject a `PostgresAdapter` instance without touching `useLocalStorage` or `App.tsx`.

**Functional updater in `useLocalStorage`.** Because `App.tsx` calls `setEvents(prev => ...)`, the hook's setter type is `React.Dispatch<React.SetStateAction<T>>` — identical to `useState`. The functional path reads current state from React (not re-reads localStorage) to avoid stale closures.

**`storage` event listener for cross-tab sync.** The hook adds a `window` `storage` event listener keyed to its storage key. When another tab writes the same key, the hook re-parses and updates React state. This is a correctness improvement over `useKV` (which was session-scoped) at negligible cost.

**No migration from Spark KV keys.** The old Spark KV key names (`family-events`, `family-members`) are in a different namespace than `localStorage` and cannot be migrated. Fresh start is acceptable per spec assumption and FR-010.

### Entities Introduced

| Entity | Location | Description |
|--------|----------|-------------|
| `StorageAdapter` | `src/lib/storage.ts` | Interface with `get<T>` and `set<T>`; the contract for backend swapping |
| `LocalStorageAdapter` | `src/lib/storage.ts` | `StorageAdapter` implementation backed by `window.localStorage` |
| `localStorageAdapter` | `src/lib/storage.ts` | Module-level singleton instance; exported for direct use in tests |
| `STORAGE_KEYS` | `src/lib/storage.ts` | Typed constant object (`events`, `members`) for namespaced key strings |
| `useLocalStorage<T>` | `src/hooks/use-local-storage.ts` | React hook wrapping `StorageAdapter`; drop-in for `useKV` |

---

## Implementation Phases

### Phase 1 — Foundation (P1)

**Goal**: `LocalStorageAdapter` exists, is tested, and `useLocalStorage` hook is a working drop-in.

| Task | File | Notes |
|------|------|-------|
| Create `StorageAdapter` interface | `src/lib/storage.ts` | `get<T>` + `set<T>` methods; exported |
| Implement `LocalStorageAdapter` | `src/lib/storage.ts` | JSON serialize/deserialize; try/catch on set; SSR guard |
| Export `STORAGE_KEYS` constant | `src/lib/storage.ts` | `events: 'family-calendar:events'`, `members: 'family-calendar:members'` |
| Export `localStorageAdapter` singleton | `src/lib/storage.ts` | Default adapter instance |
| Create `useLocalStorage<T>` hook | `src/hooks/use-local-storage.ts` | `[value, Dispatch<SetStateAction<T>>]`; cross-tab sync via `storage` event |
| Write adapter unit tests | `src/__tests__/lib/storage.test.ts` | Mock `localStorage` with `vitest`; test get/set/default/error paths |
| Write hook unit tests | `src/__tests__/hooks/use-local-storage.test.ts` | `renderHook` with jsdom; test functional updater + storage event |

**Exit criteria**: `tsc --noEmit` passes; adapter tests pass; hook tests pass.

---

### Phase 2 — Migration (P1)

**Goal**: `App.tsx` no longer imports from `@github/spark`.

| Task | File | Notes |
|------|------|-------|
| Replace `useKV` import with `useLocalStorage` | `src/App.tsx` | Remove `import { useKV } from '@github/spark/hooks'`; add `import { useLocalStorage } from '@/hooks/use-local-storage'` |
| Update key names | `src/App.tsx` | `'family-events'` → `STORAGE_KEYS.events`; `'family-members'` → `STORAGE_KEYS.members` |
| Verify no other `@github/spark` imports exist | whole `src/` | `grep -r '@github/spark' src/` should return empty |
| Manual smoke test | browser | Create event → reload → confirm persistence; corrupt localStorage → confirm graceful reset |

**Exit criteria**: `grep -r '@github/spark' src/` returns empty; app builds; all existing features verified.

---

### Phase 3 — Hardening (P2)

**Goal**: Edge cases from spec are handled and verifiable.

| Task | File | Notes |
|------|------|-------|
| Storage quota warning (non-fatal) | `src/lib/storage.ts` | Catch `QuotaExceededError`; `console.warn`; do not re-throw |
| Malformed JSON reset to default | `src/lib/storage.ts` | Catch `SyntaxError` in `get`; return `defaultValue` |
| SSR / missing `window` guard | `src/lib/storage.ts` | `typeof window === 'undefined'` → return `defaultValue`; skip write |
| Test malformed JSON scenario | `src/__tests__/lib/storage.test.ts` | Set a raw invalid string in mock localStorage; verify default returned |
| Test quota exceeded scenario | `src/__tests__/lib/storage.test.ts` | Mock `localStorage.setItem` to throw; verify no crash |

**Exit criteria**: All error-path tests pass; `tsc --noEmit` clean.

---

## Success Criteria Verification Map

| SC | Criterion | Verified By |
|----|-----------|-------------|
| SC-001 | App builds without `@github/spark` | `grep -r '@github/spark' src/` → empty; `vite build` passes |
| SC-002 | All features work identically | Manual smoke test against acceptance scenarios in spec |
| SC-003 | Zero direct `localStorage` calls outside adapter | `grep -rn 'localStorage\.' src/ --include='*.ts' --include='*.tsx'` → only `src/lib/storage.ts` |
| SC-004 | No TypeScript errors | `tsc --noEmit` exits 0 |
| SC-005 | Data persists across 3 reloads | Manual test: add event → reload ×3 → data present |
| SC-006 | `StorageAdapter` exported from `src/lib/` | Import check + quickstart.md documents usage |
