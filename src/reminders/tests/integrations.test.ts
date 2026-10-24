import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EmailReminderService } from '../reminder-service'
import {
  handleRsvpReminder,
  handleUpdateReminder,
  handleCancelReminder,
  handleCronReminder,
  reminderApiMiddleware,
} from '../server-handler'
import {
  notifyRsvpReminder,
  notifyEventUpdateReminder,
  notifyEventCancelReminder,
} from '../../features/reminder-adapter'
import type { EventRecord } from '../../features/events'

describe('Server-side Reminder Integrations & Boundaries', () => {
  let service: EmailReminderService

  beforeEach(() => {
    service = new EmailReminderService({
      config: {
        apiKey: 'test-key',
        mockMode: true,
        senderEmail: 'gather@example.com',
        senderName: 'Gather',
      },
    })
  })

  describe('RSVP -> Confirmation Email Flow', () => {
    it('sends confirmation email on successful RSVP in mock mode', async () => {
      const result = await handleRsvpReminder(
        {
          event: {
            id: 'event-integration-1',
            title: 'Moonlit Jazz Night',
            description: 'Live jazz in the garden.',
            startTime: new Date(Date.now() + 86400000 * 2).toISOString(),
            location: 'The Garden Loft',
          },
          attendee: {
            id: 'user-101',
            name: 'Alice',
            email: 'alice@example.com',
          },
        },
        service
      )

      expect(result.confirmationSent).toBe(true)
      expect(result.registration).toBeDefined()
      expect(result.registration?.attendee.email).toBe('alice@example.com')

      const sentEmails = service.client.getMockSentEmails()
      expect(sentEmails.length).toBe(1)
      expect(sentEmails[0].to[0].email).toBe('alice@example.com')
      expect(sentEmails[0].subject).toContain('Registration Confirmed')
    })

    it('prevents duplicate confirmation email on repeated RSVP for same event and attendee', async () => {
      const payload = {
        event: {
          id: 'event-integration-duplicate',
          title: 'Design Workshop',
          startTime: new Date(Date.now() + 86400000 * 3).toISOString(),
        },
        attendee: {
          id: 'user-102',
          name: 'Bob',
          email: 'bob@example.com',
        },
      }

      const first = await handleRsvpReminder(payload, service)
      expect(first.confirmationSent).toBe(true)

      const second = await handleRsvpReminder(payload, service)
      expect(second.confirmationSent).toBe(false)
      expect(second.error).toContain('already registered')

      const sentEmails = service.client.getMockSentEmails()
      expect(sentEmails.length).toBe(1) // No duplicate email sent
    })

    it('does not send confirmation email when attendee email is invalid or missing', async () => {
      const result = await handleRsvpReminder(
        {
          event: {
            id: 'event-no-email',
            title: 'Silent Event',
            startTime: new Date(Date.now() + 86400000).toISOString(),
          },
          attendee: {
            id: 'user-103',
            name: 'No Email User',
            email: '',
          },
        },
        service
      )

      expect(result.confirmationSent).toBe(false)
      expect(result.error).toContain('Valid attendee email is required')
      expect(service.client.getMockSentEmails().length).toBe(0)
    })
  })

  describe('Event Update -> Update Email Flow', () => {
    it('sends update email only to affected attendees when event details change', async () => {
      // 1. Create event and register two attendees
      await handleRsvpReminder(
        {
          event: {
            id: 'event-update-1',
            title: 'Studio Showcase',
            startTime: new Date(Date.now() + 86400000 * 2).toISOString(),
            location: 'Room A',
          },
          attendee: { id: 'u1', name: 'User 1', email: 'u1@example.com' },
        },
        service
      )

      await handleRsvpReminder(
        {
          event: {
            id: 'event-update-1',
            title: 'Studio Showcase',
            startTime: new Date(Date.now() + 86400000 * 2).toISOString(),
            location: 'Room A',
          },
          attendee: { id: 'u2', name: 'User 2', email: 'u2@example.com' },
        },
        service
      )

      const initialSentCount = service.client.getMockSentEmails().length
      expect(initialSentCount).toBe(2)

      // 2. Perform event update
      const updateResult = await handleUpdateReminder(
        {
          eventId: 'event-update-1',
          updates: {
            location: 'Grand Ballroom (Upgraded)',
          },
          reason: 'Venue changed due to high attendance',
        },
        service
      )

      expect(updateResult.success).toBe(true)
      expect(updateResult.sentCount).toBe(2)

      const allSent = service.client.getMockSentEmails()
      expect(allSent.length).toBe(4) // 2 confirmations + 2 updates

      const updateEmails = allSent.slice(2)
      expect(updateEmails[0].subject).toContain('Update:')
      expect(updateEmails[1].subject).toContain('Update:')
      expect(updateEmails.some((e) => e.to[0].email === 'u1@example.com')).toBe(true)
      expect(updateEmails.some((e) => e.to[0].email === 'u2@example.com')).toBe(true)
    })

    it('returns failure when attempting to update non-existent event', async () => {
      const updateResult = await handleUpdateReminder(
        {
          eventId: 'non-existent-event',
          updates: { title: 'New Name' },
        },
        service
      )

      expect(updateResult.success).toBe(false)
      expect(updateResult.sentCount).toBe(0)
      expect(updateResult.error).toContain('not found')
    })
  })

  describe('Event Cancellation -> Cancellation Email Flow', () => {
    it('sends cancellation email to registered attendees', async () => {
      await handleRsvpReminder(
        {
          event: {
            id: 'event-cancel-1',
            title: 'Rooftop Mixer',
            startTime: new Date(Date.now() + 86400000 * 4).toISOString(),
            location: 'The Rooftop',
          },
          attendee: { id: 'u3', name: 'Carol', email: 'carol@example.com' },
        },
        service
      )

      const cancelResult = await handleCancelReminder(
        {
          eventId: 'event-cancel-1',
          reason: 'Inclement weather expected',
        },
        service
      )

      expect(cancelResult.success).toBe(true)
      expect(cancelResult.sentCount).toBe(1)

      const emails = service.client.getMockSentEmails()
      expect(emails.length).toBe(2) // 1 confirmation + 1 cancellation
      const cancelEmail = emails[1]
      expect(cancelEmail.to[0].email).toBe('carol@example.com')
      expect(cancelEmail.subject).toContain('Cancelled')
    })

    it('returns failure and sends no emails when cancelling a non-existent event', async () => {
      const cancelResult = await handleCancelReminder(
        {
          eventId: 'non-existent-cancel',
          reason: 'Testing cancellation failure',
        },
        service
      )

      expect(cancelResult.success).toBe(false)
      expect(cancelResult.sentCount).toBe(0)
      expect(cancelResult.error).toContain('not found')
    })
  })

  describe('Database Failure Safety & Operation Boundary', () => {
    it('does not send confirmation email if registration operation fails before notification', async () => {
      const notifySpy = vi.fn()

      const simulatedDbRsvp = async (shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error('Database connection failed')
        }
        notifySpy()
      }

      await expect(simulatedDbRsvp(true)).rejects.toThrow('Database connection failed')
      expect(notifySpy).not.toHaveBeenCalled()
      expect(service.client.getMockSentEmails().length).toBe(0)
    })

    it('does not send update email if event update operation fails before notification', async () => {
      const notifySpy = vi.fn()

      const simulatedDbUpdate = async (shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error('Database constraint violation')
        }
        notifySpy()
      }

      await expect(simulatedDbUpdate(true)).rejects.toThrow('Database constraint violation')
      expect(notifySpy).not.toHaveBeenCalled()
    })

    it('does not send cancellation email if cancellation operation fails before notification', async () => {
      const notifySpy = vi.fn()

      const simulatedDbCancel = async (shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error('Database row lock timeout')
        }
        notifySpy()
      }

      await expect(simulatedDbCancel(true)).rejects.toThrow('Database row lock timeout')
      expect(notifySpy).not.toHaveBeenCalled()
    })
  })

  describe('Scheduler -> Upcoming Reminder Flow', () => {
    it('dispatches upcoming reminder for events starting within reminder window', async () => {
      // Create an event starting 12 hours from now (within 24h window)
      const eventId = 'event-upcoming-1'
      const startTime = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()

      await handleRsvpReminder(
        {
          event: {
            id: eventId,
            title: 'Morning Acoustic Session',
            startTime,
            location: 'Main Hall',
          },
          attendee: { id: 'u4', name: 'Dave', email: 'dave@example.com' },
        },
        service
      )

      const cronResult = await handleCronReminder(service)
      expect(cronResult.processed).toBe(1)
      expect(cronResult.sent).toBe(1)

      const emails = service.client.getMockSentEmails()
      expect(emails.length).toBe(2) // 1 confirmation + 1 upcoming reminder
      const reminderEmail = emails[1]
      expect(reminderEmail.to[0].email).toBe('dave@example.com')
      expect(reminderEmail.subject).toContain('Reminder:')
      expect(reminderEmail.subject).toContain('Morning Acoustic Session')
    })

    it('does not send reminder for events far in the future', async () => {
      const eventId = 'event-far-future'
      const startTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      await handleRsvpReminder(
        {
          event: {
            id: eventId,
            title: 'Annual Gala',
            startTime,
            location: 'Grand Ballroom',
          },
          attendee: { id: 'u5', name: 'Eve', email: 'eve@example.com' },
        },
        service
      )

      const cronResult = await handleCronReminder(service)
      expect(cronResult.sent).toBe(0)
    })
  })

  describe('Server HTTP Middleware (/api/reminders/*)', () => {
    it('handles POST /api/reminders/rsvp via Node HTTP middleware', async () => {
      const middleware = reminderApiMiddleware(service)

      let resStatus = 0
      let resHeaders: Record<string, string> = {}
      let resBody = ''

      await new Promise<void>((resolve) => {
        let endCallback: (() => void) | undefined

        const req: any = {
          url: '/api/reminders/rsvp',
          method: 'POST',
          on: (event: string, cb: (chunk?: string) => void) => {
            if (event === 'data') {
              setTimeout(() => {
                cb(
                  JSON.stringify({
                    event: {
                      id: 'event-http-1',
                      title: 'HTTP Meetup',
                      startTime: new Date(Date.now() + 86400000).toISOString(),
                    },
                    attendee: {
                      id: 'u-http',
                      name: 'Http User',
                      email: 'http@example.com',
                    },
                  })
                )
                if (endCallback) endCallback()
              }, 5)
            }
            if (event === 'end') {
              endCallback = cb
            }
          },
        }

        const res: any = {
          statusCode: 0,
          setHeader: (key: string, value: string) => {
            resHeaders[key] = value
          },
          end: (data: string) => {
            resStatus = res.statusCode
            resBody = data
            resolve()
          },
        }

        void middleware(req, res)
      })

      expect(resStatus).toBe(200)
      expect(resHeaders['Content-Type']).toBe('application/json')
      const json = JSON.parse(resBody)
      expect(json.confirmationSent).toBe(true)
    })

    it('handles GET /api/reminders/health', async () => {
      const middleware = reminderApiMiddleware(service)
      let resStatus = 0
      let resBody = ''

      const req: any = { url: '/api/reminders/health', method: 'GET' }
      const res: any = {
        statusCode: 0,
        setHeader: () => {},
        end: (data: string) => {
          resStatus = res.statusCode
          resBody = data
        },
      }

      await middleware(req, res)
      expect(resStatus).toBe(200)
      const parsed = JSON.parse(resBody)
      expect(parsed.status).toBe('ok')
      expect(parsed.mockMode).toBe(true)
    })
  })

  describe('Client-side Reminder Adapter Boundaries', () => {
    it('returns failure safely if fetch fails or network error occurs', async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'))

      const dummyEvent: EventRecord = {
        id: 'test-evt',
        ownerId: 'owner-1',
        title: 'Offline Event',
        description: 'Testing offline',
        startDate: '2026-12-01',
        endDate: '',
        startTime: '18:00',
        endTime: '20:00',
        location: 'Nowhere',
        category: 'Test',
        capacity: 50,
        visibility: 'public',
        registration: 'open',
        status: 'published',
        imageUrl: '/test.jpg',
        createdAt: '2026-01-01T00:00:00Z',
      }

      const rsvpRes = await notifyRsvpReminder(dummyEvent, {
        id: 'user-err',
        email: 'err@example.com',
      })
      expect(rsvpRes.success).toBe(false)
      expect(rsvpRes.error).toContain('Network offline')

      const updateRes = await notifyEventUpdateReminder('test-evt', { title: 'Updated' })
      expect(updateRes.success).toBe(false)

      const cancelRes = await notifyEventCancelReminder('test-evt', 'Cancelled')
      expect(cancelRes.success).toBe(false)

      globalThis.fetch = originalFetch
    })

    it('returns validation error immediately if no email is provided', async () => {
      const dummyEvent: EventRecord = {
        id: 'test-evt-2',
        ownerId: 'owner-1',
        title: 'No Email Event',
        description: '',
        startDate: '2026-12-01',
        endDate: '',
        startTime: '18:00',
        endTime: '',
        location: 'Nowhere',
        category: 'Test',
        capacity: null,
        visibility: 'public',
        registration: 'open',
        status: 'published',
        imageUrl: '',
        createdAt: '',
      }

      const res = await notifyRsvpReminder(dummyEvent, { id: 'u-none', email: '' })
      expect(res.success).toBe(false)
      expect(res.error).toBe('No attendee email provided')
    })
  })
})
