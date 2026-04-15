export type CalendarPlatform = 'google' | 'apple' | 'outlook' | 'other'

export interface FamilyMember {
  id: string
  name: string
  color: string
  /** Optional email for iMIP invitation delivery */
  email?: string
  /** Preferred calendar platform — used to personalise invitation emails */
  preferredPlatform?: CalendarPlatform
}

export interface CalendarEvent {
  id: string
  title: string
  date: string
  startTime?: string
  endTime?: string
  description?: string
  memberIds: string[]
  seriesId?: string
  recurrence?: RecurrenceRule
  seriesExceptions?: SeriesException[]
  recurrenceMeta?: RecurrenceMeta
  /** Incremented on each edit; used in iMIP SEQUENCE field */
  sequence?: number
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type RecurrenceEndType = 'none' | 'date' | 'count'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval: number
  selectedDays?: number[]
  endType: RecurrenceEndType
  endDate?: string
  endCount?: number
}

export interface SeriesException {
  date: string
  type: 'modified' | 'deleted'
  overrides?: Partial<Omit<CalendarEvent, 'id' | 'memberIds' | 'recurrence' | 'seriesExceptions' | 'recurrenceMeta'>> & {
    memberIds?: string[]
  }
}

export interface RecurrenceMeta {
  sourceEventId: string
  occurrenceDate: string
  isModified: boolean
}

export type RecurringEditScope = 'this' | 'following' | 'all'

// ---------------------------------------------------------------------------
// Spec 013 — Event Invitations & Delivery
// ---------------------------------------------------------------------------

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  fromAddress: string
  fromName: string
}

export interface OrganizerConfig {
  name: string
  email: string
}

/** Transient object representing one outbound iMIP message. */
export interface Invitation {
  recipientEmail: string
  recipientName: string
  recipientPlatform?: CalendarPlatform
  icsPayload: string
  method: 'REQUEST' | 'CANCEL'
  eventId: string
  sequence: number
  gcalUrl?: string
}

export interface DeliveryResult {
  status: 'sent' | 'failed' | 'skipped'
  recipientEmail: string
  error?: string
}

// ---------------------------------------------------------------------------
// Spec 012 — Kiosk / Family Display Mode
// ---------------------------------------------------------------------------

export interface KioskConfig {
  memberFilter: string[]
  refreshIntervalMs: number
}

export const MEMBER_COLORS = [
  { name: 'Sky', value: 'oklch(0.65 0.18 240)' },
  { name: 'Ocean', value: 'oklch(0.55 0.20 220)' },
  { name: 'Emerald', value: 'oklch(0.60 0.18 155)' },
  { name: 'Lime', value: 'oklch(0.70 0.18 130)' },
  { name: 'Amber', value: 'oklch(0.75 0.18 70)' },
  { name: 'Sunset', value: 'oklch(0.65 0.20 35)' },
  { name: 'Rose', value: 'oklch(0.65 0.22 355)' },
  { name: 'Purple', value: 'oklch(0.60 0.20 300)' },
  { name: 'Pink', value: 'oklch(0.70 0.18 340)' },
  { name: 'Teal', value: 'oklch(0.60 0.16 190)' },
]
