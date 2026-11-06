# Implementation Plan: Family User Profiles & Self-Hosted Backend

**Branch**: `esmcelroy-issue-129-backend-planning` (feature artifacts: `011-self-hosted-profiles`) | **Date**: 2026-11-06 | **Spec**: [spec.md](./spec.md)
**Input**: `/specs/011-self-hosted-profiles/spec.md`, with the explicit scope decisions recorded in this plan and [research.md](./research.md)

## Summary

Add an opt-in, self-hosted application mode with username/password accounts, a first-run administrator bootstrap, administrator-created family accounts, shared family calendar data, per-user preferences, server-owned email settings, PostgreSQL persistence, and a stable live merged ICS feed. Keep the existing browser-only localStorage mode zero-configuration and fully usable, including local `.ics` downloads. The backend deployment is a real API + database deployment (with backend-owned runtime configuration), not static hosting alone.

The current synchronous `StorageAdapter` is a local persistence API, not a viable network adapter: it returns values synchronously, silently absorbs write failures, and its React hook assumes immediate local state updates. Keep that contract for local mode. Add a distinct asynchronous API/repository boundary for authenticated server mode; do not make a fake synchronous PostgreSQL adapter or silently fall back to browser storage when backend mode is selected. Backend write failures must be surfaced in the UI and must not enter an offline queue.

The implementation uses the validated stack recorded in [research.md](./research.md): Fastify 5, PostgreSQL 17 with `pg` 8 and `node-pg-migrate` 8, Argon2id, Nodemailer, and bounded `node-ical` fetching. Password recovery is deferred entirely. Existing `/api/` Vercel-style handlers are not served by the default Vite workflow.

## Technical Context

**Language/Version**: TypeScript 6.0.2 in the current app; package engine is Node.js `>=22` and `.nvmrc` pins `22`.
**Primary Dependencies**: Existing React 19 + Vite 7 + TypeScript frontend. Backend: Fastify 5, PostgreSQL 17, `pg` 8, `node-pg-migrate` 8, `argon2` 0.44, and `node-ical` 0.22. Nodemailer is already available in the root package. These choices were validated against published Node engine ranges in [research.md](./research.md).
**Storage**: Local mode remains `window.localStorage` via `src/lib/storage.ts`. Server mode uses PostgreSQL 17, with all persistent reads/writes through the backend; no browser-store fallback in server mode. SMTP credentials and organizer settings are owned by the backend and SMTP secrets are protected at rest.
**Testing**: Existing Vitest + React Testing Library suite; backend tests use Vitest with Node environment. PostgreSQL migration integration and Compose smoke tests use a disposable PostgreSQL service.
**Target Platform**: Browser-only SPA for local mode; self-hosted Docker Compose deployment containing a real application/API service and PostgreSQL for server mode. The application service must serve the UI and API (or otherwise be part of the same required deployment); static-only deployment is insufficient.
**Project Type**: Existing web SPA extended with an authenticated API and relational database.
**Performance Goals**: No numeric throughput or latency target was supplied. Preserve page-refresh visibility of server writes and serve the live merged ICS feed from current persisted data.
**Constraints**: Zero-config localStorage mode; separate async API boundary; configured server mode fails visibly rather than falling back or queueing writes; one family per deployment; username/password; first-run admin bootstrap and admin-created accounts; no open signup or password recovery; local ICS downloads remain available; backend live merged ICS feed is included; Compose deployment includes app + PostgreSQL; build on merged PR #139 without duplicating Spark removal; avoid duplicating the separately tracked ICS implementation in PR #140. Backend stack: Fastify 5, `pg` 8, `node-pg-migrate` 8, Argon2id, Nodemailer and bounded `node-ical` subscription fetching.
**Scale/Scope**: One household/family per deployment and a small set of family accounts, events, and external calendar subscriptions. No multi-tenant family model or speculative synchronization infrastructure.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-research gate

- **I. Component-driven architecture — PASS**: Auth, account administration, and server settings belong in focused components/hooks; backend and persistence logic stays outside presentation components.
- **II. TypeScript strictness — PASS WITH STACK DECISION GATE**: Retain shared domain types in `src/lib/types.ts` and typed API contracts. The frontend is TypeScript; select and validate the backend runtime/toolchain before implementation rather than introducing unverified dependencies.
- **III. Accessibility first — PASS**: Login, bootstrap, account-management, and settings forms must remain keyboard-operable, labeled, and accessible.
- **IV. Local-first persistence — PASS**: LocalStorage remains a fully working zero-config default. Server mode is explicit, uses an asynchronous API boundary, and does not fall back to localStorage on backend errors.
- **V. Simplicity & YAGNI — PASS**: A separate async boundary is required by the existing sync contract and remote write semantics; avoid speculative offline sync, recovery flows, multi-family tenancy, and unrelated dependency cleanup.

### Post-design gate

- **I–III — PASS**: Proposed separation keeps UI concerns in React, persistence/auth in backend services, and calls for accessible forms and tests.
- **IV — PASS**: The two modes are explicit and separate. The local adapter and local file-download path remain available. Backend reads/writes are asynchronous and errors are user-visible with no local queue/fallback.
- **V — PASS WITH JUSTIFIED BOUNDARY**: A separately runnable backend and PostgreSQL service add deployment pieces but are necessary to satisfy the real-backend requirement. The architecture does not add a generic sync engine or a multi-tenant abstraction.
- **Implementation gate**: The framework, driver, migration runner, password hashing, session transport, and secret-protection approach have been selected and are recorded in [research.md](./research.md). Preserve these boundaries; deployment-specific key backup and TLS/reverse-proxy details remain documented operational responsibilities.

## Design Overview

### Mode selection and persistence boundaries

1. Local mode remains the default when the app is run in the existing Vite workflow without a backend deployment. It retains `LocalStorageAdapter`, current local event/member flows, local preferences, and local `.ics` downloads.
2. The self-hosted application provides an authoritative runtime-mode/config response from the backend. A browser configured for server mode must fail closed on API/config errors; it must not quietly switch to localStorage.
3. Keep `StorageAdapter` synchronous for existing local consumers. Add a distinct async `CalendarApi`/repository boundary for server-mode event, member, subscription, preference, and settings operations. Server mutations resolve only after the backend response; the UI presents failed writes and creates no offline queue.
4. Server mode must cover the existing `/kiosk` read path as well as the main calendar so it does not accidentally read a second, stale localStorage dataset. Preserve local-mode kiosk refresh behavior.
5. Backend mode serves the Vite-built SPA and API from a real application service. `DATABASE_URL` is backend-only configuration. Compose includes the application service, PostgreSQL, and a persistent database volume.

### Scope alignment and explicit decisions

- The user’s supplied decisions take precedence over older conflicting text in `spec.md`: no public signup; admins create accounts; no password recovery; no offline write queue; SMTP/organizer values are server-owned in backend mode. PostgreSQL was the user-confirmed default candidate and is the selected database for this implementation.
- One deployment represents one family; no `Family`/tenant entity is required.
- Preserve event sharing across accounts and per-account view/filter preferences.
- Local `.ics` download remains a client action. The stable merged live `.ics` URL is a server feature and must be available in the backend deployment.
- PR #139 is merged to main as `834e715`; this plan builds on that state and does not duplicate Spark removal.
- Issue #20 is closed as a duplicate after its historical criteria were reconciled into #129.
- PR #140 separately tracks the ICS subscription implementation. Preserve the backend feed contract and coordinate integration rather than duplicating that work.

## Project Structure

### Documentation (this feature)

```text
specs/011-self-hosted-profiles/
├── plan.md              # This plan
├── research.md          # Decisions and open runtime questions
├── data-model.md        # Server-mode entities and relations
├── quickstart.md        # Local and deployed Compose workflows
└── contracts/
    └── openapi.yaml     # Runtime-neutral HTTP contract draft
```

`tasks.md` is intentionally not created by this planning phase.

### Existing and proposed source layout

```text
src/
├── App.tsx                         # Existing calendar experience; adapt mode/auth routing
├── components/                     # Existing calendar plus focused auth/admin UI
├── hooks/
│   ├── use-local-storage.ts        # Keep synchronous local-mode hook
│   └── ...                         # Add async server-mode hooks after stack selection
└── lib/
    ├── storage.ts                  # Keep localStorage adapter
    ├── types.ts                    # Shared event/member types; extend only as needed
    ├── ical.ts                     # Preserve local download; reuse compatible generation
    └── ...                         # Add typed API client/runtime-mode boundary

backend/                            # Fastify application/API runtime
├── src/
│   ├── auth/                       # Bootstrap, login, sessions, administrator checks
│   ├── calendar/                   # Shared events, members, subscriptions, feed
│   ├── settings/                   # Backend-owned organizer/SMTP settings
│   └── server.ts                   # Fastify application entrypoint
├── migrations/                     # Versioned node-pg-migrate migrations
└── tests/                          # Backend and PostgreSQL integration tests

Dockerfile                          # Multi-stage UI + backend application image (design target)
compose.yaml                        # Application + PostgreSQL + persistent database volume
api/                                # Existing Vercel-style handlers; do not treat as Vite API server
```

**Structure Decision**: Keep the current Vite/React SPA under `src/` and introduce an isolated Fastify `backend/` application service rather than overloading the existing Vercel-style `api/` functions. The production/self-hosted app service owns runtime configuration, serves the SPA and `/api/*`, and connects to PostgreSQL.

## Phase 0–1 Artifacts

- [Research decisions and open questions](./research.md)
- [Data model](./data-model.md)
- [HTTP API contract draft](./contracts/openapi.yaml)
- [Local and self-hosted quickstart](./quickstart.md)

## Complexity Tracking

| Violation / added complexity | Why needed | Simpler alternative rejected because |
|---|---|---|
| Separate async API boundary alongside synchronous `StorageAdapter` | Network reads/writes are asynchronous and must report write failures; remote persistence is not a synchronous key/value store. | Making the existing adapter synchronous-over-network would block the UI or hide errors; changing its semantics would regress local mode and all current hook call sites. |
| Backend application service plus PostgreSQL in Compose | User requires a real backend, database, and backend-owned configuration; existing Vite workflow does not serve the Vercel-style `api/` functions. | Static-only hosting cannot authenticate users, persist server-owned secrets, or expose a live feed backed by shared data. |
