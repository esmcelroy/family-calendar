# Implementation Plan: ICS Calendar Subscriptions

**Branch**: `001-ics-calendar-subscriptions` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-ics-calendar-subscriptions/spec.md`

## Summary

Allow the family calendar to subscribe to external ICS calendar URLs and display their events on the grid. In local mode, produce a merged downloadable ICS export with VALARM components stripped. A stable live subscription feed is deferred to the optional backend track (#129).

## Technical Context

**Language/Version**: TypeScript (strict, existing)  
**Primary Dependencies**: React, shadcn/ui, Tailwind CSS, @phosphor-icons/react, `ical.js` (ICS parsing)

**Storage**: `useLocalStorage` backed by the centralized `StorageAdapter` for subscription metadata; parsed events held in transient React state

**Testing**: Vitest and React Testing Library, plus calendar-client import checks

**Target Platform**: Browser (standalone Vite app)
**Performance Goals**: Subscription events visible within 3s of page load; merged ICS export generated client-side in < 500ms for typical calendar sizes  
**Constraints**: Current delivery is browser-only. ICS fetching is subject to CORS; any proxy must be explicitly configured, with no default public proxy and no automatic forwarding of credentials. Export is a client-side downloaded `.ics` file; a persistent live feed requires the optional backend.

**Scale/Scope**: Typical household: 2–10 ICS subscriptions, each with up to ~500 events

## Constitution Check

- [x] **Component-Driven Architecture** — New UI lives in `src/components/IcsSubscriptionsSheet.tsx` (shadcn/ui Sheet); utility logic in `src/lib/ics.ts`
- [x] **TypeScript Strictness** — New types added to `src/lib/types.ts`; no `any`
- [x] **Accessibility First** — Sheet uses Radix Dialog base; filter chips follow existing pattern; keyboard-navigable
- [x] **Local-First Data Persistence** — Subscriptions persisted via `useLocalStorage`/`StorageAdapter`; fetched event data regenerated on load
- [x] **Simplicity & YAGNI** — `ical.js` is the only new dependency; no backend

**GATE RESULT**: PASS — proceed to implementation.

## Research Findings

### ICS Parsing

`ical.js` (npm `ical.js`, ~20kB minified) is the canonical browser-safe ICS/vCalendar parser. It handles RRULE, VTIMEZONE, VEVENT, VALARM, multi-line folding, and Unicode. Alternative: hand-roll a minimal regex parser — rejected because RRULE and timezone handling are error-prone and `ical.js` has thorough coverage of RFC 5545.

### CORS Handling Strategy

External ICS URLs can be fetched directly when the source permits browser cross-origin access. Chosen approach:
1. Try direct `fetch`.
2. On a network/CORS failure, retry once only if a proxy was explicitly configured and the source is safe to forward. Browser fetch cannot reliably distinguish CORS denial from other network failures.
3. Persist an explicitly configured proxy base through localStorage. Treat private feed URLs as sensitive; never automatically forward URL-embedded credentials to a proxy.

For supported URL-embedded basic authentication, extract credentials for the direct request rather than passing a credential-bearing URL to browser `fetch`. Surface fetch/authentication failures clearly. A service worker does not bypass source-server CORS policy.

### ICS Export Strategy

A browser-only app cannot expose a persistent HTTP endpoint for calendar clients to subscribe to. In local mode:
- Generate the merged ICS as a string in the browser
- Offer a **Download .ics** button (downloads `family-calendar.ics`)
- Show the raw ICS text in a copyable code block for manual import

The user confirmed that a stable live merged feed belongs to the optional backend track (#129). Backend planning must define feed access and refresh behavior; it is not a deliverable of the browser-only phases below.

### VALARM Stripping

`ical.js` JCAL representation: each VEVENT component has sub-components. Remove all sub-components where `comp.name === 'valarm'` before re-serialising. The re-serialisation uses `ICAL.stringify()` (built into `ical.js`).

## Project Structure

### Documentation (this feature)

```text
specs/001-ics-calendar-subscriptions/
├── spec.md
├── plan.md              ← This file
└── checklists/
    └── requirements.md
```

### Source Code (additions)

```text
src/
├── lib/
│   ├── types.ts          ← Add IcsSubscription type
│   └── ics.ts            ← New: ICS parsing, fetching, merging, export  
└── components/
    ├── IcsSubscriptionsSheet.tsx   ← New: manage subscriptions UI
    └── CalendarGrid.tsx            ← Modify: render subscription events
App.tsx                             ← Add subscription state, filter chips, export button
```

## Complexity Tracking

No constitution violations. All additions are single-responsibility components and utilities.

## Implementation Phases

### Phase 1: Foundation — Data Types & ICS Utilities

Add the `IcsSubscription` type and the `src/lib/ics.ts` module.

**Deliverables**:
- `IcsSubscription` and `SubscribedEvent` types in `src/lib/types.ts`
- `src/lib/ics.ts`: `fetchAndParseIcs(url, corsProxy)`, `mergeAndStripAlarms(subscriptions, eventsMap)`, `exportToIcsString(events)`

---

### Phase 2: Subscription Management UI — User Story 1 (P1)

Build the sheet for adding, listing, and removing ICS subscriptions.

**Deliverables**:
- `src/components/IcsSubscriptionsSheet.tsx` — shadcn Sheet with form (URL, display name, color picker), subscription list, remove button, error badge
- `App.tsx` — wire `useLocalStorage<IcsSubscription[]>('ics-subscriptions', [])`, pass to sheet, fetch events on mount and subscription save

**Checkpoint**: User can add a public ICS URL and see events on the calendar grid.

---

### Phase 3: Calendar Grid Integration — User Story 1 (P1)

Render subscription events on the grid, visually distinct from family events.

**Deliverables**:
- `CalendarGrid.tsx` — accept `subscribedEvents: SubscribedEvent[]` prop; render with subscription color + italic/badge indicator
- Filter chips in App header: subscriptions appear alongside family member chips (same toggle pattern)

---

### Phase 4: Merged ICS Export — User Story 2 (P2)

Generate the merged, alarm-stripped ICS and provide download + copy UI.

**Deliverables**:
- Export button in App header (or inside the subscriptions sheet)
- `exportToIcsString()` called in handler; `VALARM` stripped
- File download via `Blob` + `URL.createObjectURL`
- Copyable raw ICS textarea fallback

**Checkpoint**: User can download a `.ics` file containing all subscription events, no alarms.

---

### Phase 5: Display Customisation — User Story 3 (P3)

Color and label assignment per subscription (likely already covered by Phase 2's form).

**Deliverables**:
- Confirm subscription color is persisted and applied throughout grid + filter chips
- Edit flow in subscriptions sheet (edit name/color of existing subscription)

---

## Dependencies & Libraries

| Item | Action | Rationale |
|------|--------|-----------|
| `ical.js` | `npm install ical.js` | Browser-safe RFC 5545 ICS parser with RRULE support |
| `@types/ical.js` | `npm install -D @types/ical.js` if no bundled types | TypeScript support |

No other new dependencies.
