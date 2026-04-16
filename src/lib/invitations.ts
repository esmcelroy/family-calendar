import { CalendarEvent, FamilyMember, Invitation } from './types'
import { generateInvitationIcs } from './ical'
import { buildGCalUrl, isGCalUser } from './gcal'

/**
 * Builds outbound Invitation objects for all addressable recipients.
 *
 * The organiser (identified by organizerEmail) is automatically excluded.
 * Members without an email address are silently skipped — callers should use
 * getMembersWithoutEmail() to surface warnings to the user.
 */
export function buildInvitations(
  event: CalendarEvent,
  members: FamilyMember[],
  organizerEmail: string,
  method: 'REQUEST' | 'CANCEL',
  sequence: number,
  organizerName: string,
  recurrenceId?: string,
): Invitation[] {
  const allMembers = members.filter((m) => event.memberIds.includes(m.id))
  const recipients = allMembers.filter(
    (m) => m.email && m.email.trim() !== '' && m.email.toLowerCase() !== organizerEmail.toLowerCase(),
  )

  return recipients.map((member) => {
    const gcalUrl = isGCalUser(member) ? buildGCalUrl(event) : undefined
    const icsPayload = generateInvitationIcs(
      event,
      recipients,
      organizerName,
      organizerEmail,
      method,
      sequence,
      recurrenceId,
    )

    return {
      recipientEmail: member.email!,
      recipientName: member.name,
      recipientPlatform: member.preferredPlatform,
      icsPayload,
      method,
      eventId: event.id,
      sequence,
      gcalUrl,
    }
  })
}

/**
 * Builds a mailto: URI for sending an invitation via the user's default email client.
 *
 * Note: Browsers cannot attach files via mailto:, so the ICS content is included
 * in the body as plain text with instructions to save and import it.
 */
export function buildMailtoLink(invitation: Invitation): string {
  const subject = encodeURIComponent(
    invitation.method === 'CANCEL'
      ? `Cancelled: Calendar event`
      : `You're invited: Calendar event`,
  )

  const gcalSection = invitation.gcalUrl
    ? `\n\nAdd to Google Calendar:\n${invitation.gcalUrl}\n`
    : ''

  const body = encodeURIComponent(
    `Hi ${invitation.recipientName},\n\n` +
      (invitation.method === 'CANCEL'
        ? 'An event has been cancelled. Please remove it from your calendar.\n'
        : 'You have been invited to an event.\n') +
      gcalSection +
      `\nTo add this event to your calendar, copy the text below, save it as a file named "event.ics", and open it with your calendar app:\n\n` +
      invitation.icsPayload,
  )

  return `mailto:${invitation.recipientEmail}?subject=${subject}&body=${body}`
}

/**
 * Returns family members who are assigned to the event but have no email address configured.
 * Used to surface advisory warnings in the UI.
 */
export function getMembersWithoutEmail(event: CalendarEvent, members: FamilyMember[]): FamilyMember[] {
  return members.filter((m) => event.memberIds.includes(m.id) && (!m.email || m.email.trim() === ''))
}
