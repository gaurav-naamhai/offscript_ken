import type { IncomingMessage, ServerResponse } from 'node:http'
import { EmailReminderService } from './reminder-service'
import { runReminderScheduler } from './scheduler'
import type { BatchReminderResult, EventUpdateResult, Registration } from './types'

// Server-side singleton instance for managing reminder workflows
export const defaultReminderService = new EmailReminderService()

export interface RsvpReminderParams {
  event: {
    id: string
    title: string
    description?: string
    startTime: string
    endTime?: string
    location?: string
  }
  attendee: {
    id: string
    name?: string
    email: string
  }
}

export interface UpdateReminderParams {
  eventId: string
  updates: {
    title?: string
    description?: string
    startTime?: string
    endTime?: string
    location?: string
  }
  reason?: string
}

export interface CancelReminderParams {
  eventId: string
  reason?: string
}

export async function handleRsvpReminder(
  params: RsvpReminderParams,
  service = defaultReminderService
): Promise<{ registration?: Registration; confirmationSent: boolean; error?: string }> {
  if (!params.attendee.email || !params.attendee.email.includes('@')) {
    return { confirmationSent: false, error: 'Valid attendee email is required for confirmation' }
  }

  // Ensure event exists in reminder store
  let event = await service.store.getEvent(params.event.id)
  if (!event) {
    try {
      event = await service.createEvent({
        id: params.event.id,
        title: params.event.title,
        description: params.event.description,
        startTime: params.event.startTime,
        endTime: params.event.endTime,
        location: params.event.location,
        status: 'scheduled',
      })
    } catch {
      // Event might already exist in concurrent store
      event = await service.store.getEvent(params.event.id)
    }
  }

  const result = await service.registerForEvent({
    eventId: params.event.id,
    attendee: {
      id: params.attendee.id,
      name: params.attendee.name || 'Attendee',
      email: params.attendee.email.trim(),
    },
  })

  // confirmationSent is true only if a new confirmation was dispatched on this call
  const newlySent = Boolean(result.confirmationSent && !result.error)

  return {
    registration: result.registration,
    confirmationSent: newlySent,
    error: result.error,
  }
}

export async function handleUpdateReminder(
  params: UpdateReminderParams,
  service = defaultReminderService
): Promise<EventUpdateResult & { success: boolean; error?: string }> {
  try {
    const result = await service.updateEvent(params.eventId, params.updates, { reason: params.reason })
    return { ...result, success: result.failedCount === 0 }
  } catch (err) {
    return {
      eventId: params.eventId,
      updatedFields: [],
      recipientsCount: 0,
      sentCount: 0,
      failedCount: 0,
      messageIds: [],
      errors: [],
      success: false,
      error: err instanceof Error ? err.message : 'Update failed',
    }
  }
}

export async function handleCancelReminder(
  params: CancelReminderParams,
  service = defaultReminderService
): Promise<EventUpdateResult & { success: boolean; error?: string }> {
  try {
    const result = await service.cancelEvent(params.eventId, params.reason)
    return { ...result, success: result.failedCount === 0 }
  } catch (err) {
    return {
      eventId: params.eventId,
      updatedFields: [],
      recipientsCount: 0,
      sentCount: 0,
      failedCount: 0,
      messageIds: [],
      errors: [],
      success: false,
      error: err instanceof Error ? err.message : 'Cancel failed',
    }
  }
}

export async function handleCronReminder(
  service = defaultReminderService
): Promise<BatchReminderResult> {
  return runReminderScheduler({ service })
}

/**
 * Node.js / Connect HTTP middleware for handling server-side reminder endpoints.
 * Keeps Brevo API key strictly server-side.
 */
export function reminderApiMiddleware(service = defaultReminderService) {
  return async (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
    const url = req.url || ''
    if (!url.startsWith('/api/reminders')) {
      if (next) next()
      return
    }

    const sendJson = (status: number, data: unknown) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(data))
    }

    if (req.method === 'GET' && url === '/api/reminders/health') {
      sendJson(200, { status: 'ok', mockMode: service.client.isMockMode() })
      return
    }

    if (req.method === 'POST' && url === '/api/reminders/cron') {
      try {
        const result = await handleCronReminder(service)
        sendJson(200, { success: true, result })
      } catch (err) {
        sendJson(500, { success: false, error: err instanceof Error ? err.message : 'Cron failed' })
      }
      return
    }

    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })

    req.on('end', async () => {
      let parsed: any = {}
      try {
        if (body) parsed = JSON.parse(body)
      } catch {
        sendJson(400, { error: 'Invalid JSON body' })
        return
      }

      try {
        if (req.method === 'POST' && url === '/api/reminders/rsvp') {
          const result = await handleRsvpReminder(parsed, service)
          sendJson(200, result)
        } else if (req.method === 'POST' && url === '/api/reminders/update') {
          const result = await handleUpdateReminder(parsed, service)
          sendJson(200, result)
        } else if (req.method === 'POST' && url === '/api/reminders/cancel') {
          const result = await handleCancelReminder(parsed, service)
          sendJson(200, result)
        } else {
          sendJson(404, { error: 'Not found' })
        }
      } catch (err) {
        sendJson(500, { error: err instanceof Error ? err.message : 'Server error' })
      }
    })
  }
}
