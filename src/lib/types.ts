export interface FamilyMember {
  id: string
  name: string
  color: string
}

export interface CalendarEvent {
  id: string
  title: string
  date: string
  startTime?: string
  endTime?: string
  description?: string
  memberIds: string[]
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
