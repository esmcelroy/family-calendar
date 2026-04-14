# Feature Specification: Week & Day Calendar Views

**Feature Branch**: `010-week-day-views`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: Add week view and day view calendar modes alongside existing month view

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View the Full Week at a Glance (Priority: P1)

A user switches from month view to week view and sees all events for the current week laid out in a 7-column grid with visible time slots, making time conflicts obvious at a glance.

**Why this priority**: Month view is too compressed to see time-of-day conflicts; week view is the most commonly used calendar mode for planning.

**Independent Test**: Switch to week view. Add two overlapping events on the same day at the same time. Confirm both are visible and their overlap is indicated.

**Acceptance Scenarios**:

1. **Given** the month view is active, **When** the user clicks "Week", **Then** the calendar switches to show the current week with 7 day columns and time-slot rows.
2. **Given** week view is active, **When** an event spans a time period, **Then** the event block is positioned at the correct time row and has a height proportional to its duration.
3. **Given** two events on the same day overlap in time, **When** week view is active, **Then** both events are visible side-by-side (not hidden behind each other).
4. **Given** week view is active, **When** the user clicks previous/next, **Then** the view shifts by one week at a time.

---

### User Story 2 - View a Single Day in Detail (Priority: P2)

A user switches to day view for a specific date and sees all events for that day in a full time-slot layout, making it easy to see exactly when each event starts and ends.

**Why this priority**: Day view is critical for busy days where week view becomes too dense.

**Independent Test**: Navigate to a day with 5+ events. Switch to day view. Confirm all events are positioned at their correct times with no overlap or clipping.

**Acceptance Scenarios**:

1. **Given** the user clicks a date in month or week view, **When** they select "Day view" or click into the day, **Then** the calendar switches to a single-day time-slot view.
2. **Given** day view is active, **When** events are shown, **Then** each event shows its title, time, and assigned member color.
3. **Given** day view is active, **When** no events exist for the day, **Then** the time grid is shown with an empty-state prompt.
4. **Given** day view is active, **When** the user clicks previous/next, **Then** the view shifts by one day.

---

### User Story 3 - Navigate Between Views Consistently (Priority: P3)

The active view mode (month/week/day) is remembered as the user navigates dates, so switching months does not unexpectedly reset the view.

**Why this priority**: View persistence is a basic usability expectation of any calendar app.

**Independent Test**: Switch to week view. Navigate forward 3 weeks. Confirm the app stays in week view and the correct week is displayed.

**Acceptance Scenarios**:

1. **Given** the user is in week view, **When** they navigate forward/back, **Then** the view stays in week mode.
2. **Given** the user switches views, **When** they switch from month → week → day, **Then** the same date context is used for the new view.
3. **Given** the user refreshes the page, **When** the app reloads, **Then** the previously selected view mode is restored.

---

### Edge Cases

- What if an event has no time set (all-day event)? All-day events appear in a banner row at the top of the column for that day in week/day view, not in the timed grid.
- What if there are more than 5 overlapping events in a time slot? Stack them in a scrollable container; do not truncate below a minimum readable width.
- What if the user is on mobile and week view is too compressed? On narrow viewports, week view collapses to a 3-day view or falls back to day view with swipe navigation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A view switcher control MUST allow toggling between Month, Week, and Day views.
- **FR-002**: Week view MUST display 7 day columns and time-slot rows for the selected week.
- **FR-003**: Day view MUST display a single-day time-slot grid for the selected date.
- **FR-004**: Events with a start time MUST be positioned at the correct time row, sized proportionally to duration.
- **FR-005**: Events without a time (all-day) MUST be displayed in a distinct all-day banner row.
- **FR-006**: Overlapping events in the same time slot MUST both be visible (side-by-side layout).
- **FR-007**: Navigation controls MUST shift by the correct unit: 1 week in week view, 1 day in day view.
- **FR-008**: The active view mode MUST be persisted and restored on page reload.
- **FR-009**: Existing family member color-coding and filtering MUST work identically in all three views.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can switch between month, week, and day views in a single click/tap.
- **SC-002**: All events visible in month view for a given date are also visible in the corresponding week and day views.
- **SC-003**: Week view renders correctly (no overlapping or clipped events) for a week containing 20+ events.
- **SC-004**: The active view is restored correctly after a page reload.

## Assumptions

- Events that span multiple days will be rendered as a stretch across columns; the multi-day end-date field may require a separate data model extension.
- The initial implementation uses fixed-height time slots (e.g., 1 hour = 60px); drag-to-resize and drag-to-move are out of scope for v1.
- The month view component is retained unchanged; week and day views are new components added alongside it.
