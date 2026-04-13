import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { CalendarEvent, FamilyMember } from '@/lib/types'
import { CalendarGrid } from '@/components/CalendarGrid'
import { EventDialog } from '@/components/EventDialog'
import { EventDetailsDialog } from '@/components/EventDetailsDialog'
import { FamilyMembersSheet } from '@/components/FamilyMembersSheet'
import { Button } from '@/components/ui/button'
import { formatMonthYear } from '@/lib/calendar'
import { generateICalendar, downloadICalendar } from '@/lib/ical'
import { Plus, CaretLeft, CaretRight, Users, CalendarBlank, Funnel, Download } from '@phosphor-icons/react'
import { Toaster, toast } from 'sonner'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

function App() {
  const [events, setEvents] = useKV<CalendarEvent[]>('family-events', [])
  const [members, setMembers] = useKV<FamilyMember[]>('family-members', [])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showMembersSheet, setShowMembersSheet] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [activeFilters, setActiveFilters] = useState<string[]>([])

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
    if (editingEvent) {
      setEvents((currentEvents) =>
        (currentEvents || []).map((e) => (e.id === editingEvent.id ? { ...eventData, id: editingEvent.id } : e))
      )
      toast.success('Event updated')
    } else {
      const newEvent: CalendarEvent = {
        ...eventData,
        id: Date.now().toString(),
      }
      setEvents((currentEvents) => [...(currentEvents || []), newEvent])
      toast.success('Event added')
    }
    setEditingEvent(null)
  }

  const handleEditEvent = () => {
    if (selectedEvent) {
      setEditingEvent(selectedEvent)
      setShowDetailsDialog(false)
      setShowEventDialog(true)
    }
  }

  const handleDeleteEvent = () => {
    if (selectedEvent) {
      setEvents((currentEvents) => (currentEvents || []).filter((e) => e.id !== selectedEvent.id))
      toast.success('Event deleted')
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
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <CaretLeft size={20} />
            </Button>
            <h2 className="text-2xl font-semibold min-w-[200px] text-center">
              {formatMonthYear(currentDate)}
            </h2>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <CaretRight size={20} />
            </Button>
            <Button variant="outline" onClick={handleToday}>
              Today
            </Button>
          </div>

          {(members || []).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Funnel size={18} className="text-muted-foreground" />
              {(members || []).map((member) => (
                <motion.button
                  key={member.id}
                  onClick={() => toggleFilter(member.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                    activeFilters.includes(member.id) || activeFilters.length === 0
                      ? 'text-white'
                      : 'opacity-40'
                  )}
                  style={{
                    backgroundColor: member.color,
                    border: `2px solid ${member.color}`,
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {member.name}
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {hasNoEvents && hasNoMembers ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 px-4"
          >
            <CalendarBlank size={80} className="text-muted-foreground mb-4" weight="duotone" />
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
            events={events || []}
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