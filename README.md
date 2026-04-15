# Family Calendar

Family Calendar is a lightweight shared calendar for households. It focuses on quick event entry, simple month navigation, family-member color coding, and local-first persistence so a family can keep a single schedule visible without setting up a backend.

## Node.js version

This project requires **Node.js 22 LTS**.

- Use the pinned version from `.nvmrc` (`nvm use`)
- `package.json` enforces the same requirement via `engines.node`

## Current capabilities

- Month-based calendar view with previous, next, and today navigation
- Event creation, editing, and deletion
- Family member management with color-coded event ownership
- Per-member calendar filtering
- Local persistence through browser storage
- iCalendar export for sharing or importing into other calendar tools
- Empty states that guide first-time setup

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Radix UI primitives
- Framer Motion
- date-fns

## Local development

### Prerequisites

- Node.js 20.19+ (or 22.12+)
- npm

### Install

```bash
npm install
```

### Start the dev server

```bash
npm run dev
```

### Available scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run kill
npm run optimize
```

## How it works

1. Add family members and assign each person a distinct color.
2. Create events with date, time, description, and one or more assigned family members.
3. Scan the month view to see upcoming plans.
4. Filter the calendar to focus on one person or a subset of the family.
5. Export events as an `.ics` file when you need to move the schedule elsewhere.

## Project structure

```text
src/
  components/      React feature components and UI primitives
  hooks/           Reusable hooks, including local storage state
  lib/             Calendar, storage, export, and shared types
  styles/          Theme tokens and global styles
specs/             Feature specifications and implementation planning
```

## Roadmap

The repository already includes specs for planned work such as:

- ICS calendar subscriptions
- Local storage backend improvements
- Node.js version upgrades
- GitHub Actions CI/CD
- Testing framework and TDD workflow
- Recurring events
- Event locations
- RSVP support
- Week and day views
- Self-hosted family profiles

## Development notes

- Shared domain types live in `src/lib/types.ts`.
- Persistent client state is stored via the local storage hooks and storage helpers.
- The repo uses `specs/` for feature planning and `bd` for local issue tracking.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
