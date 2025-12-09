# Planning Guide

A collaborative family calendar application that helps families coordinate schedules, track important events, and stay connected through shared visibility of everyone's activities.

**Experience Qualities**: 
1. **Welcoming** - The interface should feel warm and inclusive, making all family members want to engage with it regardless of their technical comfort level.
2. **Organized** - Information should be clearly structured and easy to scan, reducing cognitive load when planning busy family schedules.
3. **Playful** - Subtle personality and delightful interactions that reflect the joy of family life without compromising functionality.

**Complexity Level**: Light Application (multiple features with basic state)
This is a calendar application with event creation, editing, and viewing capabilities across different time periods, but doesn't require complex integrations or advanced features like real-time collaboration or external API connections.

## Essential Features

### Calendar View Navigation
- **Functionality**: Display events in month view with ability to navigate between months
- **Purpose**: Provide at-a-glance overview of family schedule and temporal context
- **Trigger**: User opens the app or clicks navigation arrows
- **Progression**: App loads → Current month displays with all events → User clicks prev/next → Calendar transitions to selected month → Events for that month appear
- **Success criteria**: All events display on correct dates, navigation is smooth, current day is visually distinct

### Event Creation
- **Functionality**: Add new family events with title, date, time, family member assignment, and optional description
- **Purpose**: Enable families to record and share upcoming activities
- **Trigger**: User clicks "Add Event" button
- **Progression**: User clicks add button → Modal/form opens → User enters event details → User selects family member(s) → User saves → Event appears on calendar
- **Success criteria**: Events persist between sessions, appear immediately on calendar, all fields are validated

### Event Details & Editing
- **Functionality**: View full event information and modify existing events
- **Purpose**: Allow families to update plans as they change and view complete event context
- **Trigger**: User clicks on an event in the calendar
- **Progression**: User clicks event → Details panel/modal opens → User views full information → User clicks edit → Fields become editable → User saves changes → Updated event reflects on calendar
- **Success criteria**: Changes save correctly, deletion works with confirmation, no data loss occurs

### Family Member Management
- **Functionality**: Define family members with names and assigned colors for visual differentiation
- **Purpose**: Quickly identify whose schedule items belong to whom at a glance
- **Trigger**: First-time setup or accessing settings
- **Progression**: User accesses member management → User adds member name → System assigns color → Member appears in event creation options → Events tagged with member show in their color
- **Success criteria**: Colors are distinct and accessible, members can be edited/removed, color coding is consistent throughout app

### Event Filtering
- **Functionality**: Toggle visibility of events by family member
- **Purpose**: Reduce visual clutter and focus on specific person's schedule
- **Trigger**: User clicks on family member filter chips/toggles
- **Progression**: User views full calendar → User clicks member filter → Calendar updates to show only selected members → User can toggle multiple members → Calendar reflects active filters
- **Success criteria**: Filtering is instant, clear indication of active filters, easy to reset to view all

## Edge Case Handling

- **Empty States**: Show helpful illustrations and prompts when no events exist or no family members are configured
- **Date Boundaries**: Handle events correctly across month/year boundaries and prevent invalid date entries
- **Long Text**: Truncate long event titles on calendar grid, show full text in detail view with appropriate wrapping
- **Overlapping Events**: Stack or indicate multiple events on same day with count badge and scrollable day view
- **Past Events**: Visually distinguish past events (muted appearance) while keeping them accessible for reference
- **No Family Members**: Prompt user to add family members on first launch, allow "unassigned" events as fallback

## Design Direction

The design should evoke feelings of warmth, connection, and household harmony. It should feel like a modern family command center - organized but not sterile, functional but not corporate. The aesthetic should bridge generations, appealing to both parents managing logistics and children checking their activities. Think of cozy Sunday planning sessions with coffee and colorful markers on a shared wall calendar.

## Color Selection

A vibrant yet harmonious palette that celebrates family diversity through distinct member colors while maintaining a warm, inviting base.

- **Primary Color**: Deep Plum (oklch(0.45 0.15 330)) - Conveys warmth and sophistication, grounds the interface with a welcoming richness that feels less corporate than blues
- **Secondary Colors**: Soft Cream (oklch(0.96 0.015 85)) for secondary actions and subtle backgrounds, providing breathing room and warmth
- **Accent Color**: Coral (oklch(0.68 0.18 25)) - Energetic and inviting, perfect for CTAs like "Add Event" and important interactive elements
- **Foreground/Background Pairings**: 
  - Background Cream (oklch(0.98 0.01 85)): Deep Plum text (oklch(0.45 0.15 330)) - Ratio 7.8:1 ✓
  - Primary Plum (oklch(0.45 0.15 330)): White text (oklch(1 0 0)) - Ratio 8.2:1 ✓
  - Accent Coral (oklch(0.68 0.18 25)): Deep text (oklch(0.25 0.02 330)) - Ratio 6.1:1 ✓
  - Card White (oklch(1 0 0)): Foreground text (oklch(0.25 0.02 330)) - Ratio 13.5:1 ✓

Family member colors will use a predefined palette of distinct, saturated hues (blues, greens, oranges, purples, pinks, teals) ensuring sufficient contrast against light backgrounds.

## Font Selection

Typography should feel approachable and friendly while maintaining excellent readability across generations - from grandparents to young children learning to read.

- **Primary Font**: Outfit (Google Fonts) - A friendly geometric sans-serif with rounded terminals that feels contemporary and welcoming without being childish
- **Typographic Hierarchy**: 
  - H1 (Month/Year Header): Outfit Bold/32px/tight letter spacing/-0.02em
  - H2 (Section Headers): Outfit Semibold/24px/normal letter spacing
  - H3 (Event Titles in Details): Outfit Medium/18px/normal letter spacing
  - Body (Event descriptions): Outfit Regular/15px/relaxed line-height/1.6
  - Small (Times, dates, metadata): Outfit Regular/13px/tight letter spacing/uppercase for labels
  - Calendar Dates: Outfit Medium/14px/tabular numbers for alignment

## Animations

Animations should feel organic and purposeful, enhancing the sense of navigating through time. Use smooth transitions when changing months (subtle slide effect). Event creation should feel satisfying with a gentle scale-in and fade. Hover states on calendar dates should lift slightly with a subtle shadow. Filter toggles should have smooth color transitions. Overall timing should be brisk (200-300ms) to maintain responsiveness while adding polish - think of flipping pages in a planner rather than heavy, attention-seeking movements.

## Component Selection

- **Components**: 
  - Calendar grid: Custom component with Button variants for each date cell
  - Event creation/editing: Dialog with Form components (Input, Textarea, Select for time/member)
  - Date navigation: Button with Phosphor CaretLeft/CaretRight icons
  - Family member filters: Custom chips using Badge with Toggle functionality
  - Event cards: Card component with hover effects and color-coded left border accent
  - Settings for members: Sheet side panel with Form components and color picker
  - Empty states: Custom illustrations with muted text
  - Toasts: Sonner for success/error feedback

- **Customizations**: 
  - Custom calendar grid component (7-column grid with day headers)
  - Color-coded event indicators with family member assigned colors
  - Date cells with multiple event display (show first 2-3, "+X more" indicator)
  - Custom color picker/selector for family member assignment

- **States**: 
  - Calendar dates: default, hover (subtle lift with shadow), today (distinct border/background), has-events (dot indicators or count badge), selected (when viewing day detail)
  - Add Event button: Prominent with Coral background, white text, hover lifts and slightly scales
  - Event cards: Hover reveals edit/delete actions, clicking opens detail modal
  - Family member filters: Toggle between active (full opacity, member color border) and inactive (reduced opacity)
  - Form inputs: Clear focus states with primary color ring, error states in red with helpful messages

- **Icon Selection**: 
  - Plus (Add event)
  - CaretLeft/CaretRight (Month navigation)
  - CalendarBlank (Empty state)
  - Users (Family member section)
  - Clock (Time selection)
  - Pencil (Edit)
  - Trash (Delete)
  - X (Close modals)
  - Check (Confirm actions)
  - Funnel (Filter indication)

- **Spacing**: 
  - Calendar grid: gap-2 between date cells, p-4 for each cell
  - Page padding: p-6 on desktop, p-4 on mobile
  - Card spacing: p-5 for event cards
  - Form fields: gap-4 between fields, gap-6 between sections
  - Header spacing: mb-6 for page header with navigation
  - Event list items: gap-3 between items

- **Mobile**: 
  - Calendar switches to vertical scroll on mobile with date cells remaining tappable (min 44px)
  - Event creation dialog becomes full-screen sheet from bottom
  - Family member filters become horizontal scrollable chips at top
  - Navigation controls stack vertically with larger touch targets
  - Event cards stack with full width
  - Consider week view as alternative to month on small screens for better readability
