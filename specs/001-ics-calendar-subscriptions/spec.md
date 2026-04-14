# Feature Specification: ICS Calendar Subscriptions

**Feature Branch**: `001-ics-calendar-subscriptions`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "allow ics calendar subscriptions, and provide an outputted ics subscription that merges content from all subscribed calendars, stripping notifications for events"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Subscribe to an External ICS Calendar (Priority: P1)

A family member wants to bring in events from an external calendar (e.g., school, sports league, work) by pasting an ICS URL. The app fetches and displays those events alongside the family's own events on the calendar grid.

**Why this priority**: This is the core input half of the feature — without it, there is no data to merge or export.

**Independent Test**: Paste a valid public ICS URL into the subscription manager. The events from that URL should appear on the family calendar grid immediately after saving.

**Acceptance Scenarios**:

1. **Given** the user opens the calendar subscription manager, **When** they enter a valid ICS URL and save it, **Then** events from that calendar appear on the calendar grid attributed to a configurable label/color.
2. **Given** a saved ICS subscription, **When** the user returns to the app, **Then** the subscription and its events are still present (persisted across sessions).
3. **Given** the user has one or more saved subscriptions, **When** they open the subscription manager, **Then** they can see a list of their subscriptions and remove any of them.
4. **Given** the user enters a URL that cannot be fetched or parsed as valid ICS, **When** they attempt to save, **Then** they receive a clear error message and the subscription is not saved.

---

### User Story 2 - View a Merged, Exportable ICS Feed (Priority: P2)

A family member wants a single ICS URL they can subscribe to from any calendar app (e.g., Apple Calendar, Google Calendar) that reflects all events from all subscribed ICS feeds — without any alarm/notification data.

**Why this priority**: This is the output half of the feature. It delivers the merged, notification-stripped ICS feed that allows the family calendar to act as an aggregator for other calendar clients.

**Independent Test**: Add at least one ICS subscription containing one or more VALARM components. Open the exported feed URL. Confirm all events from the subscription appear and no VALARM components are present.

**Acceptance Scenarios**:

1. **Given** the user has at least one ICS subscription saved, **When** they access the exported ICS feed URL, **Then** the feed contains all events from all subscribed calendars in valid ICS format.
2. **Given** one or more source calendars contain events with VALARM (alarm/notification) components, **When** those events are included in the exported feed, **Then** all VALARM components are stripped from the output.
3. **Given** the user has no subscriptions saved, **When** they access the exported ICS feed URL, **Then** the feed is a valid but empty ICS calendar.
4. **Given** the exported ICS feed URL, **When** a third-party calendar client subscribes to it, **Then** events are displayed correctly in that client.

---

### User Story 3 - Manage Subscription Display (Priority: P3)

A family member wants to assign a name and color to each ICS subscription so they can visually distinguish events from different external calendars on the grid.

**Why this priority**: Improves usability and visual clarity but is not required for core functionality.

**Independent Test**: Add two ICS subscriptions with different colors. Confirm events from each source are rendered with the assigned color on the calendar grid.

**Acceptance Scenarios**:

1. **Given** the user is adding or editing a subscription, **When** they set a display name and color, **Then** events from that subscription appear with the chosen color and label on the calendar.
2. **Given** a subscription has been assigned a color, **When** it appears in the existing family member filter UI, **Then** the subscription can be toggled on/off with the same filter controls used for family members.

---

### Edge Cases

- What happens when a subscribed ICS URL becomes unreachable after being saved? The subscription remains in the list; previously fetched events may be shown stale or a soft error is displayed.
- What happens when two subscribed calendars contain events with the same UID? Duplicate UIDs are de-duplicated in the merged output feed (last source wins, or first encountered wins).
- What happens when a subscribed ICS contains recurring events (RRULE)? Recurring rules are preserved as-is in the merged output; expansion is not required.
- What happens when the ICS URL requires authentication? URL-embedded credentials (basic auth in URL) are the only supported mechanism; prompting for credentials is out of scope for v1.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to add an ICS subscription by providing a URL, a display name, and an optional color.
- **FR-002**: The system MUST fetch and parse the ICS data from each subscription URL and display those events on the calendar grid.
- **FR-003**: Subscriptions MUST be persisted across sessions so events are available on subsequent visits.
- **FR-004**: Users MUST be able to view, edit, and remove saved ICS subscriptions.
- **FR-005**: The system MUST expose a single merged ICS feed URL that aggregates events from all saved subscriptions.
- **FR-006**: The merged ICS output feed MUST strip all VALARM components from every event before including it.
- **FR-007**: The merged ICS output feed MUST be accessible via a stable, shareable URL without requiring authentication to read.
- **FR-008**: The merged ICS output feed MUST be valid RFC 5545-compliant ICS data.
- **FR-009**: Subscription events MUST be visually distinguishable from family-created events on the calendar grid.
- **FR-010**: When a subscribed ICS URL cannot be fetched, the system MUST surface an error indicator for that subscription without removing it.

### Key Entities *(include if feature involves data)*

- **ICS Subscription**: A saved external calendar source. Attributes: unique ID, URL, display name, color, enabled/disabled state, last-fetched timestamp, last-fetch error (optional).
- **Subscribed Event**: A calendar event imported from an ICS subscription. References the source subscription ID; is read-only (cannot be edited by the user).
- **Merged ICS Feed**: The generated output calendar. No persistent state — computed on request from all active subscriptions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a new ICS subscription and see its events on the calendar grid within 5 seconds of saving.
- **SC-002**: The exported merged ICS feed is accepted as a valid subscription by at least two major calendar clients (e.g., Apple Calendar, Google Calendar).
- **SC-003**: No VALARM components appear in the exported merged ICS feed, regardless of whether source calendars include them.
- **SC-004**: Users can add, view, and remove subscriptions entirely within the existing app UI without needing to leave the page.
- **SC-005**: Subscription data survives a full page reload and re-fetch.

## Assumptions

- The app runs in a browser environment; ICS fetching from external URLs must be handled in a way that avoids CORS issues (e.g., via a proxy or service worker). A simple proxy endpoint is assumed to be feasible.
- The exported ICS feed URL is served from the same host as the application and does not require a separate backend deployment beyond what the app already uses.
- Support for recurring events (RRULE, EXDATE, etc.) in the merged output is limited to pass-through — the system copies recurring event definitions without expanding them.
- Mobile/responsive support for the subscription management UI follows the same responsive approach already used by the rest of the app.
- ICS subscriptions are shared across the family (i.e., all users of the same app instance see the same subscriptions); per-member subscription ownership is out of scope for v1.
- Authentication-protected ICS feeds are out of scope for v1, except for credentials embedded directly in the URL.
