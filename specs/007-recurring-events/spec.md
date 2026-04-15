# Feature Specification: Recurring Events

**Feature Branch**: `007-recurring-events`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: Add recurring event support with daily, weekly, monthly, and custom repeat patterns

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a Recurring Event (Priority: P1)

A parent wants to add "Soccer practice every Saturday" once and have it appear on every relevant Saturday in the calendar without re-entering it each week.

**Why this priority**: Single-entry recurring events represent the majority of family calendar entries; without recurrence the app misses most real-world usage.

**Independent Test**: Create an event with "Repeat: Weekly, every Saturday". Navigate forward several months in the calendar. Confirm the event appears each Saturday.

**Acceptance Scenarios**:

1. **Given** the event creation form, **When** the user enables recurrence and selects "weekly on Saturday", **Then** the event is saved with recurrence rules.
2. **Given** a saved weekly recurring event, **When** the user navigates forward 3 months, **Then** the event appears on every matching Saturday.
3. **Given** a recurring event on the calendar, **When** the user clicks one instance, **Then** the detail view shows it is a recurring event and displays the recurrence pattern in plain language.

---

### User Story 2 - Edit or Delete a Recurring Event (Priority: P2)

A user changes or cancels one occurrence of a recurring series (e.g., soccer is cancelled this week) without affecting the entire series.

**Why this priority**: Real-world schedules change; users must be able to modify individual occurrences without disrupting the rest of the series.

**Independent Test**: Open one occurrence of a recurring event. Edit the title. Confirm only that occurrence changed. Confirm all other occurrences still show the original title.

**Acceptance Scenarios**:

1. **Given** a recurring series, **When** the user edits one occurrence, **Then** they are asked whether to edit "This event", "This and following events", or "All events".
2. **Given** a user chooses "This event" and edits it, **Then** only that occurrence is changed; all other instances remain unchanged.
3. **Given** a user deletes one occurrence, **Then** that date is removed from the calendar; the rest of the series continues.
4. **Given** a user chooses "All events" and edits, **Then** every occurrence in the series reflects the change.

---

### User Story 3 - Set a Recurrence End Date or Count (Priority: P3)

A user can specify that a recurring event ends after a certain date or after a given number of occurrences (e.g., "8-week soccer season ends July 15").

**Why this priority**: Open-ended series bloat the calendar indefinitely; end conditions make the data manageable.

**Independent Test**: Create an event that repeats weekly, ending after 8 occurrences. Confirm exactly 8 instances appear across the calendar and none appear after the 8th.

**Acceptance Scenarios**:

1. **Given** a recurring event being created, **When** the user sets "End after 8 occurrences", **Then** exactly 8 instances are generated.
2. **Given** a recurring event with an end date set, **When** the user navigates past the end date, **Then** no instances appear after that date.
3. **Given** no end condition is set, **When** the user creates the event, **Then** the system generates instances up to a reasonable horizon (e.g., 2 years) and does not generate unbounded data.

---

### Edge Cases

- What happens when a recurring event's date falls on a month without that day (e.g., "monthly on the 31st" in February)? Skip that month — do not shift to the nearest valid date.
- What happens when the user deletes the first instance of a series? Prompt whether to delete "this event" or "all events"; deleting all removes the entire series.
- What happens when recurrence is disabled on an existing recurring event? All future occurrences are removed; past occurrences (already rendered on the calendar) are retained as independent one-off events.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The event creation and edit form MUST include an optional recurrence section.
- **FR-002**: Supported recurrence frequencies MUST include: Daily, Weekly (one or more selected days), Monthly (by day of month), and Yearly.
- **FR-003**: Recurrence MUST support an end condition: no end (bounded to a 2-year horizon), end by date, or end after N occurrences.
- **FR-004**: The calendar grid MUST display individual occurrences of recurring events on their respective dates.
- **FR-005**: When editing or deleting an occurrence, the user MUST be offered options: "This event", "This and following events", or "All events".
- **FR-006**: Individual occurrences that have been independently modified MUST be visually distinguishable from unmodified series instances (e.g., an indicator icon).
- **FR-007**: Recurring event data MUST be persisted in a format that can be serialized to `localStorage` without circular references.

### Key Entities

- **RecurrenceRule**: Defines the pattern. Attributes: frequency (daily/weekly/monthly/yearly), interval (every N periods), selectedDays (for weekly), endType (none/date/count), endDate (optional), endCount (optional).
- **RecurringEvent**: A `CalendarEvent` with an attached `RecurrenceRule`. Extended with: `seriesId` (links all occurrences), `seriesExceptions` (array of dates or overridden instances).
- **EventException**: An individual occurrence that has been modified or deleted. Attributes: date, type (modified/deleted), overrides (partial event fields).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a weekly recurring event and have it correctly displayed for the next 52 weeks in under 2 seconds.
- **SC-002**: Modifying a single occurrence takes no more steps than editing a regular event.
- **SC-003**: Recurring events survive a page reload with all occurrences intact.
- **SC-004**: Deleting a single occurrence removes only that instance; the series continues unaffected.

## Assumptions

- RRULE/iCalendar-format recurrence is not required for initial storage; a simplified internal format is acceptable as long as it can be converted to RRULE for the ICS export feature (spec 001).
- Expansion of recurring events is computed client-side on load, up to a 2-year horizon.
- "Custom" recurrence patterns (e.g., every 3rd Tuesday of the month) are out of scope for v1; only standard daily/weekly/monthly/yearly patterns are required.
