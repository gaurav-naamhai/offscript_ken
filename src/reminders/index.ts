export { BrevoEmailClient, type MockSentEmail } from './brevo-client'
export { loadBrevoConfig, maskApiKey, validateBrevoConfig } from './config'
export {
  BrevoApiError,
  DuplicateSendPreventedError,
  EmailAddressMissingOrInvalidError,
  EventCancelledError,
  EventExpiredError,
  InvalidEventDateError,
  RegistrationCancelledError,
  ReminderError,
  redactSecrets,
} from './errors'
export { EmailReminderService, type ReminderServiceOptions } from './reminder-service'
export {
  logEmailFailure,
  setFailureLogHandler,
  type EmailFailureLogEvent,
  type FailureLogHandler,
} from './logger'
export {
  runReminderScheduler,
  startReminderInterval,
  type SchedulerOptions,
} from './scheduler'
export { InMemoryReminderStore, type IReminderStore } from './store'
export {
  buildConfirmationEmail,
  buildEventCancelledEmail,
  buildEventUpdateEmail,
  buildReminderEmail,
} from './templates'
export type {
  Attendee,
  BatchReminderResult,
  BrevoConfig,
  BrevoRecipient,
  BrevoSender,
  BrevoSendResult,
  Event,
  EventStatus,
  EventUpdateResult,
  Registration,
  RegistrationStatus,
  ReminderAction,
  ReminderAuditEntry,
  ReminderStatus,
  SendEmailOptions,
} from './types'
