export type EventStatus = 'scheduled' | 'cancelled' | 'completed'

export interface Event {
  id: string
  title: string
  description?: string
  startTime: string // ISO 8601 string
  endTime?: string // ISO 8601 string
  location?: string
  organizerName?: string
  organizerEmail?: string
  status: EventStatus
  reminderLeadTimeMinutes?: number // Default: 1440 minutes (24 hours)
  createdAt: string
  updatedAt: string
}

export interface Attendee {
  id: string
  name: string
  email: string
  phone?: string
}

export type RegistrationStatus = 'registered' | 'cancelled'

export type ReminderAction =
  | 'confirmation_sent'
  | 'reminder_sent'
  | 'update_sent'
  | 'cancellation_sent'
  | 'send_failed'
  | 'cancelled'

export interface ReminderAuditEntry {
  action: ReminderAction
  timestamp: string
  messageId?: string
  error?: string
  attemptCount?: number
}

export interface ReminderStatus {
  confirmationSent: boolean
  confirmationSentAt?: string
  confirmationMessageId?: string
  reminderSent: boolean
  reminderSentAt?: string
  reminderMessageId?: string
  cancellationSent: boolean
  cancellationSentAt?: string
  cancellationMessageId?: string
  lastUpdateSentAt?: string
  lastUpdateMessageId?: string
  lastError?: string
  auditLog: ReminderAuditEntry[]
}

export interface Registration {
  id: string
  eventId: string
  attendee: Attendee
  status: RegistrationStatus
  registeredAt: string
  cancelledAt?: string
  reminderStatus: ReminderStatus
}

export interface BrevoRecipient {
  email: string
  name?: string
}

export interface BrevoSender {
  email: string
  name: string
}

export interface SendEmailOptions {
  to: BrevoRecipient[]
  subject: string
  htmlContent: string
  textContent?: string
  sender?: BrevoSender
  tags?: string[]
}

export interface BrevoSendResult {
  messageId: string
  isMock?: boolean
}

export interface BrevoConfig {
  apiKey: string
  senderEmail: string
  senderName: string
  mockMode: boolean
  maxRetries?: number
  retryDelayMs?: number
  apiUrl?: string
}

export interface BatchReminderResult {
  processed: number
  sent: number
  skipped: number
  failed: number
  details: Array<{
    registrationId: string
    eventId: string
    status: 'sent' | 'skipped' | 'failed'
    reason?: string
    messageId?: string
  }>
}

export interface EventUpdateResult {
  eventId: string
  updatedFields: string[]
  recipientsCount: number
  sentCount: number
  failedCount: number
  messageIds: string[]
  errors: Array<{ registrationId: string; error: string }>
}
