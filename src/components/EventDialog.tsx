import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CalendarEvent, FamilyMember, RecurrenceEndType, RecurrenceFrequency } from '@/lib/types'
import { formatDate } from '@/lib/calendar'
import { getMembersWithoutEmail } from '@/lib/invitations'
import { Warning } from '@phosphor-icons/react'

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (event: Omit<CalendarEvent, 'id'>) => void
  selectedDate: Date | null
  members: FamilyMember[]
  editEvent?: CalendarEvent | null
  disableRecurrenceEditing?: boolean
}

export function EventDialog({
  open,
  onOpenChange,
  onSave,
  selectedDate,
  members,
  editEvent,
  disableRecurrenceEditing = false,
}: EventDialogProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly')
  const [interval, setInterval] = useState('1')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [endType, setEndType] = useState<RecurrenceEndType>('none')
  const [endDate, setEndDate] = useState('')
  const [endCount, setEndCount] = useState('')

  useEffect(() => {
    if (editEvent) {
      setTitle(editEvent.title)
      setDate(editEvent.date)
      setStartTime(editEvent.startTime || '')
      setEndTime(editEvent.endTime || '')
      setDescription(editEvent.description || '')
      setSelectedMembers(editEvent.memberIds)
      setIsRecurring(Boolean(editEvent.recurrence))
      setFrequency(editEvent.recurrence?.frequency || 'weekly')
      setInterval(String(editEvent.recurrence?.interval || 1))
      setSelectedDays(editEvent.recurrence?.selectedDays || [])
      setEndType(editEvent.recurrence?.endType || 'none')
      setEndDate(editEvent.recurrence?.endDate || '')
      setEndCount(editEvent.recurrence?.endCount ? String(editEvent.recurrence.endCount) : '')
    } else if (selectedDate) {
      setTitle('')
      setDate(formatDate(selectedDate))
      setStartTime('')
      setEndTime('')
      setDescription('')
      setSelectedMembers([])
      setIsRecurring(false)
      setFrequency('weekly')
      setInterval('1')
      setSelectedDays([])
      setEndType('none')
      setEndDate('')
      setEndCount('')
    }
  }, [editEvent, selectedDate, open])

  const handleSave = () => {
    if (!title.trim() || !date) return

    const parsedInterval = Math.max(1, parseInt(interval, 10) || 1)
    const parsedCount = Math.max(1, parseInt(endCount, 10) || 1)
    const recurrence = isRecurring && !disableRecurrenceEditing
      ? {
          frequency,
          interval: parsedInterval,
          selectedDays: frequency === 'weekly'
            ? (selectedDays.length > 0 ? selectedDays : [new Date(date).getDay()])
            : undefined,
          endType,
          endDate: endType === 'date' ? endDate : undefined,
          endCount: endType === 'count' ? parsedCount : undefined,
        }
      : undefined

    onSave({
      title: title.trim(),
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      description: description.trim() || undefined,
      memberIds: selectedMembers,
      recurrence,
      seriesId: recurrence ? (editEvent?.seriesId || editEvent?.id) : undefined,
      seriesExceptions: recurrence ? (editEvent?.seriesExceptions || []) : undefined,
    })

    onOpenChange(false)
  }

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    )
  }

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
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
                    aria-pressed={selectedMembers.includes(member.id)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                    style={{
                      backgroundColor: selectedMembers.includes(member.id)
                        ? member.color
                        : 'transparent',
                      color: selectedMembers.includes(member.id) ? 'white' : member.color,
                      border: `2px solid ${member.color}`,
                    }}
                  >
                    {member.name}
                    {!member.email && (
                      <span className="ml-1 text-amber-400" aria-label="no email configured">●</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {(() => {
              const noEmail = getMembersWithoutEmail(
                { id: '', title: '', date: '', memberIds: selectedMembers },
                members,
              )
              return noEmail.length > 0 ? (
                <Alert variant="default" className="border-amber-400/50 bg-amber-50/50 dark:bg-amber-900/10 py-2 px-3">
                  <Warning size={14} className="text-amber-500 mt-0.5" weight="fill" aria-hidden="true" />
                  <AlertDescription className="text-xs text-amber-700 dark:text-amber-400 ml-1">
                    {noEmail.map((m) => m.name).join(', ')} {noEmail.length === 1 ? 'has' : 'have'} no email address — no invitation will be sent.
                  </AlertDescription>
                </Alert>
              ) : null
            })()}
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

          <div className="grid gap-3 border rounded-lg p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="is-recurring">Recurrence</Label>
              <input
                id="is-recurring"
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                disabled={disableRecurrenceEditing}
                className="h-4 w-4"
              />
            </div>

            {isRecurring && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="recurrence-frequency">Frequency</Label>
                  <select
                    id="recurrence-frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                    disabled={disableRecurrenceEditing}
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="recurrence-interval">Repeat every</Label>
                  <Input
                    id="recurrence-interval"
                    type="number"
                    min={1}
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    disabled={disableRecurrenceEditing}
                  />
                </div>

                {frequency === 'weekly' && (
                  <div className="grid gap-2">
                    <Label>Days of week</Label>
                    <div className="flex flex-wrap gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIndex) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(dayIndex)}
                          disabled={disableRecurrenceEditing}
                          aria-pressed={selectedDays.includes(dayIndex)}
                          className="px-3 py-1 rounded border text-sm"
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="recurrence-end-type">Ends</Label>
                  <select
                    id="recurrence-end-type"
                    value={endType}
                    onChange={(e) => setEndType(e.target.value as RecurrenceEndType)}
                    disabled={disableRecurrenceEditing}
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="none">Never (2-year horizon)</option>
                    <option value="date">On date</option>
                    <option value="count">After occurrences</option>
                  </select>
                </div>

                {endType === 'date' && (
                  <div className="grid gap-2">
                    <Label htmlFor="recurrence-end-date">End date</Label>
                    <Input
                      id="recurrence-end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={disableRecurrenceEditing}
                    />
                  </div>
                )}

                {endType === 'count' && (
                  <div className="grid gap-2">
                    <Label htmlFor="recurrence-end-count">Number of occurrences</Label>
                    <Input
                      id="recurrence-end-count"
                      type="number"
                      min={1}
                      value={endCount}
                      onChange={(e) => setEndCount(e.target.value)}
                      disabled={disableRecurrenceEditing}
                    />
                  </div>
                )}
              </>
            )}
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
