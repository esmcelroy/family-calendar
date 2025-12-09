import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CalendarEvent, FamilyMember } from '@/lib/types'
import { formatDate } from '@/lib/calendar'

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (event: Omit<CalendarEvent, 'id'>) => void
  selectedDate: Date | null
  members: FamilyMember[]
  editEvent?: CalendarEvent | null
}

export function EventDialog({ open, onOpenChange, onSave, selectedDate, members, editEvent }: EventDialogProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])

  useEffect(() => {
    if (editEvent) {
      setTitle(editEvent.title)
      setDate(editEvent.date)
      setStartTime(editEvent.startTime || '')
      setEndTime(editEvent.endTime || '')
      setDescription(editEvent.description || '')
      setSelectedMembers(editEvent.memberIds)
    } else if (selectedDate) {
      setTitle('')
      setDate(formatDate(selectedDate))
      setStartTime('')
      setEndTime('')
      setDescription('')
      setSelectedMembers([])
    }
  }, [editEvent, selectedDate, open])

  const handleSave = () => {
    if (!title.trim() || !date) return

    onSave({
      title: title.trim(),
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      description: description.trim() || undefined,
      memberIds: selectedMembers,
    })

    onOpenChange(false)
  }

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {editEvent ? 'Edit Event' : 'Add Event'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Family dinner, Soccer practice..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start-time">Start Time (Optional)</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end-time">End Time (Optional)</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Assign to Family Members</Label>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add family members to assign events</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                    style={{
                      backgroundColor: selectedMembers.includes(member.id)
                        ? member.color
                        : 'transparent',
                      color: selectedMembers.includes(member.id) ? 'white' : member.color,
                      border: `2px solid ${member.id}`,
                      borderColor: member.color,
                    }}
                  >
                    {member.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any additional details..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || !date}>
            {editEvent ? 'Save Changes' : 'Add Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
