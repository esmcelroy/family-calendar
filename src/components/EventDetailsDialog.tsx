import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CalendarEvent, FamilyMember } from '@/lib/types'
import { formatTime } from '@/lib/calendar'
import { Pencil, Trash, Clock, Users } from '@phosphor-icons/react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useState } from 'react'

interface EventDetailsDialogProps {
  event: CalendarEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  members: FamilyMember[]
}

export function EventDetailsDialog({ event, open, onOpenChange, onEdit, onDelete, members }: EventDetailsDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!event) return null

  const eventMembers = members.filter((m) => event.memberIds.includes(m.id))
  const eventDate = new Date(event.date)
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const handleDelete = () => {
    onDelete()
    setShowDeleteConfirm(false)
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
          <DialogFooter className="gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowDeleteConfirm(true)}>
              <Trash size={18} />
              Delete
            </Button>
            <Button className="gap-2" onClick={onEdit}>
              <Pencil size={18} />
              Edit
            </Button>
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
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
