# Feature Specification: Kiosk / Family Display Mode

**Feature Branch**: `012-kiosk-display-mode`  
**Created**: 2026-04-15  
**Status**: Draft  
**Input**: The app should work as a wall-mounted display (TV, tablet, or monitor in a common area of the home) showing a glanceable, always-on view of the family schedule — no interaction required.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View today's schedule at a glance (Priority: P1)

A family hangs a tablet or old monitor in the kitchen and opens the app in kiosk mode. The display shows the current date and time, today's events in large readable text, and a compact list of upcoming events for the rest of the week — visible from across the room.

**Why this priority**: This is the core value proposition of the kiosk mode. Without a glanceable today view, the feature has no reason to exist.

**Independent Test**: Open kiosk mode on a 1080p display from 3 meters away. The current date, time, and today's event titles should be legible without zooming or interaction.

**Acceptance Scenarios**:

1. **Given** a user navigates to the kiosk route (e.g., `/kiosk`), **When** the page loads, **Then** the display enters a full-screen, read-only layout showing the current date, current time, today's events, and upcoming events for the next 7 days.
2. **Given** kiosk mode is active, **When** there are no events today, **Then** the display shows a friendly empty-state message ("Nothing scheduled today") rather than a blank area.
3. **Given** kiosk mode is active, **When** more events exist for a day than can fit on screen, **Then** the display shows the first N events with a count badge for the rest ("+ 3 more").
4. **Given** kiosk mode is active, **When** the day changes at midnight, **Then** the display automatically updates to show the new current date without requiring a page reload.

---

### User Story 2 - Auto-refresh without user interaction (Priority: P1)

The wall display is left running unattended. It should always show current data — including any new events added from another device — without anyone touching the screen.

**Why this priority**: A display that shows stale data quickly loses the family's trust and stops being used.

**Independent Test**: Add an event on a different device. Within 5 minutes (configurable), the kiosk display should reflect the new event without any user interaction.

**Acceptance Scenarios**:

1. **Given** kiosk mode is active, **When** the auto-refresh interval elapses, **Then** the displayed events silently update to reflect the latest data from localStorage and any active ICS subscriptions.
2. **Given** kiosk mode is active and ICS subscriptions are configured, **When** a subscription URL returns updated data, **Then** new or changed events from that subscription appear on the kiosk display without interaction.
3. **Given** kiosk mode is active, **When** an ICS subscription fetch fails at refresh time, **Then** the display continues showing the last successfully fetched events and shows a subtle, non-alarming indicator (e.g., a small sync warning icon).

---

### User Story 3 - Fullscreen & ambient presentation (Priority: P2)

The display hides all browser chrome and app navigation, showing only calendar content. It should look intentional and polished — not like a website crammed into a browser window.

**Why this priority**: Visual polish is what makes families leave this on vs. closing the tab.

**Independent Test**: Open kiosk mode on a 1920×1080 display. No browser navigation, no app header/sidebar, no scroll bars should be visible. The layout should fill the entire viewport.

**Acceptance Scenarios**:

1. **Given** a user opens the kiosk URL, **When** the page loads, **Then** the app hides all navigation controls, settings buttons, and event editing affordances — the display is purely read-only.
2. **Given** kiosk mode is active, **When** the window is resized or the display orientation changes, **Then** the layout adapts responsively and remains legible.
3. **Given** kiosk mode is active, **When** the user views the display, **Then** the current time is shown with a live clock (updates every minute) and the current date is prominently featured.
4. **Given** kiosk mode is active on a landscape display, **When** events are shown, **Then** the layout uses a two-panel design: today's events on the left (larger), upcoming 7-day list on the right (smaller).

---

### User Story 4 - Filter display by family member (Priority: P3)

A family has configured kiosk mode to show only certain family members (e.g., the whole family's shared events + kids' events, but not work calendars). The display respects a pre-configured filter without requiring the viewer to interact with it.

**Why this priority**: Filtering reduces noise, but it requires persisting a kiosk-specific configuration — adds complexity, hence P3.

**Independent Test**: Configure kiosk mode to show only events for "Kids" and "Shared". Events belonging only to "Mom" or "Dad" should not appear on the kiosk display.

**Acceptance Scenarios**:

1. **Given** a kiosk configuration has been saved with specific member filters, **When** kiosk mode is active, **Then** only events matching the configured members are shown.
2. **Given** no kiosk filter is configured, **When** kiosk mode is active, **Then** all family members' events are shown (default: show all).
3. **Given** a kiosk configuration exists, **When** a user accesses the app settings, **Then** they can update the kiosk filter without disrupting the current kiosk display.

---

### Edge Cases

- **No events this week**: Show friendly empty-state copy for both today and the upcoming list.
- **Very long event titles**: Truncate with ellipsis at a safe character count; show full title in a tooltip on hover (hover is rare on wall displays but possible on touchscreens).
- **ICS subscriptions unreachable**: Degrade gracefully — show last cached data, show a subtle sync warning icon, do not crash or show an error modal.
- **Multiple devices sharing localStorage**: localStorage is per-device. If the kiosk runs on a dedicated device, it will not receive events added on other devices unless the event sync / backend story (spec 011) is in place. Document this clearly.
- **Browser sleep / tab throttling**: Use the Page Visibility API to trigger a refresh when the tab becomes visible again after being backgrounded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST expose a kiosk route (e.g., `/kiosk`) that renders a read-only, full-screen calendar view.
- **FR-002**: The kiosk view MUST display the current date and a live clock updated every minute.
- **FR-003**: The kiosk view MUST show all events for the current day in a prominent, large-text section.
- **FR-004**: The kiosk view MUST show upcoming events for the next 7 days in a secondary section.
- **FR-005**: The kiosk view MUST hide all editing controls (add event, edit, delete, settings, navigation).
- **FR-006**: The kiosk view MUST auto-refresh calendar data at a configurable interval (default: 5 minutes).
- **FR-007**: The kiosk view MUST handle ICS subscription refresh failures gracefully without disrupting the display.
- **FR-008**: The kiosk view MUST use the Page Visibility API to force a refresh when the tab regains focus.
- **FR-009**: The kiosk view MUST be responsive and fill the entire viewport on any common display size (1080p, 1440p, tablet landscape).
- **FR-010**: The kiosk view SHOULD support a pre-configured family-member filter stored in localStorage.

### Key Entities

- **KioskConfig**: Persisted configuration for the kiosk display. Attributes: `memberFilter` (array of member IDs, empty = show all), `refreshIntervalMs` (default: 300000).
- **KioskEvent**: A read-only projection of a CalendarEvent or SubscribedEvent for display purposes. Attributes: `id`, `title`, `startTime`, `endTime`, `date`, `color`, `sourceName`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The kiosk route loads and renders a complete display within 2 seconds on a standard home network connection.
- **SC-002**: Event titles and dates are legible (≥ 18px rendered font size) from a simulated 2-meter viewing distance (CSS zoom test).
- **SC-003**: A new event added via the main app (same or different device, same localStorage) appears on the kiosk display within one refresh cycle (default ≤ 5 minutes).
- **SC-004**: The kiosk display renders correctly on 1920×1080, 1280×800, and 1024×768 viewports without horizontal scroll.
- **SC-005**: The live clock updates at least once per minute without requiring a page reload.

## Assumptions

- The kiosk device runs a modern browser (Chrome, Safari, Firefox) that supports the Page Visibility API and CSS `vh`/`vw` units.
- localStorage is the primary data store until spec 011 (self-hosted backend) is implemented; kiosk-specific data isolation (different device) is a known limitation for v1.
- No authentication is required to view the kiosk route — it is assumed to be on a private home network.
- ICS subscription refresh in kiosk mode uses the same fetch-and-parse logic as the main app.
- The kiosk layout is designed primarily for landscape orientation; portrait support is a nice-to-have.
- Screen savers or OS-level sleep timers on the kiosk device are managed externally (out of scope).
