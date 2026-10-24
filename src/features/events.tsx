import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type EventStatus = 'draft' | 'published' | 'cancelled'
export type RegistrationMode = 'open' | 'approval' | 'closed'
export type RsvpStatus = 'going' | 'requested' | 'declined'
export type EventRecord = { id: string; title: string; description: string; startDate: string; endDate: string; startTime: string; endTime: string; location: string; category: string; capacity: number | null; visibility: 'public' | 'private'; registration: RegistrationMode; status: EventStatus; createdAt: string }
export type Guest = { eventId: string; name: string; status: RsvpStatus; checkedIn: boolean }
export type EventInput = Omit<EventRecord, 'id' | 'createdAt' | 'status'>
type EventStore = { events: EventRecord[]; guests: Guest[]; savedIds: string[]; createEvent: (input: EventInput, status: EventStatus) => string; updateEvent: (id: string, input: EventInput, status: EventStatus) => void; setStatus: (id: string, status: EventStatus) => void; toggleSaved: (id: string) => void; rsvp: (event: EventRecord, status: RsvpStatus) => void; setGuestStatus: (eventId: string, name: string, status: RsvpStatus) => void; checkIn: (eventId: string, name: string) => void }

const EVENTS_KEY = 'gather.events.v1'
const SAVED_KEY = 'gather.saved.v1'
const GUESTS_KEY = 'gather.guests.v1'
const EventContext = createContext<EventStore | null>(null)
const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(window.localStorage.getItem(key) ?? '') as T } catch { return fallback } }

export function EventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<EventRecord[]>(() => read(EVENTS_KEY, []))
  const [savedIds, setSavedIds] = useState<string[]>(() => read(SAVED_KEY, []))
  const [guests, setGuests] = useState<Guest[]>(() => read(GUESTS_KEY, []))
  useEffect(() => window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events)), [events])
  useEffect(() => window.localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds)), [savedIds])
  useEffect(() => window.localStorage.setItem(GUESTS_KEY, JSON.stringify(guests)), [guests])
  const value = useMemo<EventStore>(() => ({
    events, guests, savedIds,
    createEvent: (input, status) => { const id = crypto.randomUUID(); setEvents((current) => [{ ...input, id, status, createdAt: new Date().toISOString() }, ...current]); return id },
    updateEvent: (id, input, status) => setEvents((current) => current.map((event) => event.id === id ? { ...event, ...input, status } : event)),
    setStatus: (id, status) => setEvents((current) => current.map((event) => event.id === id ? { ...event, status } : event)),
    toggleSaved: (id) => setSavedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]),
    rsvp: (event, status) => setGuests((current) => { const withoutCurrent = current.filter((guest) => !(guest.eventId === event.id && guest.name === 'You')); return status === 'declined' ? withoutCurrent : [...withoutCurrent, { eventId: event.id, name: 'You', status, checkedIn: false }] }),
    setGuestStatus: (eventId, name, status) => setGuests((current) => current.map((guest) => guest.eventId === eventId && guest.name === name ? { ...guest, status } : guest)),
    checkIn: (eventId, name) => setGuests((current) => current.map((guest) => guest.eventId === eventId && guest.name === name ? { ...guest, checkedIn: !guest.checkedIn } : guest)),
  }), [events, guests, savedIds])
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}

export const useEvents = () => { const store = useContext(EventContext); if (!store) throw new Error('useEvents must be used inside EventProvider'); return store }
