# Quickstart: Family User Profiles & Self-Hosted Backend

**Feature**: `011-self-hosted-profiles`
**Status**: Implementation guidance for the one-family deployment.

## Local browser-only mode

The default Vite workflow remains zero-configuration. It requires no accounts,
Node API server, PostgreSQL, Docker, or backend secrets.

```bash
npm ci
npm run dev
```

Events and family members persist in browser `localStorage`. Use **Export** to
download a local `.ics` file. This is separate from the server-hosted live feed.

## Self-hosted Docker Compose deployment

### Prerequisites

- Docker Engine with Docker Compose v2.
- A host with persistent storage for the PostgreSQL data volume.
- A TLS-enabled reverse proxy for public Internet access. Do not expose SMTP or
  PostgreSQL ports publicly.
- Node 22 is used in the application image; host Node is not required.

### Configure secrets

Copy the template:

```bash
cp .env.example .env
```

Replace the placeholders in `.env` with independently generated values. Use
`openssl rand -hex 32` for `POSTGRES_PASSWORD` and `SESSION_SECRET`; use
`openssl rand -base64 32` for `SMTP_ENCRYPTION_KEY`. `SESSION_SECRET` must be at
least 32 characters. `SMTP_ENCRYPTION_KEY` must decode to exactly 32 bytes.
Keep `.env` private, out of source control, and backed up separately from the
database. The SMTP encryption key is required to read stored SMTP credentials;
losing it requires re-entering those settings.

### Start and bootstrap

```bash
docker compose up --build -d --wait
docker compose ps
```

The application waits for PostgreSQL health, runs versioned migrations before
listening, then serves the SPA and `/api/*` from one Node service. Open the host
or reverse-proxy URL and bootstrap the first administrator on the empty
database. Bootstrap is one-time and there is no public signup or password
recovery. Sign in as administrator to create the rest of the family accounts.

The default app port is `3000`; set `APP_PORT` to change the host port. Set
`TRUST_PROXY=true` only when the service is behind a correctly configured
trusted reverse proxy. Configure TLS termination and HTTPS at that proxy.

### Calendar, mail, and feed behavior

- Events, family members, and enabled external ICS subscriptions are shared by
  accounts; view and member-filter preferences are per account.
- Backend writes require a live API response. Errors are visible; there is no
  offline queue or localStorage fallback in server mode.
- Configure organizer and SMTP settings from the administrator settings page.
  SMTP passwords are encrypted at rest using `SMTP_ENCRYPTION_KEY`; reads never
  return the password. SMTP test and invitations use only saved server settings.
- **Export** remains the local file-download action. The administrator's live
  feed URL is a separate bearer capability that returns current shared events
  plus enabled subscriptions and strips `VALARM` components. Treat that URL as a
  secret. Rotate it to invalidate the previous URL, or revoke it to disable
  feed access.
- External ICS fetches are HTTPS-only, resolve and pin public IP addresses,
  reject private/local destinations, cap redirects, response size and timeout,
  and cache successful content briefly. Subscriptions that fail to fetch are
  omitted from that feed response.
- In server mode, the kiosk reads shared server data. In local mode, the
  existing localStorage refresh behavior remains unchanged.

### Backup and upgrades

Back up PostgreSQL before upgrading:

```bash
docker compose exec -T db pg_dump -U family_calendar family_calendar | gzip > family-calendar.sql.gz
```

Keep the `.env` values (especially `SMTP_ENCRYPTION_KEY`) in the deployment's
secret manager. To upgrade, back up first, update the application source/image,
then run:

```bash
docker compose up --build -d --wait
docker compose logs --tail=100 app
```

Migrations run automatically on application startup and are tracked in the
database. Do not edit the production schema manually. Restore the database from
the dump using the matching PostgreSQL tooling if recovery is needed; retain the
same encryption key to decrypt SMTP credentials.

## Validation checklist

- `npm run dev` works without backend configuration and retains localStorage
  persistence and local `.ics` downloads.
- Compose starts a real app/API service and PostgreSQL with health checks and a
  persistent named volume; migrations run before requests are served.
- Empty database permits exactly one first-admin bootstrap; admin-created
  accounts can authenticate.
- Accounts share events/members/subscriptions while preferences remain per-user.
- Failed server writes are visible and do not touch localStorage or queue work.
- SMTP settings reads do not disclose the secret; test/invitation delivery uses
  saved backend credentials.
- Feed capability URLs are stable until rotation/revocation and return a valid
  live merged calendar without `VALARM`.
