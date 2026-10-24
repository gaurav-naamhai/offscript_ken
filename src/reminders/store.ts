import type { Event, Registration, RegistrationStatus, ReminderAuditEntry, ReminderStatus } from './types'

export interface IReminderStore {
  saveEvent(event: Event): Promise<Event>
  getEvent(eventId: string): Promise<Event | null>
  updateEvent(eventId: string, updates: Partial<Event>): Promise<Event>
  saveRegistration(registration: Registration): Promise<Registration>
  getRegistration(registrationId: string): Promise<Registration | null>
  findRegistrationByEventAndEmail(eventId: string, email: string): Promise<Registration | null>
  getRegistrationsByEvent(eventId: string): Promise<Registration[]>
  updateRegistrationStatus(registrationId: string, status: RegistrationStatus): Promise<Registration>
  updateReminderStatus(
    registrationId: string,
    updates: Partial<ReminderStatus>,
    auditEntry?: ReminderAuditEntry
  ): Promise<Registration>
  findDueReminders(
    currentTime?: Date,
    defaultLeadMinutes?: number
  ): Promise<Array<{ registration: Registration; event: Event }>>
  clear(): Promise<void>
}

export class InMemoryReminderStore implements IReminderStore {
  private readonly events = new Map<string, Event>()
  private readonly registrations = new Map<string, Registration>()

  async saveEvent(event: Event): Promise<Event> {
    const copy = { ...event }
    this.events.set(copy.id, copy)
    return copy
  }

  async getEvent(eventId: string): Promise<Event | null> {
    const event = this.events.get(eventId)
    return event ? { ...event } : null
  }

  async updateEvent(eventId: string, updates: Partial<Event>): Promise<Event> {
    const existing = this.events.get(eventId)
    if (!existing) {
      throw new Error(`Event with id "${eventId}" not found`)
    }
    const updated: Event = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    this.events.set(eventId, updated)
    return { ...updated }
  }

  async saveRegistration(registration: Registration): Promise<Registration> {
    const copy = JSON.parse(JSON.stringify(registration)) as Registration
    this.registrations.set(copy.id, copy)
    return copy
  }

  async getRegistration(registrationId: string): Promise<Registration | null> {
    const reg = this.registrations.get(registrationId)
    return reg ? (JSON.parse(JSON.stringify(reg)) as Registration) : null
  }

  async findRegistrationByEventAndEmail(eventId: string, email: string): Promise<Registration | null> {
    const normalized = email.trim().toLowerCase()
    for (const reg of this.registrations.values()) {
      if (reg.eventId === eventId && reg.attendee.email.trim().toLowerCase() === normalized) {
        return JSON.parse(JSON.stringify(reg)) as Registration
      }
    }
    return null
  }

  async getRegistrationsByEvent(eventId: string): Promise<Registration[]> {
    const result: Registration[] = []
    for (const reg of this.registrations.values()) {
      if (reg.eventId === eventId) {
        result.push(JSON.parse(JSON.stringify(reg)) as Registration)
      }
    }
    return result
  }

  async updateRegistrationStatus(registrationId: string, status: RegistrationStatus): Promise<Registration> {
    const reg = this.registrations.get(registrationId)
    if (!reg) {
      throw new Error(`Registration with id "${registrationId}" not found`)
    }
    reg.status = status
    if (status === 'cancelled') {
      reg.cancelledAt = new Date().toISOString()
      reg.reminderStatus.auditLog.push({
        action: 'cancelled',
        timestamp: reg.cancelledAt,
      })
    }
    this.registrations.set(registrationId, reg)
    return JSON.parse(JSON.stringify(reg)) as Registration
  }

  async updateReminderStatus(
    registrationId: string,
    updates: Partial<ReminderStatus>,
    auditEntry?: ReminderAuditEntry
  ): Promise<Registration> {
    const reg = this.registrations.get(registrationId)
    if (!reg) {
      throw new Error(`Registration with id "${registrationId}" not found`)
    }

    const currentStatus = reg.reminderStatus
    const updatedStatus: ReminderStatus = {
      ...currentStatus,
      ...updates,
      auditLog: [...currentStatus.auditLog],
    }

    if (auditEntry) {
      updatedStatus.auditLog.push(auditEntry)
    }

    reg.reminderStatus = updatedStatus
    this.registrations.set(registrationId, reg)
    return JSON.parse(JSON.stringify(reg)) as Registration
  }

  async findDueReminders(
    currentTime = new Date(),
    defaultLeadMinutes = 1440
  ): Promise<Array<{ registration: Registration; event: Event }>> {
    const nowMs = currentTime.getTime()
    const results: Array<{ registration: Registration; event: Event }> = []

    for (const reg of this.registrations.values()) {
      // 1. Skip cancelled registrations
      if (reg.status !== 'registered') continue

      // 2. Skip registrations that already got reminder
      if (reg.reminderStatus.reminderSent) continue

      // 3. Check event existence and status
      const event = this.events.get(reg.eventId)
      if (!event || event.status !== 'scheduled') continue

      const eventStartMs = new Date(event.startTime).getTime()
      if (isNaN(eventStartMs)) continue

      // 4. Skip past/expired events
      if (eventStartMs <= nowMs) continue

      // 5. Check if within reminder lead time window
      const leadMinutes = event.reminderLeadTimeMinutes ?? defaultLeadMinutes
      const windowStartMs = eventStartMs - leadMinutes * 60 * 1000

      if (nowMs >= windowStartMs && nowMs < eventStartMs) {
        results.push({
          registration: JSON.parse(JSON.stringify(reg)) as Registration,
          event: { ...event },
        })
      }
    }

    return results
  }

  async clear(): Promise<void> {
    this.events.clear()
    this.registrations.clear()
  }
}
