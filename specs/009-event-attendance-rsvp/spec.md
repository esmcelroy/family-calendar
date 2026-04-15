# Feature Specification: Event Attendance & RSVP

**Feature Branch**: `009-event-attendance-rsvp`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: Track event attendance and RSVP status per family member (going / maybe / not going)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mark Attendance Status for an Event (Priority: P1)

A family member opens an event and marks whether each invited person is Going, Maybe, or Not Going.

**Why this priority**: Knowing who is actually attending is the core value of this feature. It answers the most common question: "Who's coming?"

**Independent Test**: Open an event assigned to two family members. Set member 1 to Going and member 2 to Maybe. Save. Reopen the event. Confirm both statuses are displayed.

**Acceptance Scenarios**:

1. **Given** an event with assigned family members, **When** the user opens the detail view, **Then** each assigned member is shown with an attendance status selector (Going / Maybe / Not Going).
2. **Given** the user selects "Going" for a member and saves, **When** the event is reopened, **Then** the attendance status is persisted correctly.
3. **Given** an event with no assigned members, **When** the user opens the detail view, **Then** no attendance section is displayed.

---

### User Story 2 - See Attendance Summary on Calendar Grid (Priority: P2)

On the calendar grid, an event card shows a compact attendance summary so families can see at a glance who is going without opening the event.

**Why this priority**: Reduces the need to drill into events just to check attendance status.

**Independent Test**: Set two members as Going and one as Not Going on an event. View the calendar grid. Confirm the event card shows a "2 Going" or avatar-style indicator.

**Acceptance Scenarios**:

1. **Given** an event with at least one member with an attendance status set, **When** the calendar grid is viewed, **Then** the event card displays an attendance count or indicator.
2. **Given** an event where all members are Not Going, **When** viewing the calendar, **Then** the card indicates zero attendees or shows an empty/declined state.
3. **Given** an event with no attendance statuses set, **When** viewing the calendar, **Then** the card displays identically to before the feature was added.

---

### User Story 3 - Filter Calendar by Attendance (Priority: P3)

A user can filter the calendar to show only events where a specific family member is Going or Maybe, to build a personal schedule view.

**Why this priority**: Enables a personal "my schedule" view without duplicating data.

**Independent Test**: Set several events with mixed attendance. Enable the attendance filter for one member. Confirm only that member's Going/Maybe events remain visible.

**Acceptance Scenarios**:

1. **Given** the attendance filter is active for a member, **When** viewing the calendar, **Then** only events where that member is Going or Maybe are shown.
2. **Given** the attendance filter is inactive, **When** viewing the calendar, **Then** all events are shown regardless of attendance.

---

### Edge Cases

- What if an event's member list changes after attendance is set? Attendance records for removed members MUST be deleted; new members start with no status (not Going by default).
- What if no attendance status is set for any member? The RSVP section is present but shows an empty/unset state; the event functions normally.
- What is the default attendance status for a newly assigned member? No status set (unset/unknown) — not automatically "Going".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `CalendarEvent` data model MUST be extended with an optional `attendance` map from `memberId` to status (`going` | `maybe` | `not-going` | `unknown`).
- **FR-002**: The event detail view MUST display a per-member attendance section when the event has assigned members.
- **FR-003**: Each assigned member's attendance status MUST be settable from Going, Maybe, Not Going, or left unset.
- **FR-004**: Attendance changes MUST be persisted immediately via the storage utility.
- **FR-005**: The event card on the calendar grid MUST display a compact attendance indicator when at least one member has a status set.
- **FR-006**: The existing family member filter UI MUST be extended to optionally show only events where the selected member is Going or Maybe.
- **FR-007**: When a member is removed from an event, their attendance record for that event MUST be deleted.

### Key Entities

- **`AttendanceStatus`**: Enum value: `going` | `maybe` | `not-going` | `unknown`.
- **`CalendarEvent.attendance`**: Optional map of `memberId → AttendanceStatus`. Absent when no statuses have been set.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can set attendance status for all members of an event in under 30 seconds.
- **SC-002**: Attendance status is retained after a page reload.
- **SC-003**: The calendar grid event card attendance indicator is visible without scrolling or hovering.
- **SC-004**: Removing a member from an event does not leave orphaned attendance data in storage.

## Assumptions

- Attendance is set manually by whoever is using the app — there is no notification or invite system; members do not "respond" to invites.
- The attendance filter (US3) is additive with the existing member visibility filter rather than a separate UI surface.
- RSVP is abbreviated: Going / Maybe / Not Going are sufficient; more detailed status values (Tentative, Awaiting response, etc.) are out of scope for v1.
