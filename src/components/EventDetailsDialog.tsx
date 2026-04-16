import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CalendarEvent, FamilyMember, RecurringEditScope } from '@/lib/types'
import { formatRecurrencePattern, formatTime } from '@/lib/calendar'
import { Pencil, Trash, Clock, Users, GoogleLogo } from '@phosphor-icons/react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useState } from 'react'
import { buildGCalUrl } from '@/lib/gcal'

interface EventDetailsDialogProps {
  event: CalendarEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (scope: RecurringEditScope) => void
  onDelete: (scope: RecurringEditScope) => void
  members: FamilyMember[]
}

export function EventDetailsDialog({ event, open, onOpenChange, onEdit, onDelete, members }: EventDetailsDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditScope, setShowEditScope] = useState(false)
  const [showDeleteScope, setShowDeleteScope] = useState(false)

  if (!event) return null

  const eventMembers = members.filter((m) => event.memberIds.includes(m.id))
  const eventDate = new Date(event.date)
  const isRecurringInstance = Boolean(event.recurrenceMeta)
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const handleDelete = (scope: RecurringEditScope) => {
    onDelete(scope)
    setShowDeleteConfirm(false)
    setShowDeleteScope(false)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold pr-8">{event.title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">Date</p>
              <p className="text-base">{formattedDate}</p>
            </div>

            {(event.startTime || event.endTime) && (
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-2">
                  <Clock size={16} />
                  Time
                </p>
                <p className="text-base">
                  {event.startTime && formatTime(event.startTime)}
                  {event.startTime && event.endTime && ' - '}
                  {event.endTime && formatTime(event.endTime)}
                </p>
              </div>
            )}

            {(event.recurrence || event.recurrenceMeta) && (
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">Recurrence</p>
                <p className="text-base">
                  {event.recurrence ? formatRecurrencePattern(event.recurrence) : 'Recurring series instance'}
                </p>
                {event.recurrenceMeta?.isModified && (
                  <p className="text-sm text-muted-foreground mt-1">This occurrence was modified from the series.</p>
                )}
              </div>
            )}

            {eventMembers.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Users size={16} />
                  Family Members
                </p>
                <div className="flex flex-wrap gap-2">
                  {eventMembers.map((member) => (
                    <span
                      key={member.id}
                      className="px-3 py-1.5 rounded-full text-sm font-medium text-white"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {event.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Description
                </p>
                <p className="text-base leading-relaxed">{event.description}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open(buildGCalUrl(event), '_blank')}
            >
              <GoogleLogo size={16} />
              Add to Google Calendar
            </Button>
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => (isRecurringInstance ? setShowDeleteScope(true) : setShowDeleteConfirm(true))}
              >
                <Trash size={18} />
                Delete
              </Button>
              <Button className="gap-2" onClick={() => (isRecurringInstance ? setShowEditScope(true) : onEdit('all'))}>
                <Pencil size={18} />
                Edit
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{event.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete('all')}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showEditScope} onOpenChange={setShowEditScope}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit recurring event</AlertDialogTitle>
            <AlertDialogDescription>
              Choose how broadly to apply your changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowEditScope(false); onEdit('this') }}>This event</AlertDialogAction>
            <AlertDialogAction onClick={() => { setShowEditScope(false); onEdit('following') }}>This and following</AlertDialogAction>
            <AlertDialogAction onClick={() => { setShowEditScope(false); onEdit('all') }}>All events</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteScope} onOpenChange={setShowDeleteScope}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete recurring event</AlertDialogTitle>
            <AlertDialogDescription>
              Choose how broadly to apply this deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete('this')}>This event</AlertDialogAction>
            <AlertDialogAction onClick={() => handleDelete('following')}>This and following</AlertDialogAction>
            <AlertDialogAction onClick={() => handleDelete('all')}>All events</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
