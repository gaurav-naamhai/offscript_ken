import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { notifyEventCancelReminder, notifyEventUpdateReminder, notifyRsvpReminder } from './reminder-adapter'

export type EventStatus = 'draft' | 'published' | 'cancelled'
export type RegistrationMode = 'open' | 'approval' | 'closed'
export type RsvpStatus = 'going' | 'requested' | 'declined'
export type AgendaItem = { time: string; title: string }
export type EventRecord = { id: string; ownerId: string; title: string; description: string; startDate: string; endDate: string; startTime: string; endTime: string; location: string; category: string; capacity: number | null; visibility: 'public' | 'private'; registration: RegistrationMode; status: EventStatus; imageUrl: string; createdAt: string; hostName?: string; hostBio?: string; agenda?: AgendaItem[]; registrationQuestions?: string[] }
export type Guest = { eventId: string; userId: string; name: string; status: RsvpStatus; checkedIn: boolean }
export type EventInput = Omit<EventRecord, 'id' | 'ownerId' | 'createdAt' | 'status' | 'imageUrl'>
type EventStore = { events: EventRecord[]; guests: Guest[]; savedIds: string[]; userId: string | null; loading: boolean; issue: string | null; previewSavedIds: string[]; previewGuests: Guest[]; togglePreviewSaved: (id: string) => void; rsvpToPreview: (event: EventRecord, status: RsvpStatus) => void; createEvent: (input: EventInput, status: EventStatus) => Promise<string>; updateEvent: (id: string, input: EventInput, status: EventStatus) => Promise<void>; setStatus: (id: string, status: EventStatus) => Promise<void>; toggleSaved: (id: string) => Promise<void>; rsvp: (event: EventRecord, status: RsvpStatus, attendeeEmail?: string) => Promise<void>; setGuestStatus: (eventId: string, userId: string, status: RsvpStatus) => Promise<void>; checkIn: (eventId: string, userId: string) => Promise<void> }

type DbEvent = { id: string; owner_id: string; title: string; description: string; start_at: string; end_at: string | null; location: string; category: string; capacity: number | null; visibility: 'public' | 'private'; registration: RegistrationMode; status: EventStatus; image_url: string; created_at: string; host_name?: string; host_bio?: string; agenda?: AgendaItem[]; registration_questions?: string[] }
const EventContext = createContext<EventStore | null>(null)
const day = (date: Date) => date.toLocaleDateString('en-CA')
const clock = (date: Date) => date.toTimeString().slice(0, 5)
const recordFromDb = (item: DbEvent): EventRecord => { const start = new Date(item.start_at); const end = item.end_at ? new Date(item.end_at) : null; return { id: item.id, ownerId: item.owner_id, title: item.title, description: item.description, startDate: day(start), endDate: end ? day(end) : '', startTime: clock(start), endTime: end ? clock(end) : '', location: item.location, category: item.category, capacity: item.capacity, visibility: item.visibility, registration: item.registration, status: item.status, imageUrl: item.image_url, createdAt: item.created_at, hostName: item.host_name ?? '', hostBio: item.host_bio ?? '', agenda: item.agenda ?? [], registrationQuestions: item.registration_questions ?? [] } }
const asTimestamp = (date: string, time: string) => new Date(`${date}T${time || '00:00'}:00`).toISOString()
const previewUserId = 'local-preview-guest'
const previewSavedKey = 'gather-preview-saved-events'
const previewRsvpKey = 'gather-preview-rsvps'

function readPreviewState<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T : fallback
  } catch {
    return fallback
  }
}

export function EventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [issue, setIssue] = useState<string | null>(null)
  const [previewSavedIds, setPreviewSavedIds] = useState<string[]>(() => readPreviewState(previewSavedKey, []))
  const [previewGuests, setPreviewGuests] = useState<Guest[]>(() => readPreviewState(previewRsvpKey, []))

  useEffect(() => { window.localStorage.setItem(previewSavedKey, JSON.stringify(previewSavedIds)) }, [previewSavedIds])
  useEffect(() => { window.localStorage.setItem(previewRsvpKey, JSON.stringify(previewGuests)) }, [previewGuests])

  const load = async (id: string) => {
    if (!supabase) return
    const [eventResult, saveResult, rsvpResult] = await Promise.all([
      supabase.from('events').select('*').order('start_at', { ascending: true }),
      supabase.from('event_saves').select('event_id').eq('user_id', id),
      supabase.from('event_rsvps').select('*'),
    ])
    const error = eventResult.error ?? saveResult.error ?? rsvpResult.error
    if (error) { setIssue('Database setup is not complete yet. Run supabase/schema.sql once in the Supabase SQL Editor.'); return }
    setEvents((eventResult.data as DbEvent[]).map(recordFromDb))
    setSavedIds((saveResult.data ?? []).map((item) => item.event_id))
    setGuests((rsvpResult.data ?? []).map((item) => ({ eventId: item.event_id, userId: item.user_id, name: item.user_id === id ? 'You' : 'Guest', status: item.status as RsvpStatus, checkedIn: item.checked_in })))
    setIssue(null)
  }

  useEffect(() => { void (async () => {
    if (!supabase) { setIssue('Missing Supabase environment values.'); setLoading(false); return }
    let session = (await supabase.auth.getSession()).data.session
    if (!session) { const signedIn = await supabase.auth.signInAnonymously(); session = signedIn.data.session; if (signedIn.error || !session) { setIssue('Enable Anonymous Sign-Ins in Supabase Authentication before using Gather.'); setLoading(false); return } }
    setUserId(session.user.id); await load(session.user.id); setLoading(false)
  })() }, [])

  const request = async <T,>(operation: PromiseLike<{ data: T | null; error: { message: string } | null }>) => { const result = await operation; if (result.error) { setIssue(result.error.message); throw result.error } return result.data }
  const value = useMemo<EventStore>(() => ({
    events, guests, savedIds, userId, loading, issue, previewSavedIds, previewGuests,
    togglePreviewSaved: (id) => setPreviewSavedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]),
    rsvpToPreview: (event, status) => setPreviewGuests((current) => [
      ...current.filter((item) => !(item.eventId === event.id && item.userId === previewUserId)),
      { eventId: event.id, userId: previewUserId, name: 'You', status, checkedIn: false },
    ]),
    createEvent: async (input, status) => { if (!supabase || !userId) throw new Error('Supabase is not ready'); const data = await request(supabase.from('events').insert({ owner_id: userId, title: input.title, description: input.description, start_at: asTimestamp(input.startDate, input.startTime), end_at: input.endDate ? asTimestamp(input.endDate, input.endTime) : null, location: input.location, category: input.category, capacity: input.capacity, visibility: input.visibility, registration: input.registration, status, host_name: input.hostName ?? '', host_bio: input.hostBio ?? '', agenda: input.agenda ?? [], registration_questions: input.registrationQuestions ?? [] }).select().single()); const record = recordFromDb(data as unknown as DbEvent); setEvents((current) => [...current, record].sort((a, b) => a.startDate.localeCompare(b.startDate))); return record.id },
    updateEvent: async (id, input, status) => { if (!supabase) return; const oldEvent = events.find((item) => item.id === id); const data = await request(supabase.from('events').update({ title: input.title, description: input.description, start_at: asTimestamp(input.startDate, input.startTime), end_at: input.endDate ? asTimestamp(input.endDate, input.endTime) : null, location: input.location, category: input.category, capacity: input.capacity, visibility: input.visibility, registration: input.registration, status, host_name: input.hostName, host_bio: input.hostBio, agenda: input.agenda, registration_questions: input.registrationQuestions }).eq('id', id).select().single()); setEvents((current) => current.map((item) => item.id === id ? recordFromDb(data as unknown as DbEvent) : item)); const hasChanges = oldEvent && (oldEvent.title !== input.title || oldEvent.description !== input.description || oldEvent.startDate !== input.startDate || oldEvent.startTime !== input.startTime || oldEvent.endDate !== input.endDate || oldEvent.endTime !== input.endTime || oldEvent.location !== input.location); if (hasChanges) { void notifyEventUpdateReminder(id, input); } },
    setStatus: async (id, status) => { if (!supabase) return; await request(supabase.from('events').update({ status }).eq('id', id)); setEvents((current) => current.map((item) => item.id === id ? { ...item, status } : item)); if (status === 'cancelled') { void notifyEventCancelReminder(id); } },
    toggleSaved: async (id) => { if (!supabase || !userId) return; const exists = savedIds.includes(id); if (exists) await request(supabase.from('event_saves').delete().eq('event_id', id).eq('user_id', userId)); else await request(supabase.from('event_saves').insert({ event_id: id, user_id: userId })); setSavedIds((current) => exists ? current.filter((item) => item !== id) : [...current, id]) },
    rsvp: async (event, status, attendeeEmail) => { if (!supabase || !userId) return; await request(supabase.from('event_rsvps').upsert({ event_id: event.id, user_id: userId, status, checked_in: false }, { onConflict: 'event_id,user_id' })); setGuests((current) => [...current.filter((item) => !(item.eventId === event.id && item.userId === userId)), { eventId: event.id, userId, name: 'You', status, checkedIn: false }]); if (attendeeEmail && (status === 'going' || status === 'requested')) { void notifyRsvpReminder(event, { id: userId, name: 'You', email: attendeeEmail }); } },
    setGuestStatus: async (eventId, guestUserId, status) => { if (!supabase) return; await request(supabase.from('event_rsvps').update({ status }).eq('event_id', eventId).eq('user_id', guestUserId)); setGuests((current) => current.map((item) => item.eventId === eventId && item.userId === guestUserId ? { ...item, status } : item)) },
    checkIn: async (eventId, guestUserId) => { if (!supabase) return; const guest = guests.find((item) => item.eventId === eventId && item.userId === guestUserId); if (!guest) return; await request(supabase.from('event_rsvps').update({ checked_in: !guest.checkedIn }).eq('event_id', eventId).eq('user_id', guestUserId)); setGuests((current) => current.map((item) => item.eventId === eventId && item.userId === guestUserId ? { ...item, checkedIn: !item.checkedIn } : item)) },
  }), [events, guests, savedIds, userId, loading, issue, previewSavedIds, previewGuests])
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}

export const useEvents = () => { const store = useContext(EventContext); if (!store) throw new Error('useEvents must be used inside EventProvider'); return store }
