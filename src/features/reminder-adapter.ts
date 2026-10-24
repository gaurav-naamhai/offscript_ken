import type { EventRecord } from './events'

const asIsoTimestamp = (date: string, time: string) => {
  try {
    return new Date(`${date}T${time || '00:00'}:00`).toISOString()
  } catch {
    return date
  }
}

/**
 * Client-side boundary adapter to notify server-side reminder service.
 * Never imports Brevo client or API keys directly, keeping secrets server-side.
 */
export async function notifyRsvpReminder(
  event: EventRecord,
  attendee: { id: string; name?: string; email: string }
): Promise<{ success: boolean; confirmationSent?: boolean; error?: string }> {
  if (!attendee.email || !attendee.email.includes('@')) {
    return { success: false, error: 'No attendee email provided' }
  }

  try {
    const response = await fetch('/api/reminders/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: {
          id: event.id,
          title: event.title,
          description: event.description,
          startTime: asIsoTimestamp(event.startDate, event.startTime),
          endTime: event.endDate ? asIsoTimestamp(event.endDate, event.endTime) : undefined,
          location: event.location,
        },
        attendee: {
          id: attendee.id,
          name: attendee.name,
          email: attendee.email.trim(),
        },
      }),
    })

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { success: true, confirmationSent: Boolean(data.confirmationSent) }
  } catch (err) {
    // Network or server error handled safely
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reach reminder service',
    }
  }
}

export async function notifyEventUpdateReminder(
  eventId: string,
  updates: {
    title?: string
    description?: string
    startDate?: string
    startTime?: string
    endDate?: string
    endTime?: string
    location?: string
  },
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const startTimeIso =
      updates.startDate && updates.startTime
        ? asIsoTimestamp(updates.startDate, updates.startTime)
        : undefined

    const endTimeIso =
      updates.endDate && updates.endTime
        ? asIsoTimestamp(updates.endDate, updates.endTime)
        : undefined

    const response = await fetch('/api/reminders/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        updates: {
          title: updates.title,
          description: updates.description,
          startTime: startTimeIso,
          endTime: endTimeIso,
          location: updates.location,
        },
        reason,
      }),
    })

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reach reminder service',
    }
  }
}

export async function notifyEventCancelReminder(
  eventId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/reminders/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, reason }),
    })

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reach reminder service',
    }
  }
}
