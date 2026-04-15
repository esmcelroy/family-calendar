# Feature Specification: Event Invitations & Multi-Platform Calendar Delivery

**Feature Branch**: `013-event-invitations-delivery`
**Created**: 2026-04-15
**Status**: Draft
**Input**: When a family event is created or changed, family members should receive it in their own personal calendar app — regardless of whether they use Google Calendar, Apple Calendar, Outlook, or any other iCalendar-compatible client. Subscribing to an ICS feed is passive (pull); this feature is active (push).

## Background & Problem Statement

The shared family calendar today is a **read-only aggregator**: family members can see the calendar in the app or subscribe to its ICS export feed. However, when an organiser *creates* a new event, nothing proactively lands in anyone's personal calendar. The recipient must already be subscribed and must open their calendar app to discover the new event.

This gap is significant for real family coordination:

- A parent creates "Soccer practice — Saturday 9am, bring Alice" and wants Alice's iPhone calendar and Dad's Outlook to both reflect it automatically.
- There is no universal push mechanism for calendar apps, but **RFC 5546 iMIP** (Internet Message-based iCalendar Profile) is the widely-supported standard: send an email with an `.ics` attachment (`METHOD:REQUEST`) and virtually every calendar app will offer to add or auto-add the event.
- For Google Calendar users, a deep-link URL provides a frictionless "Add to Google Calendar" button.

This spec covers:
1. Per-member delivery preferences (email address + preferred calendar platform)
2. Sending iMIP-compliant email invitations when events are created, updated, or cancelled
3. "Add to Google Calendar" convenience links for GCal users
4. A lightweight outbound email capability (configurable SMTP or mailto fallback)

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send an event invitation to family members via email (Priority: P1)

An organiser creates a new event and selects family members to invite. Those members receive an email with an `.ics` attachment they can accept into their own calendar app (Google Calendar, Apple Calendar, Outlook, Thunderbird, etc.).

**Why this priority**: This is the foundational push mechanism. Without it, no other delivery method works.

**Independent Test**: Create an event, assign two family members. Both members' email addresses should receive an email within 60 seconds containing a valid `.ics` file with `METHOD:REQUEST`. Importing that `.ics` into Apple Calendar and Outlook should produce a correctly timed event.

**Acceptance Scenarios**:

1. **Given** an event is created with one or more family members assigned, **When** the organiser saves the event, **Then** each assigned member who has an email address configured receives an email with an `.ics` attachment (`METHOD:REQUEST`).
2. **Given** the email is received, **When** the recipient opens it in any major email client (Gmail, Apple Mail, Outlook), **Then** the client presents a "Add to Calendar" prompt or automatically adds the event to the recipient's calendar.
3. **Given** an event is updated (title, time, or date changed), **When** the organiser saves the update, **Then** affected members receive a follow-up email with `METHOD:REQUEST` (updated sequence number) so their calendar apps update the existing event rather than creating a duplicate.
4. **Given** an event is cancelled, **When** the organiser deletes it, **Then** assigned members receive an email with `METHOD:CANCEL` so their calendar apps remove the event.
5. **Given** a family member has no email address configured, **When** an event is created including that member, **Then** the system skips sending for that member and surfaces a gentle warning: "Alice has no email address — no invitation sent."

---

### User Story 2 - "Add to Google Calendar" convenience link (Priority: P2)

A family member who uses Google Calendar can click a single link in the invitation email (or copy it from the event detail view) to add the event to their GCal without needing to process the `.ics` file.

**Why this priority**: GCal's `.ics` import flow is more cumbersome than its web URL scheme; a convenience link significantly reduces friction for GCal users.

**Independent Test**: Create an event with a title, date, time, and description. The generated GCal URL should open a pre-filled "Add to Google Calendar" form with all fields correctly populated when opened in a browser.

**Acceptance Scenarios**:

1. **Given** an event detail view is open, **When** the user clicks "Add to Google Calendar", **Then** a browser tab opens to `https://calendar.google.com/calendar/render?action=TEMPLATE&...` pre-filled with the event title, start/end datetime, and description.
2. **Given** a family member's delivery preference is set to "Google Calendar", **When** an invitation email is sent to them, **Then** the email body includes both the `.ics` attachment AND a prominent "Add to Google Calendar" button/link.
3. **Given** an all-day event is created, **When** the GCal URL is generated, **Then** the URL uses the correct date-only format (YYYYMMDD) rather than a datetime, producing a correctly formatted all-day event in GCal.

---

### User Story 3 - Configure per-member delivery preferences (Priority: P2)

Each family member can have a delivery preference stored: their email address and their preferred calendar platform. The app uses this to personalise the invitation email (e.g., include the GCal link for GCal users, omit it for Outlook users).

**Why this priority**: Personalisation improves adoption; members whose preferred client is represented feel the app "speaks their language".

**Independent Test**: Set family member "Dad" to `email: dad@example.com`, preferred platform: "Outlook". Set "Mom" to `email: mom@example.com`, preferred platform: "Google Calendar". Create an event assigning both. Mom's email should include the GCal link; Dad's should not.

**Acceptance Scenarios**:

1. **Given** a user opens the family member settings for a member, **When** they enter an email address and select a preferred calendar platform, **Then** those preferences are saved and displayed on the member's settings panel.
2. **Given** a member's preferred platform is "Google Calendar", **When** an invitation is sent, **Then** the email body includes an "Add to Google Calendar" link.
3. **Given** a member's preferred platform is "Apple Calendar" or "Outlook" or "Other", **When** an invitation is sent, **Then** the email body does not include a GCal link; it instructs the recipient to open the attached `.ics` file.
4. **Given** a member has an email address but no preferred platform set, **When** an invitation is sent, **Then** the email includes the `.ics` attachment and generic "open with your calendar app" instructions.
5. **Given** a user removes a member's email address, **When** events are subsequently created, **Then** no invitation is sent for that member and the warning from US1 scenario 5 appears.

---

### User Story 4 - Configurable outbound email transport (Priority: P2)

The app needs a way to actually send email. For families with a home server or developer setup, a configured SMTP server is preferred. As a universal fallback with no server required, the app generates a pre-filled `mailto:` link that opens the organiser's own email client.

**Why this priority**: Without a transport, invitations can't be sent. The mailto fallback ensures the feature works for all users with no infrastructure.

**Independent Test (mailto fallback)**: With no SMTP configured, create an event with an assigned member. The app should open a `mailto:` link pre-addressed to the member with the `.ics` file content in the email body or as an attachment, ready for the organiser to send manually.

**Independent Test (SMTP)**: Configure a valid SMTP server (e.g., Gmail App Password, Mailgun SMTP). Create an event. The email should arrive in the recipient's inbox within 60 seconds without any manual action from the organiser.

**Acceptance Scenarios**:

1. **Given** no SMTP server is configured, **When** an invitation needs to be sent, **Then** the app opens a `mailto:` link in the organiser's default email client with the recipient pre-filled and the `.ics` content available to send.
2. **Given** an SMTP server is configured (host, port, username, password), **When** an invitation needs to be sent, **Then** the app sends the email automatically via the configured SMTP server without organiser intervention.
3. **Given** the SMTP configuration is invalid or the server is unreachable, **When** sending fails, **Then** the app surfaces a clear error with the option to retry or fall back to the `mailto:` method.
4. **Given** a user opens app settings, **When** they navigate to the "Email / Delivery" section, **Then** they can enter and save SMTP credentials, test the connection, and see the current delivery transport status.

---

### Edge Cases

- **Recurring events**: Sending `METHOD:REQUEST` for the entire recurring series (RRULE intact) is the correct iMIP approach for series-level invitations. Instance-level edits send `METHOD:REQUEST` with `RECURRENCE-ID` for the specific instance.
- **Duplicate invitations**: If an event is saved multiple times in quick succession (e.g., two rapid clicks), debounce invitation sending — only one email per event creation/update.
- **Reply handling (RSVP)**: iMIP supports `METHOD:REPLY` (the recipient RSVPs back). For v1, replies are not processed by the app; the organiser receives them in their personal email inbox. Full RSVP tracking is deferred to a future spec.
- **Large attachments**: `.ics` files for single events are tiny (< 2 KB). No size concern in practice.
- **Email deliverability**: If using a personal SMTP server or `mailto:` fallback, emails may be marked as spam. This is an infrastructure concern outside the app's control; the spec should document best practices (SPF, DKIM).
- **Organiser self-invitation**: If the organiser is also assigned to the event, they should not receive an invitation email for an event they just created. Filter the organiser out of the recipient list.
- **No backend yet (spec 011 not done)**: The iMIP email sending must work either via a serverless function co-deployed with the app OR via the `mailto:` fallback. Direct SMTP from a browser is not possible; a lightweight server-side endpoint is required for the automated transport.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each family member record MUST support an optional email address and an optional preferred calendar platform (Google Calendar, Apple Calendar, Outlook, Other).
- **FR-002**: When an event is created with assigned members who have email addresses, the app MUST send an iMIP-compliant email (`METHOD:REQUEST`) to each addressee.
- **FR-003**: The `.ics` attachment MUST be RFC 5545-compliant and include `DTSTART`, `DTEND`, `SUMMARY`, `DESCRIPTION` (if present), `UID`, `SEQUENCE`, and `ORGANIZER`.
- **FR-004**: When an event is updated, the app MUST send a `METHOD:REQUEST` email with an incremented `SEQUENCE` number to all current assignees.
- **FR-005**: When an event is deleted, the app MUST send a `METHOD:CANCEL` email to all previously assigned members who have email addresses.
- **FR-006**: For family members with preferred platform "Google Calendar", invitation emails MUST include an "Add to Google Calendar" URL in the email body.
- **FR-007**: When no SMTP server is configured, the app MUST fall back to generating a `mailto:` link and opening the organiser's default email client.
- **FR-008**: When SMTP is configured, the app MUST send email automatically (no organiser interaction required) via a server-side endpoint.
- **FR-009**: The organiser of an event MUST NOT receive an invitation email for their own creation/update actions.
- **FR-010**: Invitation sending MUST be debounced to prevent duplicate emails on rapid saves.
- **FR-011**: The app MUST surface a non-blocking warning when an assigned member has no email address.
- **FR-012**: All delivery preferences (email, platform) MUST be persisted alongside family member data in localStorage (and later, the backend from spec 011).

### Key Entities

- **DeliveryPreference** (extended onto FamilyMember): `email` (string, optional), `preferredPlatform` (enum: `google` | `apple` | `outlook` | `other` | `none`).
- **Invitation**: A transient object representing one outbound iMIP message. Attributes: `recipientEmail`, `icsPayload` (string), `method` (`REQUEST` | `CANCEL`), `eventId`, `sequence` (integer).
- **SmtpConfig** (app-level setting, stored in localStorage): `host`, `port`, `username`, `password` (encrypted at rest), `fromAddress`, `fromName`.
- **DeliveryResult**: `status` (`sent` | `failed` | `skipped`), `recipientEmail`, `error` (optional string).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An `.ics` file generated by the app is accepted without errors by Apple Calendar, Google Calendar (import), and Outlook (import/open).
- **SC-002**: With SMTP configured, an invitation email arrives in the recipient's inbox within 60 seconds of event creation.
- **SC-003**: A GCal deep-link URL generated for an event correctly pre-fills title, start time, end time, and description when opened in Chrome.
- **SC-004**: Cancellation emails (METHOD:CANCEL) result in the event being removed from Apple Calendar and Outlook when the `.ics` is opened.
- **SC-005**: The `mailto:` fallback generates a correctly addressed draft with the `.ics` in the body or instructions for the user within 500ms of saving the event.

## Assumptions

- The organiser's identity is the currently configured "primary" family member or the app's configured `ORGANIZER` name/email (settable in app settings).
- For the automated SMTP path, a minimal server-side endpoint (e.g., Vercel Function, Netlify Function, or a Node.js proxy) will be co-deployed with the app. Direct SMTP from a browser is not possible due to security restrictions.
- iMIP REPLY tracking (RSVP) is out of scope for v1; the organiser receives replies in their own email inbox.
- Recurring event invitations send the full series definition; per-instance edits send instance-specific `RECURRENCE-ID` invitations.
- The `mailto:` fallback does not support true `.ics` file attachments (browsers cannot attach files via `mailto:`); it will include the ICS content as plain text in the body with instructions to save and open it, or use a data URI approach where supported.
- SMTP credentials are stored in localStorage for v1 (same security posture as the rest of the app). Encrypted storage or a backend secrets manager is deferred to spec 011.
- Delivery to non-email channels (SMS, push notification) is explicitly out of scope for this spec.
