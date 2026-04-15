import { CalendarEvent, FamilyMember } from '@/lib/types'
import { getDaysInMonth, getFirstDayOfMonth, isToday, isPast, getEventsForDate, formatDate } from '@/lib/calendar'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface CalendarGridProps {
  currentDate: Date
  events: CalendarEvent[]
  members: FamilyMember[]
  onDateClick: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
  activeFilters: string[]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarGrid({ currentDate, events, members, onDateClick, onEventClick, activeFilters }: CalendarGridProps) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const shouldReduceMotion = useReducedMotion()

  const filteredEvents = activeFilters.length > 0
    ? events.filter((event) => event.memberIds.some((id) => activeFilters.includes(id)))
    : events

  const getMemberColor = (memberId: string) => {
    return members.find((m) => m.id === memberId)?.color || 'oklch(0.5 0.1 200)'
  }

  const renderDateCell = (day: number) => {
    const date = new Date(year, month, day)
    const dateEvents = getEventsForDate(filteredEvents, date)
    const isCurrentDay = isToday(date)
    const isPastDay = isPast(date)
    const dateLabel = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const eventCount = dateEvents.length
    const cellLabel = `${dateLabel}${isCurrentDay ? ', today' : ''}${eventCount > 0 ? `, ${eventCount} event${eventCount !== 1 ? 's' : ''}` : ', no events'}`

    return (
      <motion.button
        key={day}
        onClick={() => onDateClick(date)}
        aria-label={`Add event on ${cellLabel}`}
        className={cn(
          'min-h-24 p-2 rounded-lg border transition-all hover:shadow-md hover:scale-[1.02]',
          'flex flex-col items-start gap-1 bg-card',
          isCurrentDay && 'border-primary border-2 bg-primary/5',
          isPastDay && 'opacity-60',
          !isCurrentDay && 'hover:border-primary/50'
        )}
        whileHover={shouldReduceMotion ? undefined : { y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <span
          className={cn(
            'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full',
            isCurrentDay && 'bg-primary text-primary-foreground'
          )}
        >
          {day}
        </span>
        <div className="w-full space-y-1">
          {dateEvents.slice(0, 2).map((event) => (
            <button
              key={event.id}
              onClick={(e) => {
                e.stopPropagation()
                onEventClick(event)
              }}
              title={event.title}
              aria-label={`View event: ${event.title}`}
              className="w-full text-left text-xs px-2 py-1 rounded truncate transition-all hover:scale-105"
              style={{
                backgroundColor: event.memberIds.length > 0 ? getMemberColor(event.memberIds[0]) : 'oklch(0.7 0.05 200)',
                color: 'white',
              }}
            >
              {event.title}
            </button>
          ))}
          {dateEvents.length > 2 && (
            <div className="text-xs text-muted-foreground px-2 font-medium">
              +{dateEvents.length - 2} more
            </div>
          )}
        </div>
      </motion.button>
    )
  }

  const emptyDays = Array.from({ length: firstDay }, (_, i) => (
    <div key={`empty-${i}`} className="min-h-24" />
  ))

  const dateCells = Array.from({ length: daysInMonth }, (_, i) => renderDateCell(i + 1))

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {emptyDays}
        {dateCells}
      </div>
    </div>
  )
}
