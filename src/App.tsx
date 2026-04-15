import { useState } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { STORAGE_KEYS } from '@/lib/storage'
import { CalendarEvent, FamilyMember, RecurringEditScope, SeriesException } from '@/lib/types'
import { CalendarGrid } from '@/components/CalendarGrid'
import { EventDialog } from '@/components/EventDialog'
import { EventDetailsDialog } from '@/components/EventDetailsDialog'
import { FamilyMembersSheet } from '@/components/FamilyMembersSheet'
import { Button } from '@/components/ui/button'
import { expandRecurringEvents, formatDate, formatMonthYear } from '@/lib/calendar'
import { generateICalendar, downloadICalendar } from '@/lib/ical'
import { Plus, CaretLeft, CaretRight, Users, CalendarBlank, Funnel, Download } from '@phosphor-icons/react'
import { Toaster, toast } from 'sonner'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

function App() {
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>(STORAGE_KEYS.events, [])
  const [members, setMembers] = useLocalStorage<FamilyMember[]>(STORAGE_KEYS.members, [])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showMembersSheet, setShowMembersSheet] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [editingScope, setEditingScope] = useState<RecurringEditScope>('all')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const shouldReduceMotion = useReducedMotion()
  const expandedEvents = expandRecurringEvents(events || [], currentDate)

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setEditingEvent(null)
    setShowEventDialog(true)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setShowDetailsDialog(true)
  }

  const handleSaveEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
    if (editingEvent && editingEvent.recurrenceMeta) {
      const sourceId = editingEvent.recurrenceMeta.sourceEventId
      const occurrenceDate = editingEvent.recurrenceMeta.occurrenceDate
      if (editingScope === 'this') {
        setEvents((currentEvents) =>
          (currentEvents || []).map((event) => {
            if (event.id !== sourceId) return event

            const exceptions = [...(event.seriesExceptions || [])].filter((exception) => exception.date !== occurrenceDate)
            const overrides: SeriesException['overrides'] = {
              title: eventData.title,
              startTime: eventData.startTime,
              endTime: eventData.endTime,
              description: eventData.description,
              memberIds: eventData.memberIds,
            }

            exceptions.push({
              date: occurrenceDate,
              type: 'modified',
              overrides,
            })

            return {
              ...event,
              seriesExceptions: exceptions,
            }
          })
        )
        toast.success('Occurrence updated')
      } else if (editingScope === 'following') {
        setEvents((currentEvents) => {
          const sourceEvent = (currentEvents || []).find((event) => event.id === sourceId)
          if (!sourceEvent?.recurrence) return currentEvents || []

          const previousDay = new Date(occurrenceDate)
          previousDay.setDate(previousDay.getDate() - 1)
          const updatedSource: CalendarEvent = {
            ...sourceEvent,
            recurrence: {
              ...sourceEvent.recurrence,
              endType: 'date',
              endDate: formatDate(previousDay),
            },
            seriesExceptions: (sourceEvent.seriesExceptions || []).filter((exception) => exception.date < occurrenceDate),
          }

          const newSeriesId = Date.now().toString()
          const newEvent: CalendarEvent = {
            ...eventData,
            id: newSeriesId,
            date: occurrenceDate,
            recurrence: eventData.recurrence || sourceEvent.recurrence,
            seriesId: newSeriesId,
            seriesExceptions: [],
          }

          return (currentEvents || []).map((event) => (event.id === sourceId ? updatedSource : event)).concat(newEvent)
        })
        toast.success('Updated this and following occurrences')
      } else {
        setEvents((currentEvents) =>
          (currentEvents || []).map((event) =>
            event.id === sourceId
              ? {
                  ...eventData,
                  id: sourceId,
                  seriesId: event.seriesId || sourceId,
                  seriesExceptions: event.seriesExceptions || [],
                }
              : event
          )
        )
        toast.success('Series updated')
      }
    } else if (editingEvent) {
      setEvents((currentEvents) =>
        (currentEvents || []).map((e) => (e.id === editingEvent.id ? { ...eventData, id: editingEvent.id } : e))
      )
      toast.success('Event updated')
    } else {
      const newId = Date.now().toString()
      const newEvent: CalendarEvent = {
        ...eventData,
        id: newId,
        seriesId: eventData.recurrence ? (eventData.seriesId || newId) : undefined,
      }
      setEvents((currentEvents) => [...(currentEvents || []), newEvent])
      toast.success('Event added')
    }
    setEditingEvent(null)
    setEditingScope('all')
  }

  const handleEditEvent = (scope: RecurringEditScope) => {
    if (selectedEvent) {
      setEditingScope(scope)
      if (selectedEvent.recurrenceMeta) {
        const sourceEvent = (events || []).find((event) => event.id === selectedEvent.recurrenceMeta?.sourceEventId)
        if (scope === 'all' && sourceEvent) {
          setEditingEvent(sourceEvent)
        } else {
          setEditingEvent({
            ...selectedEvent,
            id: selectedEvent.recurrenceMeta.sourceEventId,
            date: selectedEvent.recurrenceMeta.occurrenceDate,
          })
        }
      } else {
        setEditingEvent(selectedEvent)
      }
      setShowDetailsDialog(false)
      setShowEventDialog(true)
    }
  }

  const handleDeleteEvent = (scope: RecurringEditScope) => {
    if (selectedEvent) {
      if (selectedEvent.recurrenceMeta) {
        const sourceId = selectedEvent.recurrenceMeta.sourceEventId
        const occurrenceDate = selectedEvent.recurrenceMeta.occurrenceDate
        if (scope === 'this') {
          setEvents((currentEvents) =>
            (currentEvents || []).map((event) => {
              if (event.id !== sourceId) return event
              const exceptions = [...(event.seriesExceptions || [])].filter((exception) => exception.date !== occurrenceDate)
              exceptions.push({ date: occurrenceDate, type: 'deleted' })
              return { ...event, seriesExceptions: exceptions }
            })
          )
          toast.success('Occurrence deleted')
        } else if (scope === 'following') {
          const previousDay = new Date(occurrenceDate)
          previousDay.setDate(previousDay.getDate() - 1)
          setEvents((currentEvents) =>
            (currentEvents || []).map((event) =>
              event.id === sourceId && event.recurrence
                ? {
                    ...event,
                    recurrence: {
                      ...event.recurrence,
                      endType: 'date',
                      endDate: formatDate(previousDay),
                    },
                    seriesExceptions: (event.seriesExceptions || []).filter((exception) => exception.date < occurrenceDate),
                  }
                : event
            )
          )
          toast.success('Deleted this and following occurrences')
        } else {
          setEvents((currentEvents) => (currentEvents || []).filter((event) => event.id !== sourceId))
          toast.success('Series deleted')
        }
      } else {
        setEvents((currentEvents) => (currentEvents || []).filter((e) => e.id !== selectedEvent.id))
        toast.success('Event deleted')
      }
      setSelectedEvent(null)
    }
  }

  const handleAddMember = (memberData: Omit<FamilyMember, 'id'>) => {
    const newMember: FamilyMember = {
      ...memberData,
      id: Date.now().toString(),
    }
    setMembers((currentMembers) => [...(currentMembers || []), newMember])
  }

  const handleDeleteMember = (id: string) => {
    setMembers((currentMembers) => (currentMembers || []).filter((m) => m.id !== id))
    setEvents((currentEvents) =>
      (currentEvents || []).map((e) => ({
        ...e,
        memberIds: e.memberIds.filter((mId) => mId !== id),
      }))
    )
  }

  const toggleFilter = (memberId: string) => {
    setActiveFilters((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    )
  }

  const handleExportICalendar = () => {
    if (!events || events.length === 0) {
      toast.error('No events to export')
      return
    }
    
    try {
      const icalContent = generateICalendar(events, members || [])
      downloadICalendar(icalContent)
      toast.success('Calendar exported successfully')
    } catch (error) {
      console.error('Error exporting calendar:', error)
      const message = error instanceof Error ? error.message : 'Failed to export calendar'
      toast.error(`Export failed: ${message}`)
    }
  }

  const hasNoEvents = (events || []).length === 0
  const hasNoMembers = (members || []).length === 0

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">Family Calendar</h1>
            <p className="text-muted-foreground mt-1">Keep track of everyone's schedule</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowMembersSheet(true)}>
              <Users size={20} />
              <span className="hidden sm:inline">Family</span>
            </Button>
            <Button 
              variant="outline" 
              className="gap-2" 
              onClick={handleExportICalendar}
              disabled={hasNoEvents}
            >
              <Download size={20} />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => {
              setSelectedDate(new Date())
              setEditingEvent(null)
              setShowEventDialog(true)
            }}>
              <Plus size={20} weight="bold" />
              Add Event
            </Button>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={handlePrevMonth} aria-label="Previous month">
              <CaretLeft size={20} />
            </Button>
            <h2 className="text-2xl font-semibold min-w-[200px] text-center">
              {formatMonthYear(currentDate)}
            </h2>
            <Button variant="outline" size="icon" onClick={handleNextMonth} aria-label="Next month">
              <CaretRight size={20} />
            </Button>
            <Button variant="outline" onClick={handleToday}>
              Today
            </Button>
          </div>

          {(members || []).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by family member">
              <Funnel size={18} className="text-muted-foreground" aria-hidden="true" />
              {(members || []).map((member) => {
                const isActive = activeFilters.includes(member.id) || activeFilters.length === 0
                return (
                  <motion.button
                    key={member.id}
                    onClick={() => toggleFilter(member.id)}
                    aria-pressed={activeFilters.includes(member.id) || activeFilters.length === 0}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                      isActive ? 'text-white' : 'opacity-40'
                    )}
                    style={{
                      backgroundColor: member.color,
                      border: `2px solid ${member.color}`,
                    }}
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                  >
                    {member.name}
                  </motion.button>
                )
              })}
              {activeFilters.length > 0 && (
                <button
                  onClick={() => setActiveFilters([])}
                  className="px-3 py-1.5 rounded-full text-sm font-medium border border-muted-foreground/40 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Show all
                </button>
              )}
            </div>
          )}
        </div>

        {hasNoEvents && hasNoMembers ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 px-4"
          >
            <CalendarBlank size={80} className="text-muted-foreground mb-4" weight="duotone" aria-hidden="true" />
            <h3 className="text-2xl font-semibold mb-2">Welcome to Family Calendar!</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Start by adding family members, then create events to keep everyone on the same page.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={() => setShowMembersSheet(true)}>
                <Users size={20} />
                Add Family Members
              </Button>
              <Button className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => {
                setSelectedDate(new Date())
                setEditingEvent(null)
                setShowEventDialog(true)
              }}>
                <Plus size={20} weight="bold" />
                Create First Event
              </Button>
            </div>
          </motion.div>
        ) : (
          <CalendarGrid
            currentDate={currentDate}
            events={expandedEvents}
            members={members || []}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            activeFilters={activeFilters}
          />
        )}
      </div>

      <EventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        onSave={handleSaveEvent}
        selectedDate={selectedDate}
        members={members || []}
        editEvent={editingEvent}
        disableRecurrenceEditing={Boolean(editingEvent?.recurrenceMeta) && editingScope === 'this'}
      />

      <EventDetailsDialog
        event={selectedEvent}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
        members={members || []}
      />

      <FamilyMembersSheet
        open={showMembersSheet}
        onOpenChange={setShowMembersSheet}
        members={members || []}
        onAddMember={handleAddMember}
        onDeleteMember={handleDeleteMember}
      />

      <Toaster position="bottom-right" />
    </div>
  )
}

export default App
