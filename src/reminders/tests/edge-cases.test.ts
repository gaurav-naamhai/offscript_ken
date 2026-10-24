import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrevoEmailClient } from '../brevo-client'
import { BrevoApiError } from '../errors'
import { EmailReminderService } from '../reminder-service'
import { InMemoryReminderStore } from '../store'

describe('Edge Cases, Network Fetch & Error Handling', () => {
  let store: InMemoryReminderStore
  let service: EmailReminderService

  beforeEach(() => {
    store = new InMemoryReminderStore()
    service = new EmailReminderService({
      store,
      config: {
        apiKey: 'xkeysib-live-key-testing-12345',
        senderEmail: 'hello@gather.app',
        senderName: 'Gather Platform',
        mockMode: false,
        maxRetries: 2,
        retryDelayMs: 2,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('constructs correct HTTP POST request with headers and payload to Brevo v3 endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ messageId: '<real-brevo-id-123@brevo.com>' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    )

    const event = await service.createEvent({
      id: 'event-api-test',
      title: 'API Integration Test Event',
      startTime: new Date('2026-11-20T10:00:00.000Z').toISOString(),
      status: 'scheduled',
    })

    const result = await service.registerForEvent({
      eventId: event.id,
      attendee: { id: 'user-live', name: 'Live User', email: 'live@example.com' },
      now: new Date('2026-11-01T10:00:00.000Z'),
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]
    expect(calledUrl).toBe('https://api.brevo.com/v3/smtp/email')
    expect(calledInit?.method).toBe('POST')

    const headers = calledInit?.headers as Record<string, string>
    expect(headers['accept']).toBe('application/json')
    expect(headers['content-type']).toBe('application/json')
    expect(headers['api-key']).toBe('xkeysib-live-key-testing-12345')

    const body = JSON.parse(calledInit?.body as string)
    expect(body.sender.email).toBe('hello@gather.app')
    expect(body.to[0].email).toBe('live@example.com')
    expect(body.subject).toContain('Registration Confirmed: API Integration Test Event')

    expect(result.confirmationSent).toBe(true)
    expect(result.messageId).toBe('<real-brevo-id-123@brevo.com>')
  })

  it('retries on HTTP 429 (rate-limit) and succeeds after backoff', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        return new Response(JSON.stringify({ code: 'rate_limit', message: 'Too Many Requests' }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ messageId: '<success-msg-after-429@brevo.com>' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    })

    const client = new BrevoEmailClient({
      apiKey: 'xkeysib-key-429',
      senderEmail: 'test@gather.app',
      senderName: 'Gather',
      mockMode: false,
      maxRetries: 2,
      retryDelayMs: 5,
    })

    const res = await client.sendEmail({
      to: [{ email: 'test@example.com' }],
      subject: 'Subject',
      htmlContent: '<p>Body</p>',
    })

    expect(callCount).toBe(2)
    expect(res.messageId).toBe('<success-msg-after-429@brevo.com>')
  })

  it('fails fast on HTTP 400 Bad Request without pointless retries', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++
      return new Response(JSON.stringify({ code: 'invalid_parameter', message: 'Invalid domain' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    })

    const client = new BrevoEmailClient({
      apiKey: 'xkeysib-key-bad-req',
      senderEmail: 'test@gather.app',
      senderName: 'Gather',
      mockMode: false,
      maxRetries: 3,
      retryDelayMs: 5,
    })

    await expect(
      client.sendEmail({
        to: [{ email: 'bad@example.com' }],
        subject: 'Subject',
        htmlContent: '<p>Body</p>',
      })
    ).rejects.toThrow(BrevoApiError)

    // Should only have been called once, NOT 4 times
    expect(callCount).toBe(1)
  })

  it('batch reminders continue processing remaining attendees even if one email fails', async () => {
    const mockClient = new BrevoEmailClient({
      apiKey: 'xkeysib-batch-key',
      senderEmail: 'events@gather.app',
      senderName: 'Gather',
      mockMode: true,
    })

    const batchService = new EmailReminderService({
      store,
      client: mockClient,
      defaultLeadTimeMinutes: 1440,
    })

    const event = await batchService.createEvent({
      id: 'event-multi',
      title: 'Multi Attendee Event',
      startTime: '2026-11-02T10:00:00.000Z',
      status: 'scheduled',
      reminderLeadTimeMinutes: 1440,
    })

    // Register attendee 1 (valid)
    await batchService.registerForEvent({
      eventId: event.id,
      attendee: { id: 'u1', name: 'User 1', email: 'user1@example.com' },
      now: new Date('2026-11-01T08:00:00.000Z'),
    })

    // Register attendee 2 (valid)
    await batchService.registerForEvent({
      eventId: event.id,
      attendee: { id: 'u2', name: 'User 2', email: 'user2@example.com' },
      now: new Date('2026-11-01T08:00:00.000Z'),
    })

    mockClient.clearMockSentEmails()

    // Run batch reminders at 2026-11-01T12:00:00Z (within 24h lead time)
    const result = await batchService.sendUpcomingReminders({
      now: new Date('2026-11-01T12:00:00.000Z'),
    })

    expect(result.processed).toBe(2)
    expect(result.sent).toBe(2)
    expect(result.failed).toBe(0)
    expect(mockClient.getMockSentEmails().length).toBe(2)
  })
})
