import { BrevoApiError, EmailAddressMissingOrInvalidError, redactSecrets } from './errors'
import type { BrevoConfig, BrevoSendResult, SendEmailOptions } from './types'

export interface MockSentEmail {
  to: { email: string; name?: string }[]
  sender: { email: string; name: string }
  subject: string
  htmlContent: string
  textContent?: string
  tags?: string[]
  sentAt: string
  messageId: string
}

export class BrevoEmailClient {
  private readonly config: BrevoConfig
  private readonly mockOutbox: MockSentEmail[] = []
  private mockFailuresRemaining = 0
  private mockFailureStatus = 500
  private mockFailureMessage = 'Mock server error'

  constructor(config: BrevoConfig) {
    this.config = config
  }

  isMockMode(): boolean {
    return this.config.mockMode
  }

  getMockSentEmails(): ReadonlyArray<MockSentEmail> {
    return [...this.mockOutbox]
  }

  clearMockSentEmails(): void {
    this.mockOutbox.length = 0
  }

  /**
   * For testing retries: simulate N failures before succeeding (or permanent failure).
   */
  setMockFailure(times: number, status = 500, message = 'Mock server error'): void {
    this.mockFailuresRemaining = times
    this.mockFailureStatus = status
    this.mockFailureMessage = message
  }

  async sendEmail(options: SendEmailOptions): Promise<BrevoSendResult> {
    this.validateRecipient(options)

    if (this.config.mockMode) {
      return this.handleMockSend(options)
    }

    return this.sendWithRetry(options)
  }

  private validateRecipient(options: SendEmailOptions): void {
    if (!options.to || options.to.length === 0) {
      throw new EmailAddressMissingOrInvalidError()
    }

    for (const recipient of options.to) {
      const email = recipient.email?.trim()
      if (!email || !email.includes('@') || email.length < 5) {
        throw new EmailAddressMissingOrInvalidError(recipient.email)
      }
    }
  }

  private async handleMockSend(options: SendEmailOptions): Promise<BrevoSendResult> {
    if (this.mockFailuresRemaining > 0) {
      this.mockFailuresRemaining--
      throw new BrevoApiError(
        this.mockFailureStatus,
        this.mockFailureMessage,
        'MOCK_SIMULATED_FAILURE',
        this.config.apiKey
      )
    }

    const messageId = `<mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@gather.mock>`
    const sender = options.sender || {
      email: this.config.senderEmail,
      name: this.config.senderName,
    }

    const mockEmail: MockSentEmail = {
      to: options.to,
      sender,
      subject: options.subject,
      htmlContent: options.htmlContent,
      textContent: options.textContent,
      tags: options.tags,
      sentAt: new Date().toISOString(),
      messageId,
    }

    this.mockOutbox.push(mockEmail)

    return {
      messageId,
      isMock: true,
    }
  }

  private async sendWithRetry(options: SendEmailOptions): Promise<BrevoSendResult> {
    const maxRetries = this.config.maxRetries ?? 3
    const baseDelay = this.config.retryDelayMs ?? 100
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeBrevoRequest(options)
      } catch (err) {
        lastError = err

        if (err instanceof BrevoApiError && !err.isRetryable) {
          // Non-retryable error (e.g. 400 Bad Request, 401 Unauthorized), fail immediately
          throw err
        }

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    if (lastError instanceof BrevoApiError) {
      throw lastError
    }
    throw new BrevoApiError(
      0,
      lastError instanceof Error ? lastError.message : 'Unknown network failure sending transactional email',
      'NETWORK_FAILURE',
      this.config.apiKey
    )
  }

  private async executeBrevoRequest(options: SendEmailOptions): Promise<BrevoSendResult> {
    if (!this.config.apiKey || this.config.apiKey.trim() === '' || this.config.apiKey === 'mock-brevo-key') {
      throw new BrevoApiError(401, 'BREVO_API_KEY environment variable is required when not in mock mode.', 'MISSING_API_KEY', '')
    }

    const url = this.config.apiUrl || 'https://api.brevo.com/v3/smtp/email'
    const sender = options.sender || {
      name: this.config.senderName,
      email: this.config.senderEmail,
    }

    const bodyPayload = {
      sender,
      to: options.to.map((r) => ({
        email: r.email,
        name: r.name || undefined,
      })),
      subject: options.subject,
      htmlContent: options.htmlContent,
      textContent: options.textContent || undefined,
      tags: options.tags || undefined,
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': this.config.apiKey,
        },
        body: JSON.stringify(bodyPayload),
      })
    } catch (netErr) {
      const msg = netErr instanceof Error ? netErr.message : 'Network request failed'
      throw new BrevoApiError(0, redactSecrets(msg, this.config.apiKey), 'CONNECTION_ERROR', this.config.apiKey)
    }

    if (response.status === 201 || response.status === 200) {
      const data = (await response.json()) as { messageId?: string }
      return {
        messageId: data.messageId || `<generated-${Date.now()}@brevo.com>`,
        isMock: false,
      }
    }

    let errorData: { code?: string; message?: string } = {}
    try {
      errorData = (await response.json()) as { code?: string; message?: string }
    } catch {
      // response body was not JSON
    }

    const rawMessage = errorData.message || response.statusText || 'Brevo API request failed'
    throw new BrevoApiError(
      response.status,
      redactSecrets(rawMessage, this.config.apiKey),
      errorData.code,
      this.config.apiKey
    )
  }
}
