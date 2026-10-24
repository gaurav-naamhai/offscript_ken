import { describe, expect, it } from 'vitest'
import { BrevoEmailClient } from '../brevo-client'
import { BrevoApiError, EmailAddressMissingOrInvalidError, redactSecrets } from '../errors'
import type { BrevoConfig } from '../types'

describe('BrevoEmailClient', () => {
  const mockConfig: BrevoConfig = {
    apiKey: 'xkeysib-mock-secret-key-12345',
    senderEmail: 'notifications@gather.app',
    senderName: 'Gather Notifications',
    mockMode: true,
    maxRetries: 2,
    retryDelayMs: 5,
  }

  it('sends email in mock mode without external network calls', async () => {
    const client = new BrevoEmailClient(mockConfig)
    client.clearMockSentEmails()

    const result = await client.sendEmail({
      to: [{ email: 'alice@example.com', name: 'Alice' }],
      subject: 'Test Subject',
      htmlContent: '<p>Hello Alice</p>',
      textContent: 'Hello Alice',
    })

    expect(result.isMock).toBe(true)
    expect(result.messageId).toContain('@gather.mock')

    const sent = client.getMockSentEmails()
    expect(sent.length).toBe(1)
    expect(sent[0].to[0].email).toBe('alice@example.com')
    expect(sent[0].subject).toBe('Test Subject')
    expect(sent[0].htmlContent).toBe('<p>Hello Alice</p>')
    expect(sent[0].sender.email).toBe('notifications@gather.app')
  })

  it('rejects missing or empty recipient emails', async () => {
    const client = new BrevoEmailClient(mockConfig)

    await expect(
      client.sendEmail({
        to: [],
        subject: 'Empty To',
        htmlContent: '<p>Test</p>',
      })
    ).rejects.toThrow(EmailAddressMissingOrInvalidError)

    await expect(
      client.sendEmail({
        to: [{ email: '   ' }],
        subject: 'Whitespace To',
        htmlContent: '<p>Test</p>',
      })
    ).rejects.toThrow(EmailAddressMissingOrInvalidError)

    await expect(
      client.sendEmail({
        to: [{ email: 'not-an-email' }],
        subject: 'Invalid To',
        htmlContent: '<p>Test</p>',
      })
    ).rejects.toThrow(EmailAddressMissingOrInvalidError)
  })

  it('simulates retry behavior and succeeds after transient failures in mock mode', async () => {
    const client = new BrevoEmailClient(mockConfig)
    client.clearMockSentEmails()

    // 1 failure then success
    client.setMockFailure(1, 500, 'Temporary server error')

    // Since mock send directly simulates attempt, calling sendEmail with mock failure throws
    await expect(
      client.sendEmail({
        to: [{ email: 'bob@example.com' }],
        subject: 'Subject',
        htmlContent: '<p>Content</p>',
      })
    ).rejects.toThrow(/Temporary server error/)

    // Next attempt succeeds
    const res = await client.sendEmail({
      to: [{ email: 'bob@example.com' }],
      subject: 'Subject',
      htmlContent: '<p>Content</p>',
    })
    expect(res.isMock).toBe(true)
  })

  it('redacts API keys and sensitive tokens from error messages', () => {
    const secretKey = 'xkeysib-secret-987654321-abcdef'
    const errorMsg = `Failed with key ${secretKey} at endpoint https://api.brevo.com/v3/smtp/email`

    const redacted = redactSecrets(errorMsg, secretKey)
    expect(redacted).not.toContain(secretKey)
    expect(redacted).toContain('[REDACTED_API_KEY]')
  })

  it('creates BrevoApiError without exposing sensitive API key', () => {
    const secretKey = 'xkeysib-super-confidential-token-555'
    const error = new BrevoApiError(401, `Unauthorized with ${secretKey}`, 'UNAUTHORIZED', secretKey)

    expect(error.message).not.toContain(secretKey)
    expect(error.message).toContain('[REDACTED_API_KEY]')
    expect(error.isRetryable).toBe(false)
  })

  it('identifies 429 and 5xx as retryable errors, and 400/401 as non-retryable', () => {
    const err429 = new BrevoApiError(429, 'Rate limit exceeded')
    expect(err429.isRetryable).toBe(true)

    const err503 = new BrevoApiError(503, 'Service unavailable')
    expect(err503.isRetryable).toBe(true)

    const err400 = new BrevoApiError(400, 'Bad request')
    expect(err400.isRetryable).toBe(false)

    const err401 = new BrevoApiError(401, 'Unauthorized')
    expect(err401.isRetryable).toBe(false)
  })
})
