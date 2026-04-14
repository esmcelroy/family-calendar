# Implementation Plan: ICS Calendar Subscriptions

**Branch**: `001-ics-calendar-subscriptions` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-ics-calendar-subscriptions/spec.md`

## Summary

Allow the family calendar to subscribe to external ICS calendar URLs and display their events on the grid. Separately, produce a merged ICS feed (as a downloadable export) that aggregates all subscription events with VALARM components stripped — enabling users to share or import the merged calendar into third-party clients.

## Technical Context

**Language/Version**: TypeScript (strict, existing)  
**Primary Dependencies**: React 18, shadcn/ui, Tailwind CSS, @phosphor-icons/react, `useKV` (Spark KV), `ical.js` (ICS parsing — to be added)  
**Storage**: Spark `useKV` (persisted KV store) for subscription metadata; parsed events held in React state  
**Testing**: Manual / browser  
**Target Platform**: Browser (GitHub Spark app)  
**Performance Goals**: Subscription events visible within 3s of page load; merged ICS export generated client-side in < 500ms for typical calendar sizes  
**Constraints**: Browser-only runtime; no custom backend. ICS fetching is subject to CORS — app uses a configurable CORS proxy URL (stored in KV, defaulting to a known public proxy or a Spark-hosted proxy path). Export is a client-side downloaded `.ics` file rather than a live-hosted subscription URL (browser cannot serve persistent HTTP endpoints).  
**Scale/Scope**: Typical household: 2–10 ICS subscriptions, each with up to ~500 events

## Constitution Check

- [x] **Component-Driven Architecture** — New UI lives in `src/components/IcsSubscriptionsSheet.tsx` (shadcn/ui Sheet); utility logic in `src/lib/ics.ts`
- [x] **TypeScript Strictness** — New types added to `src/lib/types.ts`; no `any`
- [x] **Accessibility First** — Sheet uses Radix Dialog base; filter chips follow existing pattern; keyboard-navigable
- [x] **Local-First Data Persistence** — Subscriptions persisted via `useKV`; fetched event data regenerated on load
- [x] **Simplicity & YAGNI** — `ical.js` is the only new dependency; no backend

**GATE RESULT**: PASS — proceed to implementation.

## Research Findings

### ICS Parsing

`ical.js` (npm `ical.js`, ~20kB minified) is the canonical browser-safe ICS/vCalendar parser. It handles RRULE, VTIMEZONE, VEVENT, VALARM, multi-line folding, and Unicode. Alternative: hand-roll a minimal regex parser — rejected because RRULE and timezone handling are error-prone and `ical.js` has thorough coverage of RFC 5545.

### CORS Handling Strategy

External ICS URLs cannot be fetched directly from a browser due to CORS. Chosen approach:
1. Try direct `fetch` (works for servers that set `Access-Control-Allow-Origin: *`)  
2. On CORS failure, prefix the URL with a configurable proxy base (default: `https://corsproxy.io/?`), retry once  
3. Store the proxy base in KV so power users can override it

This keeps the feature working for the common case (e.g., Google Calendar public ICS URLs), is transparent about failures, and requires zero backend changes.

### ICS Export Strategy

A Spark browser app cannot expose a persistent HTTP endpoint for calendar clients to subscribe to. Instead:
- Generate the merged ICS as a string in the browser
- Offer a **Download .ics** button (downloads `family-calendar.ics`)
- Show the raw ICS text in a copyable code block for manual import

This is honest about what a browser app can deliver. A future Spark server-route feature (if available) could upgrade this to a true subscription URL without spec changes.

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
- `App.tsx` — wire `useKV<IcsSubscription[]>('ics-subscriptions', [])`, pass to sheet, fetch events on mount and subscription save

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
