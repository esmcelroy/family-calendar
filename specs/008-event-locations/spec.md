# Feature Specification: Event Locations

**Feature Branch**: `008-event-locations`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: Add location field to events with map link integration and display on event cards

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a Location to an Event (Priority: P1)

When creating or editing an event, a family member can type a location (address, venue name, or landmark) and save it as part of the event.

**Why this priority**: Location is the most commonly missing piece of context when coordinating pickups, drop-offs, and meetings.

**Independent Test**: Create an event with location "Lincoln Elementary School, 123 Main St". Open the event detail view. Confirm the location is displayed.

**Acceptance Scenarios**:

1. **Given** the event creation form, **When** the user types a location and saves, **Then** the location is stored with the event.
2. **Given** an existing event with no location, **When** the user edits and adds a location, **Then** the updated event displays the new location.
3. **Given** a location is not provided, **When** the event is saved, **Then** it saves successfully and no empty location field is shown in the detail view.

---

### User Story 2 - View Location in Event Details and Get Directions (Priority: P2)

When a family member opens an event, the location is prominently shown and tapping or clicking it opens the location in a mapping app or service.

**Why this priority**: The most common follow-on action after reading a location is navigating to it.

**Independent Test**: Open an event with a location. Click the location. Confirm it opens in a mapping service.

**Acceptance Scenarios**:

1. **Given** an event with a location, **When** the user opens the detail view, **Then** the location is displayed clearly with an icon.
2. **Given** the location is displayed, **When** the user clicks or taps it, **Then** the device's default mapping application or a web mapping service opens with the location pre-filled.
3. **Given** an event with no location, **When** the user opens the detail view, **Then** no location row or empty placeholder is shown.

---

### User Story 3 - See Location on Calendar Event Card (Priority: P3)

On the calendar grid, events with a location display a subtle location indicator so the user knows at a glance that location info is available.

**Why this priority**: A visual cue reduces the need to open every event to check for location info.

**Independent Test**: Add a location to an event. View the calendar grid. Confirm the event card shows a map pin icon or similar indicator.

**Acceptance Scenarios**:

1. **Given** an event on the calendar grid with a location, **When** the calendar is viewed, **Then** a map pin icon or label appears on the event card.
2. **Given** an event with no location, **When** the calendar is viewed, **Then** no pin icon is shown.

---

### Edge Cases

- What if the location string is very long? Truncate in the event card view; show full text in the detail view.
- What if the device has no mapping app (desktop browser)? Open the location in a web-based map service (e.g., Google Maps or OpenStreetMap) as the fallback.
- What if the user pastes a maps URL instead of an address? Accept it as-is; display it as the location and open it directly when clicked.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The event creation and edit form MUST include an optional plain-text location input field.
- **FR-002**: The `CalendarEvent` data model MUST be extended with an optional `location` string field.
- **FR-003**: The event detail view MUST display the location when present, with a map pin icon.
- **FR-004**: The location in the detail view MUST be a tappable/clickable link that opens a mapping service with the location pre-filled.
- **FR-005**: Location MUST be included in the ICS export (spec 001) using the standard `LOCATION` property.
- **FR-006**: Event cards on the calendar grid MUST show a visual indicator (icon) when a location is present.
- **FR-007**: Saving an event with an empty location field MUST behave identically to saving an event with no location field (no empty string stored).

### Key Entities

- **`CalendarEvent.location`**: Optional string. Free-text address, venue name, or URL. No geocoding or structured address parsing required.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a location to a new or existing event within the existing event form — no new screens required.
- **SC-002**: Clicking the location in the event detail view opens a mapping service in under 1 second.
- **SC-003**: The location field is preserved across page reloads (persisted in storage).
- **SC-004**: Events without a location display identically to before this feature was added.

## Assumptions

- Location is an unstructured free-text field — no address autocomplete, geocoding, or embedded map preview is required in v1.
- The mapping link uses a query-string approach (e.g., `https://maps.google.com/?q={location}`) without requiring a mapping API key.
- The `LOCATION` ICS field is added to the export as part of this feature; the ICS spec (001) is assumed to be implemented first.
