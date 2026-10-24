import type { EventRecord } from './events'
import { supabase } from '../lib/supabase'

type ReminderAction = 'registration_submitted' | 'registration_decision' | 'event_update' | 'event_cancel' | 'send_reminder'
type Result = { success: boolean; error?: string }

async function invokeReminder(action: ReminderAction, eventId: string, recipientUserIds?: string[], scheduledAt?: string): Promise<Result> {
  if (!supabase) return { success: false, error: 'Supabase is not configured.' }
  try {
    const { error } = await supabase.functions.invoke('event-email', { body: { action, eventId, recipientUserIds, scheduledAt } })
    return error ? { success: false, error: error.message } : { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Email request failed.' }
  }
}

// Kept temporarily for the standalone reminder module's legacy tests. The live
// application always uses the string event-id overloads below.
async function legacyRequest(path: string, body: unknown): Promise<Result> {
  try { const result = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return result.ok ? { success: true } : { success: false, error: `HTTP ${result.status}` } } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Reminder request failed' } }
}

export function notifyRegistrationSubmitted(eventId: string): Promise<Result>
export function notifyRegistrationSubmitted(event: EventRecord, attendee: { id: string; email: string; name?: string }): Promise<Result>
export function notifyRegistrationSubmitted(eventOrId: string | EventRecord, attendee?: { id: string; email: string }): Promise<Result> {
  if (typeof eventOrId === 'string') return invokeReminder('registration_submitted', eventOrId)
  if (!attendee?.email) return Promise.resolve({ success: false, error: 'No attendee email provided' })
  return legacyRequest('/api/reminders/rsvp', { event: eventOrId, attendee })
}

// Compatibility export for the standalone reminder module's existing tests.
export const notifyRsvpReminder = notifyRegistrationSubmitted

export function notifyEventUpdateReminder(eventId: string): Promise<Result>
export function notifyEventUpdateReminder(eventId: string, updates: Record<string, unknown>): Promise<Result>
export function notifyEventUpdateReminder(eventId: string, updates?: Record<string, unknown>): Promise<Result> { return updates ? legacyRequest('/api/reminders/update', { eventId, updates }) : invokeReminder('event_update', eventId) }

export function notifyEventCancelReminder(eventId: string): Promise<Result>
export function notifyEventCancelReminder(eventId: string, reason: string): Promise<Result>
export function notifyEventCancelReminder(eventId: string, reason?: string): Promise<Result> { return reason ? legacyRequest('/api/reminders/cancel', { eventId, reason }) : invokeReminder('event_cancel', eventId) }

export const notifyRegistrationDecision = (eventId: string, recipientUserId: string) => invokeReminder('registration_decision', eventId, [recipientUserId])
export const sendOrganizerReminder = (eventId: string, recipientUserIds?: string[], scheduledAt?: string) => invokeReminder('send_reminder', eventId, recipientUserIds, scheduledAt)
