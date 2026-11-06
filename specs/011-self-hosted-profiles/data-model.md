# Data Model: Family User Profiles & Self-Hosted Backend

**Feature**: `011-self-hosted-profiles`
**Phase**: 1 — Design
**Status**: Implemented relational model; PostgreSQL 17 migrations and backend queries are in `backend/`.

## Model boundaries

- A backend deployment is one family. Family-wide rows are implicitly scoped to that deployment; there is no family/tenant table or cross-family key.
- Server mode is the source of truth for events, family members, subscriptions, preferences, sessions, and backend-owned settings. The browser does not maintain a second server-mode copy in localStorage.
- Existing localStorage mode remains unchanged and independent.
- IDs remain opaque strings at the frontend boundary and use PostgreSQL UUIDs. Shared calendar payloads use JSONB; account/session/preferences/settings records use relational columns and versioned migrations.
- Shared calendar domain shapes should remain compatible with `CalendarEvent`/`FamilyMember` in `src/lib/types.ts`, including recurrence and exception semantics.

## Entities

### User

One login account in this family deployment.

| Field | Conceptual type | Rules |
|---|---|---|
| `id` | opaque identifier | Primary key |
| `username` | string | Required; unique within the deployment using a documented normalization/case policy |
| `passwordHash` | string | Required; one-way password hash only, never plaintext |
| `role` | `admin \| member` | First-run account is administrator; administrator creates subsequent users |
| `createdAt` | timestamp | Required; server-assigned |
| `updatedAt` | timestamp | Required; server-assigned |

**Validation**: Password creation input must be at least eight characters per the feature spec, with a strength policy decided during auth implementation. Password recovery is out of scope.

### Session

An authenticated login session linked to a user.

| Field | Conceptual type | Rules |
|---|---|---|
| `id` | opaque identifier | Primary key |
| `userId` | identifier | Required FK to `User`; deleting/revoking a user invalidates their sessions |
| `credentialDigest` | secret digest or equivalent | Never store a reusable raw session credential if sessions are persisted |
| `createdAt` | timestamp | Required |
| `expiresAt` | timestamp | Required; after expiry the session is rejected |
| `revokedAt` | nullable timestamp | Set on logout/revocation where server-side invalidation is used |

**Open decision**: Persistent opaque sessions vs signed-token sessions and the exact cookie/CSRF/rotation policy are not selected.

### UserPreference

Per-user calendar presentation state.

| Field | Conceptual type | Rules |
|---|---|---|
| `userId` | identifier | PK and FK to `User` |
| `activeView` | string/enum | Optional; validate against views supported by the app |
| `activeFilters` | JSON array or relation | Per-user only; member IDs must refer to existing family members |
| `updatedAt` | timestamp | Server-assigned |

The current `App.tsx` keeps `activeFilters` and `currentDate` in React state rather than persisted storage. The feature’s requirement explicitly calls for per-user view/filter preferences; define which additional state is persisted during implementation without broadening beyond user preferences.

### FamilyMember

Existing shared household person/color record, not an account.

| Field | Conceptual type | Rules |
|---|---|---|
| `id` | opaque identifier | Primary key |
| `name` | string | Required |
| `color` | string | Required; preserve current member color semantics |
| `email` | nullable string | Existing invitation recipient field |
| `preferredPlatform` | nullable enum | Existing calendar invitation preference |

An account (`User`) and a calendar member (`FamilyMember`) are distinct concepts; do not implicitly create one account per member.

### CalendarEvent

Shared calendar event compatible with the current `CalendarEvent` type.

| Field | Conceptual type | Rules |
|---|---|---|
| `id` | opaque identifier | Primary key |
| `title` | string | Required |
| `date` | date/string | Required; preserve app’s date semantics |
| `startTime`, `endTime` | nullable time/string | Optional; preserve current validation |
| `description` | nullable string | Optional |
| `seriesId` | nullable identifier | Recurring-series identity |
| `recurrence` | structured nullable value | Preserve current `RecurrenceRule` fields |
| `seriesExceptions` | structured collection | Preserve modified/deleted occurrence data |
| `sequence` | integer | Invitation sequence; default semantics follow current app |
| `createdAt`, `updatedAt` | timestamps | Server-assigned |

**Relationship**: Event ↔ FamilyMember is many-to-many through `CalendarEventMember` conceptually. The API may continue to present `memberIds: string[]`. Whether the database uses a normalized join table or a JSON representation is a stack/schema decision; a relational join is the default recommendation for referential integrity.

### CalendarEventMember (relationship)

Connects one event to one family member; unique per `(eventId, memberId)`. Deleting a member must follow an explicit reference policy; current `App.tsx` removes deleted member IDs from existing events.

### CalendarSubscription

An external ICS source associated with the family deployment.

| Field | Conceptual type | Rules |
|---|---|---|
| `id` | opaque identifier | Primary key |
| `displayName` | string | Required |
| `sourceUrl` | URL | Required; treated as potentially sensitive and omitted from logs |
| `color` | nullable string | Optional presentation color |
| `enabled` | boolean | Only enabled feeds participate in views/feed |
| `lastFetchedAt` | nullable timestamp | Server-assigned |
| `lastFetchError` | nullable string | Sanitized status text; never contain secrets or fetched raw response |
| `createdAt`, `updatedAt` | timestamps | Server-assigned |

Imported events are read-only and retain source subscription identity. Fetch schedule, caching, auth-in-URL support, URL restrictions, and duplicate identity policy are open questions. Existing `specs/001-ics-calendar-subscriptions/spec.md` requires stripping `VALARM` components from the merged feed.

### FamilySettings

Singleton backend-owned configuration for the one family deployment.

| Field | Conceptual type | Rules |
|---|---|---|
| `id` | fixed singleton key | Exactly one row per deployment |
| `organizerName` | nullable string | Shared organizer display name |
| `organizerEmail` | nullable email | Shared organizer address |
| `smtpHost`, `smtpPort`, `smtpSecure` | nullable values | Backend-owned SMTP transport configuration |
| `smtpUsername` | nullable string | Server-side only |
| `smtpPasswordCiphertext` | nullable protected secret | Never returned by read APIs; encrypted/protected using a backend-held key |
| `smtpFromName`, `smtpFromAddress` | nullable values | Sender fields |
| `updatedAt`, `updatedByUserId` | timestamp/identifier | Auditable changes; actor references `User` |

The exact protected-secret mechanism, encryption key provision/rotation, and administrator authorization for settings changes are implementation decisions. Never place SMTP credentials or encryption keys in frontend build-time variables.

### FeedCredential

Capability used by external calendar clients to retrieve the live feed without an interactive login.

| Field | Conceptual type | Rules |
|---|---|---|
| `id` | opaque identifier | Primary key |
| `tokenDigest` | secret digest | Store a non-reusable digest; the raw capability must be protected and never logged |
| `createdAt` | timestamp | Required |
| `rotatedAt` | nullable timestamp | When capability changes |
| `revokedAt` | nullable timestamp | Revocation disables the previous URL |
| `createdByUserId` | identifier | Admin who issued/rotated it |

Feed tokens are bearer credentials. The stable URL changes only when an administrator rotates/revokes the capability. Decide token issuance/display and cache behavior before implementation.

## Relationships

```text
User 1 ─── * Session
User 1 ─── 1 UserPreference
User 1 ─── * FamilySettings changes (updatedBy)
User 1 ─── * FeedCredential issuance (createdBy)
CalendarEvent * ─── * FamilyMember (CalendarEventMember)
CalendarSubscription 1 ─── * imported/read-only events (derived or cached)
FamilySettings 1 ─── 1 deployment
FeedCredential * ─── 1 deployment
```

## State and validation rules

- **Bootstrap**: Before any user exists, the backend allows a first-admin bootstrap operation. Bootstrap must be atomic/idempotent under concurrent requests. After the first account is created, bootstrap is closed.
- **Account administration**: Only administrators create accounts. No public registration, password-reset, or password-recovery transition is defined.
- **Authentication**: All calendar/admin API operations require an unexpired authenticated session, except runtime-mode discovery, first-admin bootstrap, login, and the bearer-capability ICS feed.
- **Shared data**: Event/member/subscription changes are shared by all authenticated accounts in this deployment.
- **Personal data**: Preferences are keyed to the authenticated user and do not overwrite another user’s filters/view.
- **Server write errors**: Failed mutations return a typed error and are shown in UI; no local persistence queue or silent success state.
- **Feed**: Feed output is generated from current backend data and enabled subscriptions, with `VALARM` stripped. No authentication is required on the feed endpoint itself; a hard-to-guess, revocable feed capability is required.
- **Local mode**: None of these server entities need to exist for local mode to operate.
