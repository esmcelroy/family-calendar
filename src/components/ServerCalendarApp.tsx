import { useRef, useState, type FormEvent } from 'react'
import { CalendarGrid } from '@/components/CalendarGrid'
import { EventDialog } from '@/components/EventDialog'
import { EventDetailsDialog } from '@/components/EventDetailsDialog'
import { Button } from '@/components/ui/button'
import { serverApi } from '@/lib/server-api'
import { useServerCalendar } from '@/lib/server-calendar'
import { expandRecurringEvents, formatDate, formatMonthYear } from '@/lib/calendar'
import { downloadICalendar, generateICalendar } from '@/lib/ical'
import { CalendarBlank, CaretLeft, CaretRight, Download, Plus } from '@phosphor-icons/react'
import type { CalendarEvent, DeliveryResult, FamilyMember, RecurringEditScope, SeriesException } from '@/lib/types'

export function ServerCalendarApp() {
  const calendar = useServerCalendar()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [editingScope, setEditingScope] = useState<RecurringEditScope>('all')
  const [memberName, setMemberName] = useState('')
  const [memberColor, setMemberColor] = useState('#3b82f6')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberPlatform, setMemberPlatform] = useState<FamilyMember['preferredPlatform'] | ''>('')
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [subscriptionName, setSubscriptionName] = useState('')
  const [subscriptionUrl, setSubscriptionUrl] = useState('')
  const [operationStatus, setOperationStatus] = useState<string | null>(null)
  const eventsHeadingRef = useRef<HTMLHeadingElement>(null)
  const membersHeadingRef = useRef<HTMLHeadingElement>(null)
  const subscriptionsHeadingRef = useRef<HTMLHeadingElement>(null)
  const expandedEvents = expandRecurringEvents(calendar.events, currentDate)

  const sendInvitation = async (
    event: CalendarEvent,
    method: 'REQUEST' | 'CANCEL',
    recurrenceId?: string,
  ) => {
    if (!calendar.members.some((member) => event.memberIds.includes(member.id) && member.email)) return
    try {
      const { results } = await serverApi.request<{ results: DeliveryResult[] }>(
        `/api/calendar/events/${encodeURIComponent(event.recurrenceMeta?.sourceEventId ?? event.id)}/invitations`,
        {
          method: 'POST',
          body: JSON.stringify({
            method,
            sequence: event.sequence ?? 0,
            ...(recurrenceId ? { recurrenceId } : {}),
          }),
        },
      )
      const failed = results.filter((result) => result.status === 'failed')
      if (failed.length > 0) {
        setOperationStatus(`Calendar change saved, but invitations failed for ${failed.map((result) => result.recipientEmail).join(', ')}.`)
      } else if (results.length > 0) {
        setOperationStatus(`Invitation ${method === 'CANCEL' ? 'cancellation' : 'email'} sent.`)
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Invitation delivery failed.'
      setOperationStatus(`Calendar change saved, but invitation delivery failed: ${message}`)
    }
  }

  const saveEvent = async (eventData: Omit<CalendarEvent, 'id'>) => {
    setOperationStatus(null)
    if (editingEvent?.recurrenceMeta) {
      const sourceId = editingEvent.recurrenceMeta.sourceEventId
      const occurrenceDate = editingEvent.recurrenceMeta.occurrenceDate
      const sourceEvent = calendar.events.find((event) => event.id === sourceId)
      if (!sourceEvent) throw new Error('The recurring event no longer exists.')

      if (editingScope === 'this') {
        const exceptions = (sourceEvent.seriesExceptions ?? []).filter((exception) => exception.date !== occurrenceDate)
        const overrides: SeriesException['overrides'] = {
          title: eventData.title,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          description: eventData.description,
          memberIds: eventData.memberIds,
        }
        exceptions.push({ date: occurrenceDate, type: 'modified', overrides })
        const nextSequence = (sourceEvent.sequence ?? 0) + 1
        await calendar.updateEvent({
          ...sourceEvent,
          seriesExceptions: exceptions,
          sequence: nextSequence,
        })
        void sendInvitation({ ...sourceEvent, ...overrides, id: sourceId, date: occurrenceDate, sequence: nextSequence }, 'REQUEST', occurrenceDate)
        setOperationStatus('Recurring occurrence updated.')
      } else if (editingScope === 'following') {
        const previousDate = new Date(`${occurrenceDate}T00:00:00`)
        previousDate.setDate(previousDate.getDate() - 1)
        if (!sourceEvent.recurrence) throw new Error('The recurring event has no recurrence rule.')
        await calendar.updateEvent({
          ...sourceEvent,
          recurrence: { ...sourceEvent.recurrence, endType: 'date', endDate: formatDate(previousDate) },
          seriesExceptions: (sourceEvent.seriesExceptions ?? []).filter((exception) => exception.date < occurrenceDate),
        })
        const created = await calendar.createEvent({
          ...eventData,
          date: occurrenceDate,
          recurrence: eventData.recurrence ?? sourceEvent.recurrence,
          seriesId: undefined,
          seriesExceptions: [],
          sequence: 0,
        })
        void sendInvitation(created, 'REQUEST')
        setOperationStatus('This and following occurrences updated.')
      } else {
        const updated = await calendar.updateEvent({
          ...eventData,
          id: sourceId,
          seriesId: sourceEvent.seriesId || sourceId,
          seriesExceptions: sourceEvent.seriesExceptions ?? [],
          sequence: (sourceEvent.sequence ?? 0) + 1,
        })
        void sendInvitation(updated, 'REQUEST')
        setOperationStatus('Recurring series updated.')
      }
    } else if (editingEvent) {
      const updated = await calendar.updateEvent({
        ...eventData,
        id: editingEvent.id,
        sequence: (editingEvent.sequence ?? 0) + 1,
      })
      void sendInvitation(updated, 'REQUEST')
      setOperationStatus('Event updated.')
    } else {
      const created = await calendar.createEvent({ ...eventData, sequence: 0 })
      void sendInvitation(created, 'REQUEST')
      setOperationStatus('Event added.')
    }
    setEditingEvent(null)
    setEditingScope('all')
  }

  const openNewEvent = (date: Date) => {
    setSelectedDate(date)
    setEditingEvent(null)
    setShowEventDialog(true)
  }

  const openEventDetails = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setShowDetailsDialog(true)
  }

  const editEvent = (scope: RecurringEditScope) => {
    if (!selectedEvent) return
    setEditingScope(scope)
    if (selectedEvent.recurrenceMeta) {
      const sourceEvent = calendar.events.find((event) => event.id === selectedEvent.recurrenceMeta?.sourceEventId)
      setEditingEvent(scope === 'all' && sourceEvent
        ? sourceEvent
        : {
            ...selectedEvent,
            id: selectedEvent.recurrenceMeta.sourceEventId,
            date: selectedEvent.recurrenceMeta.occurrenceDate,
          })
    } else {
      setEditingEvent(selectedEvent)
    }
    setShowDetailsDialog(false)
    setShowEventDialog(true)
  }

  const deleteEvent = async (scope: RecurringEditScope) => {
    if (!selectedEvent) return
    setOperationStatus(null)
    try {
      if (selectedEvent.recurrenceMeta) {
        const sourceId = selectedEvent.recurrenceMeta.sourceEventId
        const occurrenceDate = selectedEvent.recurrenceMeta.occurrenceDate
        const sourceEvent = calendar.events.find((event) => event.id === sourceId)
        if (!sourceEvent) throw new Error('The recurring event no longer exists.')
        if (scope === 'this') {
          await sendInvitation({ ...sourceEvent, date: occurrenceDate, sequence: (sourceEvent.sequence ?? 0) + 1 }, 'CANCEL', occurrenceDate)
          const exceptions = (sourceEvent.seriesExceptions ?? []).filter((exception) => exception.date !== occurrenceDate)
          exceptions.push({ date: occurrenceDate, type: 'deleted' })
          await calendar.updateEvent({ ...sourceEvent, seriesExceptions: exceptions })
          setOperationStatus('Recurring occurrence deleted.')
        } else if (scope === 'following') {
          const previousDate = new Date(`${occurrenceDate}T00:00:00`)
          previousDate.setDate(previousDate.getDate() - 1)
          if (!sourceEvent.recurrence) throw new Error('The recurring event has no recurrence rule.')
          await calendar.updateEvent({
            ...sourceEvent,
            recurrence: { ...sourceEvent.recurrence, endType: 'date', endDate: formatDate(previousDate) },
            seriesExceptions: (sourceEvent.seriesExceptions ?? []).filter((exception) => exception.date < occurrenceDate),
          })
          setOperationStatus('This and following occurrences deleted.')
        } else {
          await sendInvitation({ ...sourceEvent, sequence: (sourceEvent.sequence ?? 0) + 1 }, 'CANCEL')
          await calendar.deleteEvent(sourceId)
          setOperationStatus('Recurring series deleted.')
        }
      } else {
        await sendInvitation({ ...selectedEvent, sequence: (selectedEvent.sequence ?? 0) + 1 }, 'CANCEL')
        await calendar.deleteEvent(selectedEvent.id)
        setOperationStatus('Event deleted.')
      }
      setSelectedEvent(null)
      eventsHeadingRef.current?.focus()
    } catch {
      // The hook exposes failed writes; the server remains the source of truth.
    }
  }

  const saveMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setOperationStatus(null)
    try {
      const updates = {
        name: memberName,
        color: memberColor,
        email: memberEmail.trim() || undefined,
        preferredPlatform: memberPlatform || undefined,
      }
      if (editingMemberId) {
        await calendar.updateMember(editingMemberId, updates)
        setEditingMemberId(null)
        setOperationStatus('Family member updated.')
      } else {
        await calendar.addMember(updates)
        setOperationStatus('Family member added.')
      }
      setMemberName('')
      setMemberEmail('')
      setMemberPlatform('')
    } catch {
      // Preserve the server-owned state after a failed write.
    }
  }

  const saveSubscription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setOperationStatus(null)
    try {
      await calendar.createSubscription({
        displayName: subscriptionName,
        sourceUrl: subscriptionUrl,
        enabled: true,
      })
      setSubscriptionName('')
      setSubscriptionUrl('')
      setOperationStatus('Calendar subscription added.')
    } catch {
      // Preserve the server-owned state after a failed write.
    }
  }

  const removeMember = async (id: string) => {
    setOperationStatus(null)
    try {
      await calendar.deleteMember(id)
      setOperationStatus('Family member deleted.')
      membersHeadingRef.current?.focus()
    } catch {
      // Preserve the server-owned state after a failed write.
    }
  }

  const removeSubscription = async (id: string) => {
    setOperationStatus(null)
    try {
      await calendar.deleteSubscription(id)
      setOperationStatus('Calendar subscription deleted.')
      subscriptionsHeadingRef.current?.focus()
    } catch {
      // Preserve the server-owned state after a failed write.
    }
  }

  const toggleMemberFilter = async (memberId: string) => {
    setOperationStatus(null)
    const activeFilters = calendar.preferences.activeFilters.includes(memberId)
      ? calendar.preferences.activeFilters.filter((id) => id !== memberId)
      : [...calendar.preferences.activeFilters, memberId]
    try {
      await calendar.updatePreferences({ ...calendar.preferences, activeFilters })
      setOperationStatus('Family member filter updated.')
    } catch {
      // The previous preference remains displayed until the server confirms.
    }
  }

  const toggleSubscription = async (subscription: (typeof calendar.subscriptions)[number]) => {
    setOperationStatus(null)
    try {
      await calendar.updateSubscription({ ...subscription, enabled: !subscription.enabled })
      setOperationStatus(`Calendar subscription ${subscription.enabled ? 'disabled' : 'enabled'}.`)
    } catch {
      // Preserve the server-owned state after a failed write.
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Family Calendar</h1>
          <p className="text-muted-foreground">Shared calendar for your family</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="min-h-11" disabled={calendar.loading} onClick={() => openNewEvent(new Date())}>
            <Plus aria-hidden="true" /> Add event
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={calendar.loading}
            onClick={() => downloadICalendar(generateICalendar(calendar.events, calendar.members))}
          >
            <Download aria-hidden="true" /> Export calendar
          </Button>
        </div>
      </header>

      {calendar.loading && <p role="status">Loading shared calendar…</p>}
      {calendar.error && !showEventDialog && <p role="alert">{calendar.error}</p>}
      {operationStatus && <p role="status" aria-live="polite">{operationStatus}</p>}

      {!calendar.loading && (
        <>
          <section aria-labelledby="events-heading" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 ref={eventsHeadingRef} id="events-heading" tabIndex={-1} className="text-2xl font-semibold">Events</h2>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="min-h-11 min-w-11" aria-label="Previous month" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
                  <CaretLeft aria-hidden="true" />
                </Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setCurrentDate(new Date())}>
                  <CalendarBlank aria-hidden="true" /> Today
                </Button>
                <p aria-live="polite" className="min-w-36 text-center font-medium">{formatMonthYear(currentDate)}</p>
                <Button type="button" variant="outline" className="min-h-11 min-w-11" aria-label="Next month" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
                  <CaretRight aria-hidden="true" />
                </Button>
              </div>
            </div>
            {calendar.members.length > 0 && (
              <fieldset className="flex flex-wrap gap-4">
                <legend className="mb-2 font-medium">Filter by family member</legend>
                {calendar.members.map((member) => (
                  <label key={member.id} className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={calendar.preferences.activeFilters.includes(member.id)}
                      onChange={() => void toggleMemberFilter(member.id)}
                      disabled={calendar.pendingMutation}
                    />
                    {member.name}
                  </label>
                ))}
              </fieldset>
            )}
            {calendar.events.length === 0 && <p>No events yet.</p>}
            <CalendarGrid
              currentDate={currentDate}
              events={expandedEvents}
              members={calendar.members}
              onDateClick={openNewEvent}
              onEventClick={openEventDetails}
              activeFilters={calendar.preferences.activeFilters}
            />
          </section>

          <section aria-labelledby="members-heading" className="space-y-4">
            <h2 ref={membersHeadingRef} id="members-heading" tabIndex={-1} className="text-2xl font-semibold">Family members</h2>
            <form onSubmit={(event) => void saveMember(event)} className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1">
                Member name
                <input required aria-label="Member name" className="min-h-11 rounded-md border bg-background px-3 py-2" value={memberName} onChange={(event) => setMemberName(event.target.value)} />
              </label>
              <label className="grid gap-1">
                Member color
                <input type="color" aria-label="Member color" className="h-11 w-16 rounded-md border" value={memberColor} onChange={(event) => setMemberColor(event.target.value)} />
              </label>
              <label className="grid gap-1">
                Member email
                <input type="email" aria-label="Member email" className="min-h-11 rounded-md border bg-background px-3 py-2" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} />
              </label>
              <label className="grid gap-1">
                Preferred calendar
                <select aria-label="Preferred calendar" className="min-h-11 rounded-md border bg-background px-3 py-2" value={memberPlatform} onChange={(event) => setMemberPlatform(event.target.value as FamilyMember['preferredPlatform'] | '')}>
                  <option value="">None / Other</option>
                  <option value="google">Google Calendar</option>
                  <option value="apple">Apple Calendar</option>
                  <option value="outlook">Outlook</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <button type="submit" className="min-h-11 rounded-md bg-primary px-4 py-2 text-primary-foreground" disabled={calendar.pendingMutation}>
                {editingMemberId ? 'Save member' : 'Add member'}
              </button>
              {editingMemberId && <button type="button" className="min-h-11 rounded-md border px-4 py-2" onClick={() => { setEditingMemberId(null); setMemberName(''); setMemberEmail(''); setMemberPlatform('') }}>Cancel edit</button>}
            </form>
            <ul className="space-y-2">
              {calendar.members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <span className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-4 rounded-full" style={{ backgroundColor: member.color }} /><span>{member.name}{member.email && <span className="ml-2 text-sm text-muted-foreground">{member.email}</span>}</span></span>
                  <div className="flex gap-2">
                    <button type="button" className="min-h-11 min-w-11 rounded-md border px-3 py-2" onClick={() => { setEditingMemberId(member.id); setMemberName(member.name); setMemberColor(member.color); setMemberEmail(member.email ?? ''); setMemberPlatform(member.preferredPlatform ?? '') }}>Edit</button>
                    <button type="button" className="min-h-11 min-w-11 rounded-md border px-3 py-2" disabled={calendar.pendingMutation} onClick={() => void removeMember(member.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="subscriptions-heading" className="space-y-4">
            <h2 ref={subscriptionsHeadingRef} id="subscriptions-heading" tabIndex={-1} className="text-2xl font-semibold">Calendar subscriptions</h2>
            <form onSubmit={(event) => void saveSubscription(event)} className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1">
                Subscription name
                <input required aria-label="Subscription name" className="min-h-11 rounded-md border bg-background px-3 py-2" value={subscriptionName} onChange={(event) => setSubscriptionName(event.target.value)} />
              </label>
              <label className="grid gap-1">
                Subscription HTTPS URL
                <input required type="url" aria-label="Subscription HTTPS URL" className="min-h-11 min-w-64 rounded-md border bg-background px-3 py-2" value={subscriptionUrl} onChange={(event) => setSubscriptionUrl(event.target.value)} />
              </label>
              <button type="submit" className="min-h-11 rounded-md bg-primary px-4 py-2 text-primary-foreground" disabled={calendar.pendingMutation}>Add subscription</button>
            </form>
            <ul className="space-y-2">
              {calendar.subscriptions.map((subscription) => (
                <li key={subscription.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <span>{subscription.displayName} · {subscription.enabled ? 'Enabled' : 'Disabled'}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="min-h-11 min-w-11 rounded-md border px-3 py-2"
                      disabled={calendar.pendingMutation}
                      onClick={() => void toggleSubscription(subscription)}
                    >
                      {subscription.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" className="min-h-11 min-w-11 rounded-md border px-3 py-2" disabled={calendar.pendingMutation} onClick={() => void removeSubscription(subscription.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      <EventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        onSave={saveEvent}
        selectedDate={selectedDate}
        members={calendar.members}
        editEvent={editingEvent}
        disableRecurrenceEditing={Boolean(editingEvent?.recurrenceMeta && editingScope === 'this')}
      />
      <EventDetailsDialog
        event={selectedEvent}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        onEdit={editEvent}
        onDelete={(scope) => void deleteEvent(scope)}
        members={calendar.members}
      />
    </main>
  )
}
