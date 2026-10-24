import { BrevoEmailClient } from './brevo-client'
import { loadBrevoConfig } from './config'
import {
  DuplicateSendPreventedError,
  EmailAddressMissingOrInvalidError,
  EventCancelledError,
  EventExpiredError,
  InvalidEventDateError,
  RegistrationCancelledError,
  ReminderError,
} from './errors'
import { logEmailFailure } from './logger'
import { InMemoryReminderStore, type IReminderStore } from './store'
import {
  buildConfirmationEmail,
  buildEventCancelledEmail,
  buildEventUpdateEmail,
  buildReminderEmail,
} from './templates'
import type {
  Attendee,
  BatchReminderResult,
  BrevoConfig,
  Event,
  EventUpdateResult,
  Registration,
  ReminderStatus,
} from './types'

export interface ReminderServiceOptions {
  store?: IReminderStore
  client?: BrevoEmailClient
  config?: Partial<BrevoConfig>
  defaultLeadTimeMinutes?: number
}

export class EmailReminderService {
  readonly store: IReminderStore
  readonly client: BrevoEmailClient
  readonly defaultLeadTimeMinutes: number

  constructor(options: ReminderServiceOptions = {}) {
    this.store = options.store || new InMemoryReminderStore()

    if (options.client) {
      this.client = options.client
    } else {
      const config = loadBrevoConfig(options.config)
      this.client = new BrevoEmailClient(config)
    }

    this.defaultLeadTimeMinutes = options.defaultLeadTimeMinutes ?? 1440 // 24 hours
  }

  /**
   * Helper to create or register an event in the store.
   */
  async createEvent(eventData: Omit<Event, 'createdAt' | 'updatedAt'>): Promise<Event> {
    this.validateEventDate(eventData.startTime)
    if (eventData.endTime) {
      this.validateEventDate(eventData.endTime)
    }

    const nowIso = new Date().toISOString()
    const event: Event = {
      ...eventData,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    return this.store.saveEvent(event)
  }

  /**
   * Register an attendee for an event, store registration with reminder status,
   * and send confirmation email via Brevo.
   */
  async registerForEvent(params: {
    eventId: string
    attendee: Attendee
    now?: Date
  }): Promise<{
    registration: Registration
    confirmationSent: boolean
    messageId?: string
    error?: string
  }> {
    const now = params.now || new Date()
    const nowIso = now.toISOString()

    // 1. Validate Attendee Email
    this.validateAttendeeEmail(params.attendee)

    // 2. Fetch and Validate Event
    const event = await this.store.getEvent(params.eventId)
    if (!event) {
      throw new ReminderError(`Event with id "${params.eventId}" does not exist`)
    }

    if (event.status === 'cancelled') {
      throw new EventCancelledError(event.id)
    }

    this.validateEventDate(event.startTime)
    const eventStartMs = new Date(event.startTime).getTime()
    if (eventStartMs <= now.getTime()) {
      throw new EventExpiredError(event.id, event.startTime)
    }

    // 3. Prevent Duplicate Registration
    const existing = await this.store.findRegistrationByEventAndEmail(
      params.eventId,
      params.attendee.email
    )
    if (existing) {
      if (existing.status === 'registered') {
        // Already registered. Check if confirmation already sent.
        if (existing.reminderStatus.confirmationSent) {
          return {
            registration: existing,
            confirmationSent: true,
            messageId: existing.reminderStatus.confirmationMessageId,
            error: 'Attendee is already registered and confirmation was already sent.',
          }
        }
      }
    }

    // 4. Create and Store Registration with initial ReminderStatus
    const registrationId =
      existing?.id || `reg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const initialStatus: ReminderStatus = existing?.reminderStatus || {
      confirmationSent: false,
      reminderSent: false,
      cancellationSent: false,
      auditLog: [],
    }

    const registration: Registration = {
      id: registrationId,
      eventId: event.id,
      attendee: { ...params.attendee },
      status: 'registered',
      registeredAt: existing?.registeredAt || nowIso,
      reminderStatus: initialStatus,
    }

    await this.store.saveRegistration(registration)

    // 5. Send Confirmation Email via Brevo
    const emailPayload = buildConfirmationEmail(event, registration.attendee, registration)

    try {
      const sendResult = await this.client.sendEmail(emailPayload)

      // Update Reminder Status to mark confirmation as sent
      const updatedReg = await this.store.updateReminderStatus(
        registration.id,
        {
          confirmationSent: true,
          confirmationSentAt: nowIso,
          confirmationMessageId: sendResult.messageId,
          lastError: undefined,
        },
        {
          action: 'confirmation_sent',
          timestamp: nowIso,
          messageId: sendResult.messageId,
        }
      )

      return {
        registration: updatedReg,
        confirmationSent: true,
        messageId: sendResult.messageId,
      }
    } catch (sendErr) {
      const errorMsg = sendErr instanceof Error ? sendErr.message : 'Failed to send confirmation email'

      logEmailFailure({
        eventId: event.id,
        registrationId: registration.id,
        emailType: 'confirmation',
        timestamp: nowIso,
        errorCategory: 'CONFIRMATION_SEND_FAILED',
        errorMessage: errorMsg,
      })

      // Safely record error in registration status without losing registration
      const updatedReg = await this.store.updateReminderStatus(
        registration.id,
        {
          confirmationSent: false,
          lastError: errorMsg,
        },
        {
          action: 'send_failed',
          timestamp: nowIso,
          error: errorMsg,
        }
      )

      return {
        registration: updatedReg,
        confirmationSent: false,
        error: errorMsg,
      }
    }
  }

  /**
   * Resend confirmation email if not previously sent (or retry after failure).
   * Prevents duplicate confirmation email if already marked sent.
   */
  async sendConfirmationEmail(registrationId: string): Promise<{
    sent: boolean
    messageId?: string
    error?: string
  }> {
    const reg = await this.store.getRegistration(registrationId)
    if (!reg) {
      throw new ReminderError(`Registration "${registrationId}" not found`)
    }

    if (reg.status === 'cancelled') {
      throw new RegistrationCancelledError(registrationId)
    }

    if (reg.reminderStatus.confirmationSent) {
      throw new DuplicateSendPreventedError(registrationId, 'confirmation')
    }

    const event = await this.store.getEvent(reg.eventId)
    if (!event) {
      throw new ReminderError(`Event "${reg.eventId}" not found`)
    }

    const nowIso = new Date().toISOString()
    const emailPayload = buildConfirmationEmail(event, reg.attendee, reg)

    try {
      const res = await this.client.sendEmail(emailPayload)
      await this.store.updateReminderStatus(
        registrationId,
        {
          confirmationSent: true,
          confirmationSentAt: nowIso,
          confirmationMessageId: res.messageId,
        },
        {
          action: 'confirmation_sent',
          timestamp: nowIso,
          messageId: res.messageId,
        }
      )
      return { sent: true, messageId: res.messageId }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send confirmation'
      await this.store.updateReminderStatus(
        registrationId,
        { lastError: errorMsg },
        { action: 'send_failed', timestamp: nowIso, error: errorMsg }
      )
      return { sent: false, error: errorMsg }
    }
  }

  /**
   * Scan for active registrations whose events are approaching and send reminder emails.
   * Prevents duplicate reminders, skips cancelled registrations, expired events, and invalid emails.
   */
  async sendUpcomingReminders(options?: {
    now?: Date
    leadTimeMinutes?: number
  }): Promise<BatchReminderResult> {
    const now = options?.now || new Date()
    const nowIso = now.toISOString()
    const leadTime = options?.leadTimeMinutes ?? this.defaultLeadTimeMinutes

    const dueList = await this.store.findDueReminders(now, leadTime)

    const result: BatchReminderResult = {
      processed: dueList.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      details: [],
    }

    for (const { registration: reg, event } of dueList) {
      // Safety checks:
      if (reg.status !== 'registered') {
        result.skipped++
        result.details.push({
          registrationId: reg.id,
          eventId: event.id,
          status: 'skipped',
          reason: 'Registration is cancelled',
        })
        continue
      }

      if (reg.reminderStatus.reminderSent) {
        result.skipped++
        result.details.push({
          registrationId: reg.id,
          eventId: event.id,
          status: 'skipped',
          reason: 'Reminder already sent (duplicate prevented)',
        })
        continue
      }

      if (event.status !== 'scheduled') {
        result.skipped++
        result.details.push({
          registrationId: reg.id,
          eventId: event.id,
          status: 'skipped',
          reason: `Event status is "${event.status}"`,
        })
        continue
      }

      const startMs = new Date(event.startTime).getTime()
      if (startMs <= now.getTime()) {
        result.skipped++
        result.details.push({
          registrationId: reg.id,
          eventId: event.id,
          status: 'skipped',
          reason: 'Event has already started or expired',
        })
        continue
      }

      const email = reg.attendee.email?.trim()
      if (!email || !email.includes('@')) {
        result.skipped++
        result.details.push({
          registrationId: reg.id,
          eventId: event.id,
          status: 'skipped',
          reason: 'Missing or invalid attendee email',
        })
        continue
      }

      // Build & Send Reminder
      const reminderPayload = buildReminderEmail(event, reg.attendee, reg)
      try {
        const sendRes = await this.client.sendEmail(reminderPayload)

        await this.store.updateReminderStatus(
          reg.id,
          {
            reminderSent: true,
            reminderSentAt: nowIso,
            reminderMessageId: sendRes.messageId,
          },
          {
            action: 'reminder_sent',
            timestamp: nowIso,
            messageId: sendRes.messageId,
          }
        )

        result.sent++
        result.details.push({
          registrationId: reg.id,
          eventId: event.id,
          status: 'sent',
          messageId: sendRes.messageId,
        })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Error sending reminder'

        logEmailFailure({
          eventId: event.id,
          registrationId: reg.id,
          emailType: 'reminder',
          timestamp: nowIso,
          errorCategory: 'REMINDER_SEND_FAILED',
          errorMessage: errMsg,
        })

        await this.store.updateReminderStatus(
          reg.id,
          { lastError: errMsg },
          {
            action: 'send_failed',
            timestamp: nowIso,
            error: errMsg,
          }
        )

        result.failed++
        result.details.push({
          registrationId: reg.id,
          eventId: event.id,
          status: 'failed',
          reason: errMsg,
        })
      }
    }

    return result
  }

  /**
   * Update an event (e.g. time, location, cancellation) and notify registered attendees.
   */
  async updateEvent(
    eventId: string,
    updates: Partial<Event>,
    options?: { reason?: string; now?: Date }
  ): Promise<EventUpdateResult> {
    const event = await this.store.getEvent(eventId)
    if (!event) {
      throw new ReminderError(`Event with id "${eventId}" not found`)
    }

    if (updates.startTime) {
      this.validateEventDate(updates.startTime)
    }
    if (updates.endTime) {
      this.validateEventDate(updates.endTime)
    }

    const previousStartTime = event.startTime
    const timeChanged = Boolean(updates.startTime && updates.startTime !== previousStartTime)
    const isCancelled = updates.status === 'cancelled'

    // Update in store
    const updatedEvent = await this.store.updateEvent(eventId, updates)

    const registrations = await this.store.getRegistrationsByEvent(eventId)
    const activeRegistrations = registrations.filter((r) => r.status === 'registered')

    const now = options?.now || new Date()
    const nowIso = now.toISOString()

    const result: EventUpdateResult = {
      eventId,
      updatedFields: Object.keys(updates),
      recipientsCount: activeRegistrations.length,
      sentCount: 0,
      failedCount: 0,
      messageIds: [],
      errors: [],
    }

    for (const reg of activeRegistrations) {
      try {
        if (isCancelled) {
          if (reg.reminderStatus.cancellationSent) {
            // Already sent cancellation notice to this attendee
            continue
          }

          const cancelPayload = buildEventCancelledEmail(
            updatedEvent,
            reg.attendee,
            options?.reason
          )
          const sendRes = await this.client.sendEmail(cancelPayload)

          await this.store.updateReminderStatus(
            reg.id,
            {
              cancellationSent: true,
              cancellationSentAt: nowIso,
              cancellationMessageId: sendRes.messageId,
            },
            {
              action: 'cancellation_sent',
              timestamp: nowIso,
              messageId: sendRes.messageId,
            }
          )

          result.sentCount++
          result.messageIds.push(sendRes.messageId)
        } else {
          // Regular update or time change
          const updatePayload = buildEventUpdateEmail(updatedEvent, reg.attendee, {
            reason: options?.reason,
            timeChanged,
            previousStartTime: timeChanged ? previousStartTime : undefined,
          })

          const sendRes = await this.client.sendEmail(updatePayload)

          // If time changed and moved into the future, reset reminderSent if previously sent
          // so they get a reminder for the updated time!
          const resetReminder =
            timeChanged &&
            new Date(updatedEvent.startTime).getTime() > now.getTime() &&
            reg.reminderStatus.reminderSent

          await this.store.updateReminderStatus(
            reg.id,
            {
              lastUpdateSentAt: nowIso,
              lastUpdateMessageId: sendRes.messageId,
              ...(resetReminder ? { reminderSent: false } : {}),
            },
            {
              action: 'update_sent',
              timestamp: nowIso,
              messageId: sendRes.messageId,
            }
          )

          result.sentCount++
          result.messageIds.push(sendRes.messageId)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to send event update email'

        logEmailFailure({
          eventId,
          registrationId: reg.id,
          emailType: isCancelled ? 'cancellation' : 'update',
          timestamp: nowIso,
          errorCategory: isCancelled ? 'CANCELLATION_SEND_FAILED' : 'UPDATE_SEND_FAILED',
          errorMessage: errorMsg,
        })

        result.failedCount++
        result.errors.push({
          registrationId: reg.id,
          error: errorMsg,
        })
      }
    }

    return result
  }

  /**
   * Cancel an event and notify all registered attendees.
   */
  async cancelEvent(eventId: string, reason?: string): Promise<EventUpdateResult> {
    return this.updateEvent(eventId, { status: 'cancelled' }, { reason })
  }

  /**
   * Cancel an individual attendee registration.
   */
  async cancelRegistration(registrationId: string): Promise<Registration> {
    return this.store.updateRegistrationStatus(registrationId, 'cancelled')
  }

  private validateAttendeeEmail(attendee?: Attendee): void {
    if (!attendee || !attendee.email) {
      throw new EmailAddressMissingOrInvalidError()
    }
    const email = attendee.email.trim()
    if (!email || !email.includes('@') || email.length < 5) {
      throw new EmailAddressMissingOrInvalidError(attendee.email)
    }
  }

  private validateEventDate(dateString: string): void {
    if (!dateString || typeof dateString !== 'string') {
      throw new InvalidEventDateError(dateString)
    }
    const parsed = Date.parse(dateString)
    if (isNaN(parsed)) {
      throw new InvalidEventDateError(dateString)
    }
  }
}
