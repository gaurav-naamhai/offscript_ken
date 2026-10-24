import type { Guest } from './events'

export const dateLabel = (date: string, time?: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(new Date(`${date}T${time ?? '12:00'}`))

export const guestStatus = (guests: Guest[], eventId: string, userId: string | null) => guests.find((guest) => guest.eventId === eventId && guest.userId === userId)?.status

export const eventGuests = (guests: Guest[], eventId: string) => guests.filter((guest) => guest.eventId === eventId && guest.status !== 'declined')

export const activeGuests = (guests: Guest[], eventId: string) => eventGuests(guests, eventId).filter((guest) => guest.status === 'going')
