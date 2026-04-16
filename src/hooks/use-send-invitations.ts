import { useRef, useCallback } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { STORAGE_KEYS } from '@/lib/storage'
import { CalendarEvent, FamilyMember, SmtpConfig, OrganizerConfig, DeliveryResult } from '@/lib/types'
import { buildInvitations, buildMailtoLink } from '@/lib/invitations'

const DEBOUNCE_MS = 1500

export function useSendInvitations() {
  const [smtpConfig] = useLocalStorage<SmtpConfig | null>(STORAGE_KEYS.smtpConfig, null)
  const [organizerConfig] = useLocalStorage<OrganizerConfig | null>(STORAGE_KEYS.organizerConfig, null)
  const lastSentRef = useRef<Map<string, number>>(new Map())

  const sendInvitations = useCallback(
    async (
      event: CalendarEvent,
      members: FamilyMember[],
      method: 'REQUEST' | 'CANCEL',
      sequence: number,
      recurrenceId?: string,
    ): Promise<DeliveryResult[]> => {
      const now = Date.now()
      const lastSent = lastSentRef.current.get(event.id) ?? 0

      if (now - lastSent < DEBOUNCE_MS) {
        return []
      }
      lastSentRef.current.set(event.id, now)

      const organizerName = organizerConfig?.name ?? 'Family Calendar'
      const organizerEmail = organizerConfig?.email ?? ''

      const invitations = buildInvitations(event, members, organizerEmail, method, sequence, organizerName, recurrenceId)

      if (invitations.length === 0) return []

      const results: DeliveryResult[] = []

      if (smtpConfig) {
        await Promise.all(
          invitations.map(async (invitation) => {
            try {
              const resp = await fetch('/api/send-invitation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invitation, smtpConfig }),
              })
              const data = await resp.json()
              if (data.status === 'sent') {
                results.push({ status: 'sent', recipientEmail: invitation.recipientEmail })
              } else {
                results.push({ status: 'failed', recipientEmail: invitation.recipientEmail, error: data.error })
              }
            } catch (err) {
              results.push({
                status: 'failed',
                recipientEmail: invitation.recipientEmail,
                error: err instanceof Error ? err.message : String(err),
              })
            }
          }),
        )
      } else {
        for (const invitation of invitations) {
          const mailto = buildMailtoLink(invitation)
          window.open(mailto, '_blank')
          results.push({ status: 'sent', recipientEmail: invitation.recipientEmail })
          // Small gap to avoid browser popup blockers on rapid multiple opens
          await new Promise((r) => setTimeout(r, 300))
        }
      }

      return results
    },
    [smtpConfig, organizerConfig],
  )

  return { sendInvitations, hasSmtp: !!smtpConfig, hasOrganizer: !!organizerConfig }
}
