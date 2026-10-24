import { redactSecrets } from './errors'

export interface EmailFailureLogEvent {
  eventId: string
  registrationId: string
  emailType: 'confirmation' | 'reminder' | 'update' | 'cancellation'
  timestamp: string
  errorCategory: string
  errorMessage?: string
}

export type FailureLogHandler = (logEvent: EmailFailureLogEvent) => void

let customLogHandler: FailureLogHandler | null = null

export function setFailureLogHandler(handler: FailureLogHandler | null): void {
  customLogHandler = handler
}

/**
 * Production-safe logger for email delivery failures.
 * Never logs API keys, tokens, or unnecessary attendee PII.
 */
export function logEmailFailure(event: EmailFailureLogEvent): void {
  const sanitizedEvent: EmailFailureLogEvent = {
    eventId: event.eventId,
    registrationId: event.registrationId,
    emailType: event.emailType,
    timestamp: event.timestamp || new Date().toISOString(),
    errorCategory: event.errorCategory,
    errorMessage: event.errorMessage ? redactSecrets(event.errorMessage) : undefined,
  }

  if (customLogHandler) {
    try {
      customLogHandler(sanitizedEvent)
    } catch {
      // Prevent custom logger errors from interrupting control flow
    }
    return
  }

  // Structured standard error logging
  const safeJson = JSON.stringify({
    level: 'warn',
    tag: 'EMAIL_REMINDER_FAILURE',
    ...sanitizedEvent,
  })
  // eslint-disable-next-line no-console
  console.warn(safeJson)
}
