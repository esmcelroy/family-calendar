import ICAL from 'ical.js'
import type { IcsSubscription, SubscribedEvent } from './types'

/**
 * Fetches an ICS calendar and converts its VEVENT components into displayable events.
 * Timed values use the browser's local timezone; date-only values remain unchanged.
 * Original VEVENT and VTIMEZONE data is retained for faithful export.
 */
export async function fetchAndParseIcs(url: string, corsProxy?: string): Promise<SubscribedEvent[]> {
  if (!url.trim()) {
    throw new Error('An ICS URL is required.')
  }

  const request = prepareRequest(url)
  let icsText: string
  try {
    icsText = await fetchCalendarText(request.url, request.headers)
  } catch (directError) {
    if (request.hasCredentials && directError instanceof TypeError) {
      throw new Error(
        `Unable to fetch ICS calendar from ${redactUrlCredentials(url)} with URL-embedded credentials. ` +
        'The source must allow the Authorization header through CORS; credentials are not sent to a proxy.',
      )
    }

    if (request.hasCredentials || !(directError instanceof TypeError)) {
      throw directError
    }

    if (!corsProxy) {
      throw directError
    }

    try {
      icsText = await fetchCalendarText(getProxyUrl(corsProxy, request.url))
    } catch (proxyError) {
      throw new Error(
        `Unable to fetch ICS calendar from ${redactUrlCredentials(url)}: ${getErrorMessage(proxyError)}`,
      )
    }
  }

  let calendar: ICAL.Component
  try {
    calendar = ICAL.Component.fromString(icsText)
  } catch (error) {
    throw new Error(`Unable to parse ICS calendar from ${redactUrlCredentials(url)}: ${getErrorMessage(error)}`)
  }

  if (calendar.name !== 'vcalendar') {
    throw new Error(`The response from ${redactUrlCredentials(url)} is not a valid VCALENDAR document.`)
  }

  const timeZones = calendar.getAllSubcomponents('vtimezone').map((component) => component.toString())
  return calendar.getAllSubcomponents('vevent').map((component, index) => {
    if (!component.hasProperty('dtstart')) {
      throw new Error(
        `Event ${index + 1} in ${redactUrlCredentials(url)} is missing a DTSTART property.`,
      )
    }

    const event = new ICAL.Event(component)
    const uid = event.uid
    if (!uid) {
      throw new Error(`Event ${index + 1} in ${redactUrlCredentials(url)} is missing a UID property.`)
    }

    const recurrenceId = event.recurrenceId?.toString()
    const startDate = event.startDate
    const endDate = event.endDate
    const displayStart = startDate.isDate ? startDate : ICAL.Time.fromJSDate(startDate.toJSDate())
    const displayEnd = endDate && !endDate.isDate ? ICAL.Time.fromJSDate(endDate.toJSDate()) : endDate
    const startTime = displayStart.isDate ? undefined : formatTime(displayStart)
    const endTime = displayEnd && !displayEnd.isDate ? formatTime(displayEnd) : undefined

    return {
      id: recurrenceId ? `${uid}:${recurrenceId}` : uid,
      uid,
      ...(recurrenceId ? { recurrenceId } : {}),
      title: event.summary || 'Untitled event',
      date: formatDate(displayStart),
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(event.description ? { description: event.description } : {}),
      memberIds: [],
      icalComponent: component.toString(),
      icalTimeZones: timeZones,
    }
  })
}

/**
 * Combines events from enabled subscriptions, removes duplicate UIDs (first source wins),
 * and strips VALARM components from each event's retained iCalendar data.
 */
export function mergeAndStripAlarms(
  subscriptions: readonly IcsSubscription[],
  eventsMap: ReadonlyMap<string, readonly SubscribedEvent[]>,
): SubscribedEvent[] {
  const merged: SubscribedEvent[] = []
  const uidOwners = new Map<string, string>()

  for (const subscription of subscriptions) {
    if (!subscription.enabled) continue

    for (const event of eventsMap.get(subscription.id) ?? []) {
      const owner = uidOwners.get(event.uid)
      if (owner && owner !== subscription.id) continue
      uidOwners.set(event.uid, subscription.id)

      const component = ICAL.Component.fromString(event.icalComponent)
      component.removeAllSubcomponents('valarm')

      merged.push({
        ...event,
        id: `${subscription.id}:${event.id}`,
        sourceSubscriptionId: subscription.id,
        sourceName: subscription.name,
        color: subscription.color,
        icalComponent: component.toString(),
        icalTimeZones: event.icalTimeZones,
      })
    }
  }

  return merged
}

/**
 * Serializes subscribed event components as a complete RFC 5545 VCALENDAR document.
 */
export function exportToIcsString(events: readonly SubscribedEvent[]): string {
  const calendar = new ICAL.Component('vcalendar')
  calendar.addPropertyWithValue('version', '2.0')
  calendar.addPropertyWithValue('prodid', '-//Family Calendar//EN')
  calendar.addPropertyWithValue('calscale', 'GREGORIAN')
  calendar.addPropertyWithValue('method', 'PUBLISH')

  const timeZonesBySource = new Map<string, Map<string, string>>()
  const timeZonesByOutputId = new Map<string, string>()
  const timeZoneComponents = new Map<string, ICAL.Component>()

  for (const event of events) {
    const sourceId = event.sourceSubscriptionId ?? event.icalTimeZones.join('\n')
    let sourceTimeZones = timeZonesBySource.get(sourceId)
    if (!sourceTimeZones) {
      sourceTimeZones = new Map()
      timeZonesBySource.set(sourceId, sourceTimeZones)
    }

    for (const timeZoneText of event.icalTimeZones) {
      const timeZone = ICAL.Component.fromString(timeZoneText)
      const id = timeZone.getFirstPropertyValue('tzid')
      if (typeof id !== 'string' || !id) {
        throw new Error('A VTIMEZONE component is missing its TZID property.')
      }

      const normalizedText = timeZone.toString()
      const existingSourceId = sourceTimeZones.get(id)
      if (existingSourceId) {
        const existingText = timeZonesByOutputId.get(existingSourceId)
        if (existingText !== normalizedText) {
          throw new Error(`Source calendar contains conflicting VTIMEZONE definitions for "${id}".`)
        }
        continue
      }

      const outputId = getUniqueTimeZoneId(id, sourceId, normalizedText, timeZonesByOutputId)
      sourceTimeZones.set(id, outputId)
      timeZone.updatePropertyWithValue('tzid', outputId)
      const renamedText = timeZone.toString()
      timeZonesByOutputId.set(outputId, renamedText)
      timeZoneComponents.set(outputId, timeZone)
    }
  }

  for (const timeZone of timeZoneComponents.values()) {
    calendar.addSubcomponent(timeZone)
  }

  for (const event of events) {
    const component = ICAL.Component.fromString(event.icalComponent)
    component.removeAllSubcomponents('valarm')
    const sourceId = event.sourceSubscriptionId ?? event.icalTimeZones.join('\n')
    const sourceTimeZones = timeZonesBySource.get(sourceId)
    rewriteTimeZoneReferences(component, sourceTimeZones)
    calendar.addSubcomponent(component)
  }

  return calendar.toString()
}

function getUniqueTimeZoneId(
  originalId: string,
  sourceId: string,
  definition: string,
  existingDefinitions: ReadonlyMap<string, string>,
): string {
  const existingDefinition = existingDefinitions.get(originalId)
  if (existingDefinition === undefined || existingDefinition === definition) {
    return originalId
  }

  const safeSourceId = sourceId.replace(/[^A-Za-z0-9_-]/g, '_') || 'source'
  let suffix = 1
  let candidate = `${originalId}-family-calendar-${safeSourceId}`
  while (existingDefinitions.has(candidate) && existingDefinitions.get(candidate) !== definition) {
    suffix += 1
    candidate = `${originalId}-family-calendar-${safeSourceId}-${suffix}`
  }
  return candidate
}

function rewriteTimeZoneReferences(
  component: ICAL.Component,
  sourceTimeZones: ReadonlyMap<string, string> | undefined,
): void {
  if (sourceTimeZones) {
    for (const property of component.getAllProperties()) {
      const originalId = property.getFirstParameter('tzid')
      const outputId = sourceTimeZones.get(originalId)
      if (outputId && outputId !== originalId) {
        property.setParameter('tzid', outputId)
      }
    }
  }

  for (const subcomponent of component.getAllSubcomponents()) {
    rewriteTimeZoneReferences(subcomponent, sourceTimeZones)
  }
}

async function fetchCalendarText(url: string, headers?: HeadersInit): Promise<string> {
  const response = headers ? await fetch(url, { headers }) : await fetch(url)
  if (!response.ok) {
    throw new Error(`ICS request failed with HTTP ${response.status}.`)
  }

  return response.text()
}

function prepareRequest(url: string): { url: string; headers?: HeadersInit; hasCredentials: boolean } {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('The ICS URL must be an absolute URL.')
  }

  const hasCredentials = Boolean(parsedUrl.username || parsedUrl.password)
  if (!hasCredentials) {
    return { url, hasCredentials }
  }

  let username: string
  let password: string
  try {
    username = decodeURIComponent(parsedUrl.username)
    password = decodeURIComponent(parsedUrl.password)
  } catch {
    throw new Error('URL-embedded credentials must use valid percent encoding.')
  }

  parsedUrl.username = ''
  parsedUrl.password = ''

  return {
    url: parsedUrl.toString(),
    headers: { Authorization: `Basic ${encodeBasicCredentials(`${username}:${password}`)}` },
    hasCredentials,
  }
}

function encodeBasicCredentials(credentials: string): string {
  const bytes = new TextEncoder().encode(credentials)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function getProxyUrl(corsProxy: string, url: string): string {
  const encodedUrl = encodeURIComponent(url)
  return corsProxy.includes('{url}')
    ? corsProxy.replace('{url}', encodedUrl)
    : `${corsProxy}${encodedUrl}`
}

function formatDate(time: ICAL.Time): string {
  return [
    time.year,
    String(time.month).padStart(2, '0'),
    String(time.day).padStart(2, '0'),
  ].join('-')
}

function formatTime(time: ICAL.Time): string {
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function redactUrlCredentials(url: string): string {
  try {
    const parsedUrl = new URL(url)
    parsedUrl.username = ''
    parsedUrl.password = ''
    return parsedUrl.toString()
  } catch {
    return '[invalid URL]'
  }
}
