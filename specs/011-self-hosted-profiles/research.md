# Research: Family User Profiles & Self-Hosted Backend

**Feature**: `011-self-hosted-profiles` / issue #129
**Phase**: 0 — Outline & Research
**Date**: 2026-11-06
**Status**: Runtime stack validated and selected for implementation. Remaining questions are operational details documented with the implementation.

## Decisions

### 1. Keep localStorage mode separate from remote persistence

**Decision**: Preserve `StorageAdapter` and `useLocalStorage` for local mode. Add a separate typed asynchronous API/repository boundary for server mode; do not implement a network-backed `StorageAdapter`.

**Evidence**:

- `src/lib/storage.ts`: `StorageAdapter.get<T>` returns `T`, `set<T>` returns `void`, and the local implementation absorbs write errors.
- `src/hooks/use-local-storage.ts`: state initializes synchronously from `adapter.get`, writes happen in an effect, and cross-tab synchronization depends on browser `storage` events.
- `src/App.tsx`: event/member handlers use `setEvents(prev => ...)` and show success feedback as if writes have succeeded synchronously.
- `src/components/KioskView.tsx`: kiosk mode reads event/member arrays directly through `localStorageAdapter`, then refreshes on an interval and visibility/storage events.

Network operations are asynchronous and can fail. The server-mode boundary must expose loading/error/mutation state so a failed backend write can be shown to the user. It must not enqueue the mutation or retry by writing to localStorage.

**Alternatives considered**:

- Make `StorageAdapter` asynchronous: rejected for this feature’s design because it would change the established hook and numerous synchronous call sites; local mode should remain unchanged.
- Implement a browser `PostgresAdapter`: rejected because the browser must not connect directly to PostgreSQL or hold DB credentials. The backend owns database access.
- Silently use localStorage when API calls fail: rejected because it creates split-brain data and contradicts the explicit no-fallback/no-queue decision.

### 2. Require a real backend service for self-hosted mode

**Decision**: Use the isolated Fastify application runtime in `backend/` and a Compose deployment containing that application and PostgreSQL. The application runtime owns server config and serves the browser app/API; static-only hosting is not the self-hosted backend deployment.

**Evidence**:

- `package.json` exposes `npm run dev` as `vite`; `vite.config.ts` configures React/Tailwind and Vite plugins, not an API server.
- `api/send-invitation.ts` and `api/test-smtp.ts` use `VercelRequest`/`VercelResponse`; those files have no Vite route integration.
- At initial inspection, there was no Dockerfile, Compose file, server framework, PostgreSQL driver, or migration system in the repository.
- At initial inspection, `npm ls @vercel/node express fastify pg postgres drizzle-orm prisma --depth=0` found none of the queried server/database packages installed.
- `package.json` declares Node `>=22`; selected backend packages and application builds were subsequently validated against that baseline.

**Alternatives considered**:

- Treat existing `api/` handlers as a self-hosted backend: rejected; their Vercel function shape is not served by default Vite workflow.
- Deploy static files only and call it self-hosted mode: rejected; it cannot provide required server-owned settings, database-backed auth/data, or live feed generation.
- Add backend code into Vite development middleware only: rejected as a deployment contract; the self-hosted runtime needs a real application/API service outside the static Vite workflow.

### 3. Runtime mode must be explicit and fail closed

**Decision**: Backend mode is selected at frontend build time with `VITE_APP_MODE=server` for the self-hosted image, and `/api/mode` supplies backend status. When backend mode is selected, missing/unreachable API/config is an error state, not permission to load or write local data. Vite’s existing no-backend workflow continues to select local mode.

**Rationale**: Avoid accidental local-only operation that appears successful but loses shared writes. Backend-owned configuration also ensures the browser never chooses `DATABASE_URL` or SMTP credentials.

**Implementation**: The image build sets `VITE_APP_MODE=server`, while the default Vite workflow remains local. The runtime mode is fixed in the built client; API/config errors in server mode remain visible and do not switch to localStorage.

### 4. Validate and select the PostgreSQL backend stack

**Decision**: PostgreSQL 17 is the selected backend database. The implementation uses Fastify 5, `pg` 8, and `node-pg-migrate` 8; package engine compatibility, backend tests/build, and the runtime boundary are checked as part of implementation.

**Evidence**: The repository currently has no backend runtime/database driver or migration dependency; Node >=22 and TypeScript are the current project baseline. A public-source comparison found multiple viable options rather than a unique fit. Express 5 offers ecosystem maturity; Fastify offers TypeScript-oriented schemas/plugins; Hono offers a Fetch API-oriented Node adapter. PostgreSQL access can use `pg` or `postgres.js`; schema management can use Prisma, Drizzle Kit, node-pg-migrate, or a separately selected migration runner.

**Alternatives considered during planning**:

- Declare PostgreSQL and a framework/ORM now: rejected because the user explicitly made PostgreSQL conditional on runtime validation and did not choose those dependencies.
- Keep all decisions unresolved without a structured gate: rejected; the data/API design stays runtime-neutral and the implementation stack selection is an explicit pre-implementation decision item.

**Public references for follow-up validation**:

- Node.js TypeScript support and type-stripping limits: [Node.js TypeScript documentation](https://nodejs.org/api/typescript.html)
- Framework options: [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html), [Fastify TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/), [Hono Node.js guide](https://hono.dev/docs/getting-started/nodejs)
- PostgreSQL client options: [node-postgres](https://node-postgres.com/), [postgres.js](https://github.com/porsager/postgres)
- Migration/schema options: [Drizzle migrations](https://orm.drizzle.team/docs/migrations), [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate), [node-pg-migrate](https://github.com/salsita/node-pg-migrate)

Third-party benchmark numbers are omitted because no throughput target was given and family-calendar scale does not justify choosing a stack from microbenchmarks.

**Implementation selection (validated for Node 22)**:

- **HTTP/runtime**: Fastify 5. Its published package metadata supports Node 20.11 and newer, and therefore the repository's Node `>=22` baseline. Fastify will serve both the compiled SPA and same-origin `/api/*`; the current Vite development server remains a separate local-only workflow.
- **Database**: PostgreSQL 17 (official `postgres:17-alpine` image) with `pg` 8. `pg` supports Node 16.17 and newer. `node-pg-migrate` 8 supports Node 18.18, 20.9, and 22+, and supplies versioned SQL migrations and a migration table.
- **Authentication**: `argon2` 0.44 for password hashes; opaque random session tokens are held in `HttpOnly`, `SameSite=Lax` cookies while only SHA-256 token digests are persisted in PostgreSQL. Mutating requests use same-origin checks and the application does not enable cross-origin credentials. Login throttling is enforced in the application.
- **Mail/secrets**: Nodemailer is already a runtime dependency. SMTP passwords are encrypted with AES-256-GCM using a backend-only 32-byte `SMTP_ENCRYPTION_KEY`; only an `smtpConfigured` flag and non-secret settings are returned.
- **External calendars**: `node-ical` 0.22 supports Node 18+. Use built-in `fetch` with strict HTTPS-only URL validation, redirect revalidation, resolved-address checks/pinning, a request timeout, a bounded response size, and a short in-memory cache. Parsing and output generation remove all `VALARM` components. Do not fetch a subscription synchronously without those bounds.
- **Deployment prerequisites**: Node 22+ for direct app operation, or Docker Engine + Compose and persistent storage for PostgreSQL; backend-only `DATABASE_URL`, `SESSION_SECRET`, and `SMTP_ENCRYPTION_KEY`; TLS/reverse proxy for non-local deployments. The Postgres image supports common Docker architectures, but a target host's architecture and available memory/storage remain deployment checks.
- **Project verification**: `npm run dev` is configured only with Vite/React plugins; the existing `api/*.ts` handlers use Vercel request/response types and are not registered by Vite. The runtime test verifies Vite does not return the backend JSON response for `/api/mode`.

The package metadata was checked against the public npm registry on 2026-11-06. The available local Node version is 26.13.0; Node 22 compatibility is established from the selected packages' declared engine ranges, not by claiming that the current machine itself runs Node 22. Docker and Docker Compose CLIs are present in this environment.

### 5. One family per deployment; account administration is closed

**Decision**: Treat the deployment itself as the family boundary; do not introduce a family/tenant table. The first configured account is bootstrapped as administrator, and administrators create subsequent accounts. There is no public signup endpoint.

**Rationale**: Matches the user decisions and keeps server-side ownership unambiguous. Calendar events, family members, ICS subscriptions, and family email settings are shared within that deployment. Preferences are per user.

### 6. Defer all password recovery

**Decision**: Do not design password-reset, email-recovery, admin-assisted recovery, or reset-token flows for this feature.

**Rationale**: Explicit user decision overrides the older spec edge-case note that admin-assisted reset could be in scope.

### 7. Backend owns shared organizer/SMTP configuration and protects secrets

**Decision**: Store organizer configuration and SMTP settings server-side in backend mode. Never return the SMTP password or ciphertext from a settings read; the server uses the saved credentials when testing/sending. Persist SMTP secret material protected at rest with a backend-held key/secret.

**Evidence**: `src/components/SmtpSettingsPanel.tsx` currently persists `SmtpConfig` and `OrganizerConfig` in localStorage. `src/hooks/use-send-invitations.ts` sends the full SMTP config/password to `/api/send-invitation`; the existing handlers expect credentials in request JSON. That model must not be copied to server mode.

**Implementation**: SMTP credentials are encrypted with AES-256-GCM using a server-only key, and settings writes are administrator-only. Operators must preserve and provision the key securely; automated key rotation is out of scope.

### 8. Keep local `.ics` downloads and add a distinct backend live merged feed

**Decision**: Preserve `generateICalendar`/`downloadICalendar` in `src/lib/ical.ts` for local export. Add a stable server endpoint for a merged feed in backend mode. The feed is computed from current shared calendar data and the family’s enabled external subscriptions; it is not the local file-download feature.

**Evidence**:

- `src/App.tsx` calls `generateICalendar(events, members)` and `downloadICalendar(...)` from the browser.
- `src/lib/ical.ts` builds RFC 5545 output and downloads a `text/calendar` Blob.
- Existing `specs/001-ics-calendar-subscriptions/spec.md` describes a merged output feed, stable URL, and stripping `VALARM`. The supplied decision makes the stable live feed part of the backend track, distinct from local downloads.

**Security/design constraints**: A stable unauthenticated subscription URL is a bearer capability. The implementation stores only a digest, redacts token-bearing paths, provides rotation/revocation, limits successful source fetches to a short bounded cache, and rejects private/local destinations. Failed source fetches are omitted from the merged feed.

### 9. Integrate with current upstream work without duplication

**Decision**: Build on the merged PR #139 state and do not repeat Spark cleanup. Do not duplicate the separately tracked ICS implementation in PR #140; align the backend feed with its subscription model.

**Evidence**: PR #139 merged to main as `834e715`, removing Spark and retaining browser localStorage. The current issue's backend work starts from that updated main. The coordinator reports that PR #140 separately tracks ICS subscriptions and has incorporated the Spark-free main; its implementation is not assumed to be present in this worktree.

## Operational Details and Limits

The runtime stack, session transport, secret protection, feed architecture, and cache bounds are implemented as follows:

1. Sessions expire after 30 days; cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Reverse-proxy trust must be configured only for a trusted proxy.
2. There is no automated SMTP encryption-key rotation or recovery. Operators must preserve the key with deployment secrets and backups; losing it requires re-entering SMTP settings.
3. Successful calendar source responses are cached in memory for five minutes with a 32-entry bound. This is not a user-facing synchronization guarantee.
4. Feed capability URLs are revealed on creation/rotation; only a digest is stored. The user can rotate to recover a lost URL.
5. Feed composition uses all family-authored events plus enabled subscriptions. Token-bearing request paths are redacted, and cache entries are cleared on feed rotation or revocation.
6. Kiosk and other open tabs observe shared updates after a reload or the kiosk's existing refresh interval. No push/WebSocket infrastructure is introduced.

## Repository Evidence and Scope Boundaries

- Current persisted event/member model: `src/lib/types.ts`; current keys: `src/lib/storage.ts`.
- Current local calendar state and CRUD: `src/App.tsx`; local preferences are component state today (`activeFilters`, `currentDate`).
- Current kiosk reads direct from local adapter: `src/components/KioskView.tsx`.
- Current SMTP settings and send path: `src/components/SmtpSettingsPanel.tsx`, `src/hooks/use-send-invitations.ts`, `api/send-invitation.ts`, `api/test-smtp.ts`.
- Current local ICS generation/download: `src/lib/ical.ts`, called by `src/App.tsx`.
- Existing API handler files are Vercel-shaped and no Vite backend route/server is configured.
- The closed duplicate issue #20 is not separate scope. Keep the updated distinction between local downloads and backend live feed.
- No GitHub issue or PR was edited as part of this design.
