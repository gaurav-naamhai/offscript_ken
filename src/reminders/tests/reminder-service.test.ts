import { beforeEach, describe, expect, it } from 'vitest'
import { BrevoEmailClient } from '../brevo-client'
import {
  EmailAddressMissingOrInvalidError,
  EventCancelledError,
  EventExpiredError,
  InvalidEventDateError,
} from '../errors'
import { EmailReminderService } from '../reminder-service'
import { InMemoryReminderStore } from '../store'
import type { Event } from '../types'

describe('EmailReminderService', () => {
  let store: InMemoryReminderStore
  let client: BrevoEmailClient
  let service: EmailReminderService

  const baseDate = new Date('2026-11-01T10:00:00.000Z')
  const futureEventDate = new Date('2026-11-02T10:00:00.000Z').toISOString() // 24 hours later

  let testEvent: Event

  beforeEach(async () => {
    store = new InMemoryReminderStore()
    client = new BrevoEmailClient({
      apiKey: 'xkeysib-mock-key-testing',
      senderEmail: 'events@gather.app',
      senderName: 'Gather Team',
      mockMode: true,
      retryDelayMs: 1,
    })
    service = new EmailReminderService({
      store,
      client,
      defaultLeadTimeMinutes: 1440, // 24h
    })

    testEvent = await service.createEvent({
      id: 'event-1',
      title: 'Design Systems Deep Dive',
      description: 'An interactive workshop on scalable UI architecture.',
      startTime: futureEventDate,
      endTime: new Date('2026-11-02T12:00:00.000Z').toISOString(),
      location: 'Room 402, Gather HQ',
      organizerName: 'Sarah Connor',
      organizerEmail: 'sarah@gather.app',
      status: 'scheduled',
      reminderLeadTimeMinutes: 1440,
    })
  })

  // 1. Successful confirmation email
  it('successfully registers an attendee and sends a confirmation email through Brevo', async () => {
    const result = await service.registerForEvent({
      eventId: testEvent.id,
      attendee: {
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
      },
      now: baseDate,
    })

    expect(result.confirmationSent).toBe(true)
    expect(result.messageId).toBeDefined()
    expect(result.registration.id).toBeDefined()
    expect(result.registration.status).toBe('registered')

    // Reminder status stored
    expect(result.registration.reminderStatus.confirmationSent).toBe(true)
    expect(result.registration.reminderStatus.confirmationSentAt).toBeDefined()
    expect(result.registration.reminderStatus.confirmationMessageId).toBe(result.messageId)
    expect(result.registration.reminderStatus.reminderSent).toBe(false)
    expect(result.registration.reminderStatus.auditLog.length).toBe(1)
    expect(result.registration.reminderStatus.auditLog[0].action).toBe('confirmation_sent')

    // Brevo sent email verification
    const sentEmails = client.getMockSentEmails()
    expect(sentEmails.length).toBe(1)
    expect(sentEmails[0].to[0].email).toBe('jane@example.com')
    expect(sentEmails[0].subject).toContain('Registration Confirmed: Design Systems Deep Dive')
    expect(sentEmails[0].htmlContent).toContain('Jane Doe')
    expect(sentEmails[0].htmlContent).toContain(result.registration.id)
  })

  // 2. Successful reminder email
  it('sends an upcoming-event reminder email before the event begins', async () => {
    // Register Jane
    const regResult = await service.registerForEvent({
      eventId: testEvent.id,
      attendee: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
      now: baseDate,
    })

    client.clearMockSentEmails()

    // Event is at 2026-11-02T10:00:00Z. Lead time is 24 hours (1440 min).
    // Simulate current time: 2026-11-01T12:00:00Z (22 hours before event, within the 24h lead window)
    const reminderCheckTime = new Date('2026-11-01T12:00:00.000Z')

    const batchResult = await service.sendUpcomingReminders({
      now: reminderCheckTime,
    })

    expect(batchResult.processed).toBe(1)
    expect(batchResult.sent).toBe(1)
    expect(batchResult.failed).toBe(0)
    expect(batchResult.skipped).toBe(0)

    // Verify reminder email was sent
    const sentEmails = client.getMockSentEmails()
    expect(sentEmails.length).toBe(1)
    expect(sentEmails[0].to[0].email).toBe('jane@example.com')
    expect(sentEmails[0].subject).toContain('Reminder: "Design Systems Deep Dive" is coming up soon!')

    // Verify registration status was updated
    const updatedReg = await store.getRegistration(regResult.registration.id)
    expect(updatedReg?.reminderStatus.reminderSent).toBe(true)
    expect(updatedReg?.reminderStatus.reminderSentAt).toBeDefined()
    expect(updatedReg?.reminderStatus.reminderMessageId).toBe(sentEmails[0].messageId)
    expect(
      updatedReg?.reminderStatus.auditLog.some((e) => e.action === 'reminder_sent')
    ).toBe(true)
  })

  // 3. Duplicate-send prevention
  it('prevents duplicate confirmation emails when registering multiple times', async () => {
    // First registration
    const firstReg = await service.registerForEvent({
      eventId: testEvent.id,
      attendee: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
      now: baseDate,
    })

    expect(client.getMockSentEmails().length).toBe(1)

    // Second registration attempt by same email
    const secondReg = await service.registerForEvent({
      eventId: testEvent.id,
      attendee: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
      now: baseDate,
    })

    // Outbox should still only have 1 email
    expect(client.getMockSentEmails().length).toBe(1)
    expect(secondReg.registration.id).toBe(firstReg.registration.id)
    expect(secondReg.error).toContain('already registered')
  })

  it('prevents duplicate reminder emails for the same registration during recurring cron runs', async () => {
    await service.registerForEvent({
      eventId: testEvent.id,
      attendee: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
      now: baseDate,
    })

    client.clearMockSentEmails()
    const checkTime = new Date('2026-11-01T12:00:00.000Z')

    // First reminder cron run
    const firstBatch = await service.sendUpcomingReminders({ now: checkTime })
    expect(firstBatch.sent).toBe(1)
    expect(client.getMockSentEmails().length).toBe(1)

    // Second reminder cron run (e.g. an hour later)
    const secondBatch = await service.sendUpcomingReminders({
      now: new Date('2026-11-01T13:00:00.000Z'),
    })

    // Should NOT send duplicate reminder
    expect(secondBatch.sent).toBe(0)
    expect(client.getMockSentEmails().length).toBe(1) // Still only 1 email sent in total
  })

  // 4. Cancelled registration
  it('skips reminders for cancelled registrations', async () => {
    const regResult = await service.registerForEvent({
      eventId: testEvent.id,
      attendee: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
      now: baseDate,
    })

    // Cancel registration
    await service.cancelRegistration(regResult.registration.id)

    client.clearMockSentEmails()

    // Trigger reminder run
    const batchResult = await service.sendUpcomingReminders({
      now: new Date('2026-11-01T12:00:00.000Z'),
    })

    expect(batchResult.sent).toBe(0)
    expect(client.getMockSentEmails().length).toBe(0)

    const cancelledReg = await store.getRegistration(regResult.registration.id)
    expect(cancelledReg?.status).toBe('cancelled')
    expect(cancelledReg?.reminderStatus.reminderSent).toBe(false)
  })

  // 5. Cancelled or updated event
  it('sends event cancellation email through Brevo when an event is cancelled', async () => {
    await service.registerForEvent({
      eventId: testEvent.id,
      attendee: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
      now: baseDate,
    })

    client.clearMockSentEmails()

    const cancelResult = await service.cancelEvent(
      testEvent.id,
      'Speaker is unavailable due to illness'
    )

    expect(cancelResult.sentCount).toBe(1)
    expect(cancelResult.recipientsCount).toBe(1)

    const sentEmails = client.getMockSentEmails()
    expect(sentEmails.length).toBe(1)
    expect(sentEmails[0].subject).toContain('Cancelled: "Design Systems Deep Dive"')
    expect(sentEmails[0].htmlContent).toContain('Speaker is unavailable due to illness')

    // New registrations for the cancelled event should be rejected
    await expect(
      service.registerForEvent({
        eventId: testEvent.id,
        attendee: { id: 'user-2', name: 'Bob', email: 'bob@example.com' },
        now: baseDate,
      })
    ).rejects.toThrow(EventCancelledError)
  })

  it('sends update email and handles rescheduled time appropriately', async () => {
    const regResult = await service.registerForEvent({
      eventId: testEvent.id,
      attendee: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
      now: baseDate,
    })

    client.clearMockSentEmails()

    const newStartTime = new Date('2026-11-05T15:00:00.000Z').toISOString()
    const updateResult = await service.updateEvent(
      testEvent.id,
      { startTime: newStartTime, location: 'Virtual via Gather Live' },
      { reason: 'Rescheduled to accommodate more attendees' }
    )

    expect(updateResult.sentCount).toBe(1)

    const sentEmails = client.getMockSentEmails()
    expect(sentEmails.length).toBe(1)
    expect(sentEmails[0].subject).toContain('Update: Changes to "Design Systems Deep Dive"')
    expect(sentEmails[0].htmlContent).toContain('Virtual via Gather Live')
    expect(sentEmails[0].htmlContent).toContain('Rescheduled to accommodate more attendees')

    const updatedReg = await store.getRegistration(regResult.registration.id)
    expect(updatedReg?.reminderStatus.lastUpdateSentAt).toBeDefined()
  })

  // 6. Missing attendee email
  it('throws EmailAddressMissingOrInvalidError when attendee email is missing or empty', async () => {
    await expect(
      service.registerForEvent({
        eventId: testEvent.id,
        attendee: { id: 'user-no-email', name: 'No Email', email: '' },
        now: baseDate,
      })
    ).rejects.toThrow(EmailAddressMissingOrInvalidError)

    await expect(
      service.registerForEvent({
        eventId: testEvent.id,
        attendee: { id: 'user-bad-email', name: 'Bad Email', email: 'notvalid' },
        now: baseDate,
      })
    ).rejects.toThrow(EmailAddressMissingOrInvalidError)
  })

  // 7. Invalid event dates and expired events
  it('rejects invalid event dates and registration for expired events', async () => {
    await expect(
      service.createEvent({
        id: 'bad-date-event',
        title: 'Broken Date Event',
        startTime: 'not-a-date',
        status: 'scheduled',
      })
    ).rejects.toThrow(InvalidEventDateError)

    // Expired event
    const expiredEvent = await service.createEvent({
      id: 'expired-event',
      title: 'Yesterday Event',
      startTime: new Date('2026-10-20T10:00:00.000Z').toISOString(),
      status: 'scheduled',
    })

    await expect(
      service.registerForEvent({
        eventId: expiredEvent.id,
        attendee: { id: 'user-late', name: 'Late Attendee', email: 'late@example.com' },
        now: baseDate, // 2026-11-01
      })
    ).rejects.toThrow(EventExpiredError)
  })

  // 8. Brevo API failure and safe state handling
  it('handles Brevo API failures safely without losing the registration record', async () => {
    // Configure mock client to simulate an API failure
    client.setMockFailure(1, 500, 'Brevo service temporarily unavailable')

    const result = await service.registerForEvent({
      eventId: testEvent.id,
      attendee: { id: 'user-err', name: 'Error Attendee', email: 'error@example.com' },
      now: baseDate,
    })

    // Registration should still be saved in store
    expect(result.registration).toBeDefined()
    expect(result.confirmationSent).toBe(false)
    expect(result.error).toContain('Brevo service temporarily unavailable')

    const savedReg = await store.getRegistration(result.registration.id)
    expect(savedReg).not.toBeNull()
    expect(savedReg?.reminderStatus.confirmationSent).toBe(false)
    expect(savedReg?.reminderStatus.lastError).toContain('Brevo service temporarily unavailable')
    expect(savedReg?.reminderStatus.auditLog.some((e) => e.action === 'send_failed')).toBe(true)

    // Next, retry sending confirmation after Brevo service recovers
    const retryResult = await service.sendConfirmationEmail(result.registration.id)
    expect(retryResult.sent).toBe(true)

    const recoveredReg = await store.getRegistration(result.registration.id)
    expect(recoveredReg?.reminderStatus.confirmationSent).toBe(true)
  })

  // 9. Automatic Scheduler
  it('executes runReminderScheduler to process upcoming reminders on schedule', async () => {
    await service.registerForEvent({
      eventId: testEvent.id,
      attendee: { id: 'user-sched', name: 'Scheduler Attendee', email: 'sched@example.com' },
      now: baseDate,
    })

    client.clearMockSentEmails()

    const { runReminderScheduler } = await import('../scheduler')
    let logOutput = ''
    const schedResult = await runReminderScheduler({
      service,
      logger: (msg) => {
        logOutput = msg
      },
    })

    // Check that scheduler called the service and logged structured output
    expect(schedResult).toBeDefined()
    expect(logOutput).toContain('[ReminderScheduler]')
  })

  // 10. Monitoring and Safe Failure Logging
  it('emits sanitized failure metadata without exposing secrets or recipient emails', async () => {
    const { setFailureLogHandler } = await import('../logger')
    type LogEvent = import('../logger').EmailFailureLogEvent

    const failureLogs: LogEvent[] = []
    setFailureLogHandler((logEvent) => {
      failureLogs.push(logEvent)
    })

    // Cause a failure with simulated Brevo error containing a secret
    client.setMockFailure(1, 500, 'Error with key xkeysib-1234567890abcdef')

    await service.registerForEvent({
      eventId: testEvent.id,
      attendee: { id: 'user-fail-log', name: 'Log Test', email: 'fail@example.com' },
      now: baseDate,
    })

    expect(failureLogs.length).toBe(1)
    const log = failureLogs[0]
    expect(log.eventId).toBe(testEvent.id)
    expect(log.emailType).toBe('confirmation')
    expect(log.errorCategory).toBe('CONFIRMATION_SEND_FAILED')
    expect(log.errorMessage).not.toContain('xkeysib-1234567890abcdef')
    expect(log.errorMessage).toContain('[REDACTED_API_KEY]')

    // Reset handler
    setFailureLogHandler(null)
  })
})
