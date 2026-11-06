# Feature Specification: Family User Profiles & Self-Hosted Backend

**Feature Branch**: `011-self-hosted-profiles`
**Created**: 2026-04-13
**Updated**: 2026-11-06
**Status**: Draft for implementation
**Input**: Issue #129, reconciled with the historical criteria from duplicate issue #20 and confirmed user decisions.

## Summary

The application keeps its existing zero-configuration browser mode while adding an opt-in self-hosted mode with a real application backend and database. A self-hosted deployment serves the application and API, stores shared family data and user-editable settings on the backend, and is packaged with Docker Compose. Static-only hosting is not a self-hosted backend deployment.

## User Scenarios & Testing

### User Story 1 - Family Accounts (Priority: P1)

The first family administrator creates the deployment's initial account during first-run setup. The administrator then creates username/password accounts for other family members. Each person can log in and out and keep personal calendar view/filter preferences.

**Independent Test**: On a fresh database, bootstrap exactly one administrator, create a second account, and verify both accounts can log in, log out, and retain separate preferences.

**Acceptance Scenarios**:

1. **Given** a fresh self-hosted deployment, **When** its first administrator opens setup, **Then** they can create the initial account.
2. **Given** the initial administrator exists, **When** another person visits without a session, **Then** public registration is unavailable and the administrator must create their account.
3. **Given** a registered account, **When** valid credentials are submitted, **Then** an authenticated session is established.
4. **Given** invalid credentials or an expired/revoked session, **When** a protected route is requested, **Then** access is denied and the UI presents the login flow.
5. **Given** two accounts, **When** each saves its own view/filter preferences, **Then** one account's preferences do not overwrite the other's.
6. **Given** an authenticated user, **When** they log out, **Then** the session is invalidated and the browser returns to login.

### User Story 2 - Shared Family Calendar (Priority: P1)

All authenticated accounts in a self-hosted deployment share the same family events, family members, and external calendar subscriptions. Calendar changes are stored by the backend and are visible to other users after they reload.

**Independent Test**: Create or edit an event as one account, then reload as another account and verify the shared event and family members are current.

**Acceptance Scenarios**:

1. **Given** two authenticated accounts in one deployment, **When** one changes an event or family member, **Then** the other sees the persisted change after reload.
2. **Given** a backend write fails, **When** a user saves a change, **Then** the UI reports failure and does not claim success, queue the change, or write it to localStorage.
3. **Given** backend mode is selected but its API is unavailable, **When** the app starts or a request fails, **Then** the UI reports the backend error and does not silently switch to browser-only data.

### User Story 3 - Self-Hosted Backend and Configuration (Priority: P1)

A family can run the app with its own application/API service and PostgreSQL database using Docker Compose. The backend owns shared organizer and SMTP configuration; SMTP credentials are protected at rest and are never returned to the browser or accepted from a browser send request.

**Independent Test**: Start a fresh Compose deployment, bootstrap the administrator, store settings, restart the services, and verify settings remain available without exposing the SMTP secret.

**Acceptance Scenarios**:

1. **Given** the Compose deployment, **When** it starts, **Then** it runs a real backend service and PostgreSQL with persistent database storage.
2. **Given** a self-hosted deployment, **When** a family member saves organizer/SMTP settings, **Then** the backend persists them and responses do not reveal the SMTP password or ciphertext.
3. **Given** an event invitation is sent or SMTP is tested, **When** the request reaches the backend, **Then** it uses server-owned settings rather than credentials supplied by the browser.
4. **Given** backend configuration is unavailable or invalid, **When** the backend starts or serves a request, **Then** it surfaces a clear failure and does not expose secrets in responses or logs.

### User Story 4 - Local Browser Mode (Priority: P1)

A family can continue to use the app with no backend or database configuration. Existing localStorage persistence and local `.ics` file downloads remain fully usable.

**Independent Test**: Run the app through its ordinary local Vite workflow without server/database settings, create data, reload, and download an `.ics` file.

**Acceptance Scenarios**:

1. **Given** no backend mode is configured, **When** the app runs in the existing local workflow, **Then** it starts without login or server setup and persists local data as before.
2. **Given** local browser mode, **When** the user exports a calendar, **Then** the existing `.ics` download works without a backend.
3. **Given** local browser mode, **When** a backend is later added to a separate deployment, **Then** the local workflow does not require migrating data or configuring accounts.

### User Story 5 - Live Merged Calendar Feed (Priority: P2)

In self-hosted mode, an authenticated family administrator can provide an external calendar client a stable live merged ICS feed URL. The feed reflects current shared family events and enabled external subscriptions. It is separate from the local browser `.ics` download.

**Independent Test**: Add a shared event and an enabled external subscription, retrieve the stable feed, and verify its current events; rotate/revoke its capability and verify the old URL is denied.

**Acceptance Scenarios**:

1. **Given** a valid feed capability, **When** an external client retrieves the URL, **Then** the backend returns a valid merged calendar with alarms removed.
2. **Given** the family changes shared events or enabled subscriptions, **When** the feed is retrieved again, **Then** it reflects current backend data.
3. **Given** an administrator rotates or revokes the capability, **When** the old URL is requested, **Then** the request is denied.
4. **Given** local browser mode, **When** the user exports an `.ics` file, **Then** it continues to work independently of the live backend feed.

## Edge Cases

- Two simultaneous first-run bootstrap requests must not create multiple administrators.
- A family member who forgets a password cannot recover it in this feature; all password recovery is deferred.
- Database/API failures in backend mode must be visible. The app does not queue writes offline or fall back to localStorage.
- A member or event update must preserve referential integrity; removing a family member must remove or resolve its event assignments consistently with current behavior.
- A stable feed URL is a bearer capability. The raw capability must not be logged or stored as a reusable secret, and rotation/revocation must be possible.
- An external subscription URL is untrusted input. Fetch limits, timeouts, redirects, private-network protections, and cache policy must be defined before enabling server-side fetching.
- Local mode must not require auth, a running database, a feed token, or any migration.

## Requirements

### Functional Requirements

- **FR-001**: Backend mode MUST support username/password accounts for one family per deployment.
- **FR-002**: The first account MUST be created through a safe first-run administrator bootstrap. After the first account exists, only an administrator may create additional accounts; public signup MUST NOT be available.
- **FR-003**: Passwords MUST be stored as secure one-way hashes; plaintext passwords MUST NOT be stored or logged. Input MUST meet the documented minimum of eight characters.
- **FR-004**: Authenticated sessions MUST expire and use secure, HTTP-only cookies in production. Logout MUST invalidate the session. Cookie-authenticated mutation requests MUST have a CSRF defense.
- **FR-005**: Calendar, family-member, subscription, preference, settings, and account-administration endpoints MUST enforce the appropriate authenticated-user or administrator authorization.
- **FR-006**: Events, family members, and external calendar subscriptions MUST be shared across accounts in one deployment. View and filter preferences MUST be scoped per account.
- **FR-007**: Backend mode MUST use an asynchronous API boundary. Network operations MUST NOT be presented as a synchronous implementation of the existing local `StorageAdapter`.
- **FR-008**: Backend mode MUST treat the database/API as authoritative. Failed reads or writes MUST be surfaced; the client MUST NOT silently fall back to localStorage, queue offline writes, or report failed writes as successful.
- **FR-009**: Backend persistence MUST use PostgreSQL for this implementation. A versioned migration system MUST create and upgrade the schema.
- **FR-010**: Self-hosted mode MUST include a real application/API service and PostgreSQL deployment with persistent data, packaged for Docker Compose. Static-only hosting MUST NOT be represented as backend mode.
- **FR-011**: Organizer and SMTP settings MUST be stored by the backend in backend mode. SMTP credentials MUST be protected at rest, excluded from read responses/logs, and used by server-side invitation/test operations without accepting SMTP credentials from the browser.
- **FR-012**: Backend mode MUST provide a stable, revocable-capability URL for a live merged ICS feed composed from current shared family events and enabled external subscriptions. The feed MUST be valid ICS and MUST strip `VALARM` components.
- **FR-013**: Existing localStorage-only operation and local `.ics` downloads MUST remain fully usable without an account or backend.
- **FR-014**: All password-recovery flows are out of scope for this feature.

### Key Entities

- **User**: Account identity, unique normalized username, password hash, role, and creation metadata.
- **Session**: User-linked expiring/revocable authenticated session.
- **FamilyMember**: Shared calendar person; distinct from a login account.
- **CalendarEvent**: Shared calendar event, including recurrence, exceptions, and member references.
- **CalendarSubscription**: Shared external ICS source and its display/fetch state.
- **UserPreference**: Per-user active view and filters.
- **FamilySettings**: Singleton backend-owned organizer/SMTP configuration with protected SMTP secret.
- **FeedCredential**: Revocable bearer capability for retrieving the live merged ICS feed.

## Success Criteria

- **SC-001**: A clean self-hosted deployment can bootstrap exactly one first administrator; a concurrent or later bootstrap cannot create another.
- **SC-002**: An administrator can create a second account; both accounts can authenticate, while public signup is unavailable.
- **SC-003**: A calendar event and family-member change created by one account appears to another account after a page reload.
- **SC-004**: Two users can save different active filters/view preferences without overwriting each other.
- **SC-005**: No plaintext password, raw session token, SMTP password, or feed capability is persisted or emitted in logs/API read responses.
- **SC-006**: Backend write failures are visible and do not result in localStorage fallback or queued local writes.
- **SC-007**: Docker Compose starts the app/API and PostgreSQL; data and backend settings survive service restarts.
- **SC-008**: The stable feed returns valid current ICS content, strips `VALARM`, and rejects a rotated/revoked capability.
- **SC-009**: The existing local Vite/localStorage workflow and local `.ics` download work without a backend or account.

## Constitution

The checked-in Constitution v1.1.0 already amends Principle IV to permit an opt-in server-backed mode while retaining local-first as a fully supported baseline. No further constitution amendment is required by this feature.

## Assumptions and Constraints

- One self-hosted deployment serves one family; multi-family tenancy is out of scope.
- PostgreSQL 17 is the selected backend database for this implementation.
- Docker Compose is the target self-hosted packaging.
- Backend mode configuration is server/deployment-owned and must fail closed if that backend is unavailable.
- Local browser ICS downloads remain available; the stable live merged feed is backend-only.
- Public registration, password recovery, offline write queueing, and multi-family tenancy are out of scope.
