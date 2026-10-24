export function redactSecrets(text: string, knownKey?: string): string {
  if (!text) return text
  let sanitized = text
  if (knownKey && knownKey.length > 4) {
    sanitized = sanitized.replaceAll(knownKey, '[REDACTED_API_KEY]')
  }
  // Redact Brevo API key format (xkeysib-...)
  sanitized = sanitized.replace(/xkeysib-[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]')
  // Redact header representations
  sanitized = sanitized.replace(/(?:api-key|Authorization):\s*["']?[^\s,"']+["']?/gi, '$1: [REDACTED]')
  return sanitized
}

export class ReminderError extends Error {
  constructor(message: string) {
    super(redactSecrets(message))
    this.name = 'ReminderError'
  }
}

export class BrevoApiError extends ReminderError {
  readonly statusCode: number
  readonly brevoCode?: string
  readonly isRetryable: boolean

  constructor(statusCode: number, message: string, brevoCode?: string, knownKey?: string) {
    const cleanMsg = redactSecrets(message, knownKey)
    super(`Brevo API Error (${statusCode}${brevoCode ? ` / ${brevoCode}` : ''}): ${cleanMsg}`)
    this.name = 'BrevoApiError'
    this.statusCode = statusCode
    this.brevoCode = brevoCode
    // 429 (rate limit), 500, 502, 503, 504 or network 0 are retryable
    this.isRetryable = statusCode === 429 || statusCode >= 500 || statusCode === 0
  }
}

export class EmailAddressMissingOrInvalidError extends ReminderError {
  constructor(email?: string) {
    super(email ? `Invalid attendee email address format: "${email}"` : 'Attendee email address is missing or empty')
    this.name = 'EmailAddressMissingOrInvalidError'
  }
}

export class InvalidEventDateError extends ReminderError {
  constructor(dateInput: unknown) {
    super(`Invalid event date: "${String(dateInput)}". Must be a valid ISO 8601 date string.`)
    this.name = 'InvalidEventDateError'
  }
}

export class EventExpiredError extends ReminderError {
  constructor(eventId: string, startTime: string) {
    super(`Event "${eventId}" has already passed (start time: ${startTime}). Cannot process reminders for expired events.`)
    this.name = 'EventExpiredError'
  }
}

export class EventCancelledError extends ReminderError {
  constructor(eventId: string) {
    super(`Event "${eventId}" has been cancelled. Cannot accept new registrations.`)
    this.name = 'EventCancelledError'
  }
}

export class RegistrationCancelledError extends ReminderError {
  constructor(registrationId: string) {
    super(`Registration "${registrationId}" is cancelled. Cannot send reminders.`)
    this.name = 'RegistrationCancelledError'
  }
}

export class DuplicateSendPreventedError extends ReminderError {
  constructor(registrationId: string, emailType: 'confirmation' | 'reminder') {
    super(`Duplicate ${emailType} email prevented for registration "${registrationId}".`)
    this.name = 'DuplicateSendPreventedError'
  }
}
