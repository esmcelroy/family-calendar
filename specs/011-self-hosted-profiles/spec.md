# Feature Specification: Family User Profiles & Self-Hosted Backend

**Feature Branch**: `011-self-hosted-profiles`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: Family user profiles with self-hosted backend and optional PostgreSQL for multi-device sync

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Each Family Member Has a Personal Login (Priority: P1)

Each family member can create a personal account with a username and password. When they log in, the calendar displays their personalized view — their events, their preferences, their filters.

**Why this priority**: Shared-device usage without profiles means family members overwrite each other's filters and preferences. Profiles provide the foundation for all personalization.

**Independent Test**: Create two accounts (Parent, Child). Log in as each in turn. Confirm that filter preferences and default view state are independent per account.

**Acceptance Scenarios**:

1. **Given** the app is running, **When** a new user visits, **Then** they are presented with a login or signup screen.
2. **Given** a registered user, **When** they enter correct credentials and submit, **Then** they are logged in and see their personalized calendar view.
3. **Given** an incorrect password, **When** the user submits the login form, **Then** a clear error message is shown and access is denied.
4. **Given** a logged-in user, **When** they click "Log out", **Then** they are returned to the login screen and their session is ended.

---

### User Story 2 - Calendar Data is Shared Across the Family (Priority: P2)

All family members see the same calendar events regardless of which account they use. Events created by one member are visible to all. Personal preferences (filters, view mode) are per-account.

**Why this priority**: The calendar's value is shared visibility. Data isolation per user would make it a personal calendar, not a family calendar.

**Independent Test**: Log in as Parent. Add an event. Log in as Child. Confirm the event is visible.

**Acceptance Scenarios**:

1. **Given** two logged-in accounts on the same family instance, **When** one account creates an event, **Then** it is visible to all other accounts.
2. **Given** user A sets their filter to show only their events, **When** user B logs in, **Then** user B's filter state is unchanged.

---

### User Story 3 - Self-Hosted with Optional PostgreSQL Backend (Priority: P3)

A technically inclined family member can deploy the app to their own server and configure it to use a PostgreSQL database instead of browser localStorage — enabling multi-device sync across the household.

**Why this priority**: localStorage cannot sync across devices; PostgreSQL provides a durable, multi-device shared store for self-hosted deployments.

**Independent Test**: Deploy the app with a PostgreSQL connection string configured. Log in from two different devices. Add an event on device 1. Confirm it appears on device 2 without a refresh.

**Acceptance Scenarios**:

1. **Given** a PostgreSQL connection string is configured at deployment, **When** the app starts, **Then** it uses the database for all persistent data instead of `localStorage`.
2. **Given** no database is configured, **When** the app starts, **Then** it falls back to `localStorage` and functions identically to the pre-profile version.
3. **Given** the database-backed deployment, **When** two devices are logged into the same account, **Then** events created on either device appear on the other within a page refresh.

---

### Edge Cases

- What if a family member forgets their password? A password reset flow requiring access to a shared admin account (for self-hosted) is in scope; email-based reset requires SMTP configuration and is out of scope for v1.
- What if the database connection is lost while the app is running? The app should surface a "cannot sync" warning and queue writes locally until the connection is restored.
- What if a user attempts to access the app without logging in? All calendar routes MUST redirect to the login screen; no data is accessible unauthenticated.
- What if the app is deployed without auth configured (local-only mode)? The constitution Principle IV local-first mode remains fully supported as a zero-configuration fallback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST support user registration with username and password (minimum 8 characters).
- **FR-002**: Passwords MUST be stored using a secure one-way hash; plaintext passwords MUST NOT be stored at any layer.
- **FR-003**: User sessions MUST be managed via secure HTTP-only cookies or signed tokens with an expiry.
- **FR-004**: All calendar data (events, members, subscriptions) MUST be shared across all authenticated accounts in the same family instance.
- **FR-005**: Per-user preferences (active view mode, active filters) MUST be stored per account and not shared.
- **FR-006**: An optional `DATABASE_URL` environment variable MUST switch the persistence layer from `localStorage` to PostgreSQL when set.
- **FR-007**: When PostgreSQL is active, all reads and writes MUST go through the database; `localStorage` MUST NOT be used as a parallel or fallback store.
- **FR-008**: A database migration system MUST be included to manage schema changes without manual SQL.
- **FR-009**: A login page MUST be the default entry point; authenticated routes MUST redirect unauthenticated users to login.

### Key Entities

- **User**: A family account holder. Attributes: id, username (unique), passwordHash, createdAt.
- **Session**: An authenticated session. Attributes: id, userId, expiresAt, token.
- **UserPreference**: Per-user app state. Attributes: userId, activeView, activeFilters (JSON).

## Constitution Note

> **Constitution v1.1.0 (2026-04-13) amended Principle IV** to allow an optional server-backed mode when `DATABASE_URL` is explicitly configured. Local-first remains the default and MUST be the mandatory fallback. This spec is now unblocked for planning. Review the amended Principle IV before beginning the implementation plan.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can register and log in within 2 minutes of arriving at the app for the first time.
- **SC-002**: An event created by one logged-in family member is visible to a second member within one page refresh.
- **SC-003**: The app continues to function in full localStorage mode when no database is configured (no regression).
- **SC-004**: User passwords are never stored in plaintext (verifiable by inspecting the database schema and any log output).
- **SC-005**: With a PostgreSQL backend, the same event is visible from two different devices after a page reload.

## Assumptions

- The self-hosted deployment target is a lightweight server (VPS, Raspberry Pi, home lab) running Node.js and PostgreSQL.
- Docker Compose configuration for local development and deployment is in scope as part of this feature.
- Email-based password reset is out of scope for v1; admin-assisted reset is acceptable.
- The app does not need a multi-tenant or multi-family model; one deployment serves one family.
