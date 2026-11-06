# Tasks: Family User Profiles & Self-Hosted Backend

**Input**: `specs/011-self-hosted-profiles/{spec,plan,research,data-model,contracts/openapi.yaml,quickstart}.md`
**Scope**: Issue #129 decisions in `plan.md` take precedence over older conflicting spec text. Build on `origin/main` (PR #139 is already merged); do not repeat Spark removal. No GitHub changes.
**Tests**: Required by this task request. Write the listed tests before the corresponding implementation and verify they fail for the intended missing behavior.

## Phase 1: Setup

**Purpose**: Validate the backend runtime choices and preserve the existing local-mode baseline.

- [X] T001 Validate Node 22-compatible HTTP server and PostgreSQL as a candidate (including driver/migration, session, SMTP-secret, and bounded external-ICS fetch/cache options); if a candidate fails validation, revise the design before implementation. Record selected choices and operational prerequisites in `specs/011-self-hosted-profiles/research.md` and `plan.md`, including proof that Vercel-shaped `api/*.ts` handlers are not served by default `npm run dev`.
- [X] T002 [P] Add local-mode regression coverage for zero-config startup, localStorage event/member persistence, and local `.ics` download in `src/__tests__/lib/local-mode.test.ts` and `src/lib/ical.test.ts`; run against `origin/main` before feature changes.
- [X] T003 Create the selected backend workspace, test/build scripts, and strict TypeScript configuration in `backend/package.json`, `backend/tsconfig.json`, `backend/vitest.config.ts`, and root `package.json`.

## Phase 2: Foundational

**Purpose**: Establish the real application/API runtime, migrations, and explicit server-mode boundary before story implementation.

- [X] T004 [P] Add a runtime integration test proving the backend serves the SPA and `/api/*`, while Vite does not implicitly serve the Vercel-style handlers, in `backend/tests/integration/server-runtime.test.ts`.
- [X] T005 [P] Add PostgreSQL migration integration tests for fresh install, repeat startup, and schema versioning in `backend/tests/integration/migrations.test.ts`.
- [X] T006 [P] Add client tests proving Vite defaults to local mode and configured server mode reports `/api/mode` failure without reading or writing localStorage in `src/lib/runtime-mode.test.ts`.
- [X] T007 Implement the selected Node application entrypoint, API route registration, static SPA serving, safe error responses, and request-log redaction in `backend/src/server.ts` and `backend/src/http/`.
- [X] T008 Implement PostgreSQL connection/configuration and versioned migrations for the shared schema in `backend/src/db/` and `backend/migrations/`.
- [X] T009 Implement authoritative runtime-mode discovery and the typed asynchronous server API/error boundary without changing `StorageAdapter` in `src/lib/runtime-mode.ts` and `src/lib/server-api.ts`.

## Phase 3: User Story 1 — Personal Accounts and Login (P1)

**Goal**: Bootstrap the first administrator, let administrators create accounts, and provide username/password login and logout with per-account sessions.

**Independent Test**: On an empty deployment bootstrap one administrator; verify a second concurrent bootstrap is rejected, the administrator can create a user, each account can log in/out, and invalid credentials are denied.

### Tests — write and fail before implementation

- [X] T010 [P] [US1] Add API tests for atomic first-admin bootstrap, password hashing, login/session/logout, authorization, duplicate usernames, and admin-only account creation in `backend/tests/integration/auth.test.ts`.
- [X] T011 [P] [US1] Add UI tests for bootstrap, login, logout, protected-route redirects, and visible authentication errors in `src/components/auth/AuthScreens.test.tsx`.

### Implementation

- [X] T012 [US1] Add User and Session migrations/models with unique normalized usernames, roles, password hashes, expiries, and revocation in `backend/migrations/` and `backend/src/auth/`.
- [X] T013 [US1] Implement atomic bootstrap, password verification, session issuance/invalidation, and admin-only user creation for `/api/auth/*` and `/api/admin/users` in `backend/src/auth/` and `backend/src/routes/`.
- [X] T014 [US1] Implement bootstrap/login/logout screens, session loading, and authenticated route gating in `src/components/auth/` and `src/App.tsx`.
- [X] T015 [US1] Add accessible administrator account creation/list UI and connect it to `/api/admin/users` in `src/components/admin/UsersPanel.tsx`.

## Phase 4: User Story 2 — Shared Calendar and Personal Preferences (P2)

**Goal**: Share events, members, and enabled ICS subscriptions across accounts while keeping view/filter preferences per user; server writes fail visibly and are never queued or copied to localStorage.

**Independent Test**: Create an event/member as one account and read it as another; verify each account's preferences remain independent, a failed write is visible with no queue/fallback, and server-mode kiosk reads backend data.

### Tests — write and fail before implementation

- [X] T016 [P] [US2] Add API integration tests for shared event/member/subscription CRUD, member-reference cleanup, and per-user preference isolation in `backend/tests/integration/calendar.test.ts`.
- [X] T017 [P] [US2] Add client tests for asynchronous loading, confirmed server mutations, visible failed writes with no retry/queue/localStorage write, independent preferences, and server-mode kiosk reads in `src/lib/server-calendar.test.ts` and `src/components/KioskView.test.tsx`.

### Implementation

- [X] T018 [US2] Add migrations/models/repositories for shared events, event-member relationships, family members, subscriptions, and user preferences, preserving current event/recurrence shapes in `backend/migrations/` and `backend/src/calendar/`.
- [X] T019 [US2] Implement authenticated event, member, subscription, and current-user preference endpoints from `contracts/openapi.yaml` in `backend/src/routes/calendar.ts` and `backend/src/routes/preferences.ts`.
- [X] T020 [US2] Implement typed asynchronous calendar/member/subscription/preference API operations and explicit loading/error/mutation state in `src/lib/server-calendar.ts` and `src/hooks/`.
- [X] T021 [US2] Connect server-mode calendar CRUD and per-user view/filter preferences to the async API while retaining existing local-mode flows in `src/App.tsx` and `src/components/`.
- [X] T022 [US2] Route kiosk reads through the server API in server mode and retain its current localStorage refresh behavior in `src/components/KioskView.tsx`.

## Phase 5: User Story 3 — Self-Hosted Deployment and Backend Services (P3)

**Goal**: Ship a one-family Docker Compose app+PostgreSQL deployment with backend-owned organizer/SMTP settings and a stable, revocable live merged ICS feed; retain local downloads separately.

**Independent Test**: Start a fresh Compose deployment, bootstrap and sign in, save settings without exposing SMTP secrets, retrieve the current merged feed from its stable capability URL, rotate/revoke that URL, and confirm local Vite mode still downloads `.ics` without backend configuration.

### Tests — write and fail before implementation

- [X] T023 [P] [US3] Add API tests for admin-only settings, secret redaction/protected storage, SMTP test and invitation calls using saved backend credentials (never browser-supplied credentials) in `backend/tests/integration/settings.test.ts`.
- [X] T024 [P] [US3] Add feed tests for stable capability URL, rotation/revocation, current shared-event plus enabled-subscription content, valid `text/calendar`, and stripped `VALARM` in `backend/tests/integration/feed.test.ts`.
- [X] T025 [P] [US3] Add Compose smoke tests for app/API reachability, PostgreSQL readiness, persistent volume, and migration startup in `backend/tests/integration/compose.test.ts`.

### Implementation

- [X] T026 [US3] Implement backend-owned organizer/SMTP settings with protected-at-rest SMTP secret handling and sanitized settings responses in `backend/src/settings/` and `backend/src/routes/settings.ts`.
- [X] T027 [US3] Implement SMTP test and event invitation delivery using saved backend settings; keep local-mode invitation behavior unchanged in `backend/src/settings/`, `backend/src/routes/invitations.ts`, and `src/hooks/use-send-invitations.ts`.
- [X] T028 [US3] Implement feed capability issuance, secure digest storage, rotation/revocation, redacted request logging, and live merged ICS generation from current shared events plus enabled subscriptions using the validated bounded fetch/cache policy in `backend/src/feed/` and `backend/src/routes/feed.ts`.
- [X] T029 [US3] Add the application image, Compose app/PostgreSQL services, persistent DB volume, backend-only environment template, health checks, and migration startup in `Dockerfile`, `compose.yaml`, and `.env.example`.
- [X] T030 [US3] Add admin UI for backend settings and feed URL status/rotation without returning stored SMTP secrets in `src/components/admin/SettingsPanel.tsx` and `src/components/admin/FeedSettings.tsx`.

## Final Phase: Polish and Cross-Cutting Validation

- [X] T031 Update `specs/011-self-hosted-profiles/quickstart.md` with validated stack-specific local and Compose commands, backend-only configuration, bootstrap, backup/upgrade notes, and the distinction between local downloads and the live backend feed.
- [ ] T032 Run `npm test`, `npm run lint`, `npm run build`, backend tests, migration tests, and the Compose quickstart; fix regressions in `src/` and `backend/` without changing the existing localStorage or local `.ics` behavior.

## Dependencies & Execution Order

### Phase dependencies

- Setup: T001 gates backend workspace/tool selection (T003); T002 is independent and establishes the local-mode baseline.
- Foundational: T004–T006 are tests and can run in parallel after test tooling exists; T007–T009 follow their corresponding failing tests. All story work depends on T007–T009.
- US1: T010–T011 precede T012–T015; account creation and route gating require the foundational runtime.
- US2: Depends on US1 authentication. T016–T017 precede T018–T022; repositories/endpoints precede UI integration.
- US3: Depends on foundational runtime and the US1 admin role; feed composition also depends on US2 shared events/subscriptions. T023–T025 precede T026–T030.
- Polish: T031–T032 follow all selected stories.

### Parallel opportunities

- T002 can run alongside T001. After T003, T004–T006 can be developed concurrently.
- Within US1, T010 and T011 are independent tests; backend auth (T012–T013) and frontend screens (T014) can proceed in separate files after the tests are in place.
- Within US2, T016 and T017 are independent tests; API/repository work can be separated from UI work after the contract is agreed.
- Within US3, T023–T025 are independent tests; settings (T026–T027), feed (T028), and Compose packaging (T029) can proceed in parallel once their test fixtures and shared runtime are ready. T030 integrates the completed admin APIs.

## Implementation Strategy

1. Validate the runtime and establish a local-mode regression baseline.
2. Deliver the minimum authenticated backend slice (bootstrap, login, and admin-created accounts) as the P1 MVP; stop and validate it independently.
3. Add shared calendar data and per-user preferences without modifying the synchronous local adapter.
4. Add deployment packaging, backend-owned mail settings, and the distinct live merged feed.
5. Run the full local and Compose validation before release. Do not add password recovery, public signup, offline write queues, multi-family tenancy, WebSocket sync, or other unconfirmed scope.
