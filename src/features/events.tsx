import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { notifyEventCancelReminder, notifyEventUpdateReminder, notifyRegistrationDecision, notifyRegistrationSubmitted, sendOrganizerReminder } from './reminder-adapter'

export type EventStatus = 'draft' | 'published' | 'cancelled'
export type RegistrationMode = 'open' | 'approval' | 'closed'
export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type AttendanceStatus = 'not_marked' | 'attended' | 'no_show'
export type EventRecord = { id: string; ownerId: string | null; title: string; description: string; startDate: string; endDate: string; startTime: string; endTime: string; location: string; latitude?: number | null; longitude?: number | null; category: string; capacity: number | null; visibility: 'public' | 'private'; registration: RegistrationMode; status: EventStatus; imageUrl: string; createdAt: string }
export type Guest = { eventId: string; userId: string; name: string; email: string; registrationStatus: RegistrationStatus; attendanceStatus: AttendanceStatus; appliedAt: string }
export type EventInput = Omit<EventRecord, 'id' | 'ownerId' | 'createdAt' | 'status'>
export type MemberRole = 'attendee' | 'organizer'
export type MemberDetails = { name: string; phone: string; email: string; role: MemberRole }

type EventStore = {
  events: EventRecord[]; guests: Guest[]; savedIds: string[]; userId: string | null; userName: string | null; userEmail: string | null; userPhone: string | null; userAvatar: string | null; userRole: MemberRole; loading: boolean; issue: string | null
  startMemberProfile: (details: MemberDetails) => Promise<void>; signOut: () => Promise<void>
  createEvent: (input: EventInput, status: EventStatus) => Promise<string>; updateEvent: (id: string, input: EventInput, status: EventStatus) => Promise<void>; setStatus: (id: string, status: EventStatus) => Promise<void>
  toggleSaved: (id: string) => Promise<void>; register: (event: EventRecord, attendee: { name: string; email: string }) => Promise<void>
  setRegistrationStatus: (eventId: string, guestUserId: string, status: Extract<RegistrationStatus, 'approved' | 'rejected'>) => Promise<void>
  setAttendanceStatus: (eventId: string, guestUserId: string, status: AttendanceStatus) => Promise<void>
  sendReminder: (eventId: string, recipientUserIds?: string[], scheduledAt?: string) => Promise<void>
}

type DbEvent = { id: string; owner_id: string | null; title: string; description: string; start_at: string; end_at: string | null; location: string; latitude: number | null; longitude: number | null; category: string; capacity: number | null; visibility: 'public' | 'private'; registration: RegistrationMode; status: EventStatus; image_url: string; created_at: string }
type DbRegistration = { event_id: string; user_id: string; attendee_name: string; attendee_email: string; registration_status: RegistrationStatus; attendance_status: AttendanceStatus; applied_at: string }
type DbProfile = { id: string; email: string; display_name: string; phone: string | null; role: MemberRole; avatar_url: string | null }
const EventContext = createContext<EventStore | null>(null)
const day = (date: Date) => date.toLocaleDateString('en-CA')
const clock = (date: Date) => date.toTimeString().slice(0, 5)
const recordFromDb = (item: DbEvent): EventRecord => { const start = new Date(item.start_at); const end = item.end_at ? new Date(item.end_at) : null; return { id: item.id, ownerId: item.owner_id, title: item.title, description: item.description, startDate: day(start), endDate: end ? day(end) : '', startTime: clock(start), endTime: end ? clock(end) : '', location: item.location, latitude: item.latitude, longitude: item.longitude, category: item.category, capacity: item.capacity, visibility: item.visibility, registration: item.registration, status: item.status, imageUrl: item.image_url, createdAt: item.created_at } }
const asTimestamp = (date: string, time: string) => new Date(`${date}T${time || '00:00'}:00`).toISOString()

export function EventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userPhone, setUserPhone] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<MemberRole>('attendee')
  const [loading, setLoading] = useState(true)
  const [issue, setIssue] = useState<string | null>(null)

  const load = async (id: string) => {
    if (!supabase) return
    const [eventResult, saveResult, registrationResult] = await Promise.all([
      supabase.from('events').select('*').order('start_at', { ascending: true }),
      supabase.from('event_saves').select('event_id').eq('user_id', id),
      supabase.from('event_registrations').select('*'),
    ])
    const error = eventResult.error ?? saveResult.error ?? registrationResult.error
    if (error) { setIssue('Database setup is not complete yet. Run supabase/schema.sql once in the Supabase SQL Editor.'); return }
    setEvents((eventResult.data as DbEvent[]).map(recordFromDb))
    setSavedIds((saveResult.data ?? []).map((item) => item.event_id))
    setGuests((registrationResult.data as DbRegistration[] ?? []).map((item) => ({ eventId: item.event_id, userId: item.user_id, name: item.attendee_name || 'Gather member', email: item.attendee_email, registrationStatus: item.registration_status, attendanceStatus: item.attendance_status, appliedAt: item.applied_at })))
    setIssue(null)
  }

  useEffect(() => {
    const client = supabase
    if (!client) { setIssue('Add your Supabase URL and publishable key to .env.local to connect your member details.'); setLoading(false); return }
    let mounted = true
    const applySession = async (session: Session | null) => {
      if (!mounted) return
      if (!session) {
        setUserId(null); setUserName(null); setUserEmail(null); setUserPhone(null); setUserAvatar(null); setUserRole('attendee'); setEvents([]); setGuests([]); setSavedIds([]); setIssue(null); setLoading(false)
        return
      }
      const user = session.user
      let pendingDetails: MemberDetails | null = null
      try { const pending = localStorage.getItem('gather-pending-member'); if (pending) pendingDetails = JSON.parse(pending) as MemberDetails } catch { localStorage.removeItem('gather-pending-member') }
      const profileLookup = await client.from('profiles').select('id,email,display_name,phone,role,avatar_url').eq('id', user.id).maybeSingle()
      const storedProfile = profileLookup.data as DbProfile | null
      const details = pendingDetails ?? (storedProfile ? { name: storedProfile.display_name, email: storedProfile.email, phone: storedProfile.phone ?? '', role: storedProfile.role } : null)
      if (!details) {
        setUserId(null); setUserName(null); setUserEmail(null); setUserPhone(null); setUserAvatar(null); setUserRole('attendee'); setLoading(false)
        return
      }
      const displayName = details.name.trim() || 'Gather member'
      const phone = details.phone.trim()
      const role = details.role
      const email = details.email.trim().toLowerCase()
      const avatar = storedProfile?.avatar_url ?? null
      setUserId(user.id); setUserName(displayName); setUserEmail(email); setUserPhone(phone || null); setUserAvatar(avatar); setUserRole(role); setLoading(true)
      const profileResult = await client.from('profiles').upsert({ id: user.id, email, display_name: displayName, phone: phone || null, role, avatar_url: avatar }, { onConflict: 'id' })
      if (pendingDetails) { localStorage.removeItem('gather-pending-member'); if (pendingDetails.role === 'organizer') window.location.hash = '#/organizer/happening-events' }
      await load(user.id)
      if (profileResult.error && mounted) setIssue('Your details could not be saved. Check the Supabase profile table and policies.')
      if (mounted) setLoading(false)
    }
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { window.setTimeout(() => { void applySession(session) }, 0) })
    void client.auth.getSession().then(({ data, error }) => { if (error) { if (mounted) { setIssue(error.message); setLoading(false) }; return }; void applySession(data.session) })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const request = async <T,>(operation: PromiseLike<{ data: T | null; error: { message: string } | null }>) => { const result = await operation; if (result.error) { setIssue(result.error.message); throw result.error } return result.data }
  const value = useMemo<EventStore>(() => ({
    events, guests, savedIds, userId, userName, userEmail, userPhone, userAvatar, userRole, loading, issue,
    startMemberProfile: async (details) => {
      if (!supabase) throw new Error('Supabase is not configured.')
      const normalized = { ...details, name: details.name.trim(), phone: details.phone.trim(), email: details.email.trim().toLowerCase() }
      localStorage.setItem('gather-pending-member', JSON.stringify(normalized))
      const { data: current } = await supabase.auth.getSession()
      if (current.session?.user.is_anonymous) await supabase.auth.signOut()
      const { error } = await supabase.auth.signInAnonymously({ options: { data: { full_name: normalized.name, phone: normalized.phone, role: normalized.role } } })
      if (error) {
        localStorage.removeItem('gather-pending-member')
        const message = error.message.toLowerCase().includes('anonymous') ? 'Enable Anonymous Sign-ins in Supabase Authentication → Providers, then try again.' : error.message
        setIssue(message)
        throw new Error(message)
      }
    },
    signOut: async () => { if (!supabase) return; const { error } = await supabase.auth.signOut(); if (error) { setIssue(error.message); throw error } },
    createEvent: async (input, status) => {
      if (!supabase || !userId) throw new Error('Sign in before creating a gathering.')
      const data = await request(supabase.from('events').insert({ owner_id: userId, title: input.title, description: input.description, start_at: asTimestamp(input.startDate, input.startTime), end_at: input.endDate ? asTimestamp(input.endDate, input.endTime) : null, location: input.location, latitude: input.latitude, longitude: input.longitude, category: input.category, capacity: input.capacity, visibility: input.visibility, registration: input.registration, status, image_url: input.imageUrl }).select().single())
      const record = recordFromDb(data as unknown as DbEvent); setEvents((current) => [...current, record].sort((a, b) => a.startDate.localeCompare(b.startDate))); return record.id
    },
    updateEvent: async (id, input, status) => {
      if (!supabase) return
      const oldEvent = events.find((item) => item.id === id)
      const data = await request(supabase.from('events').update({ title: input.title, description: input.description, start_at: asTimestamp(input.startDate, input.startTime), end_at: input.endDate ? asTimestamp(input.endDate, input.endTime) : null, location: input.location, latitude: input.latitude, longitude: input.longitude, category: input.category, capacity: input.capacity, visibility: input.visibility, registration: input.registration, status, image_url: input.imageUrl }).eq('id', id).select().single())
      setEvents((current) => current.map((item) => item.id === id ? recordFromDb(data as unknown as DbEvent) : item))
      const hasChanges = oldEvent && (oldEvent.title !== input.title || oldEvent.description !== input.description || oldEvent.startDate !== input.startDate || oldEvent.startTime !== input.startTime || oldEvent.endDate !== input.endDate || oldEvent.endTime !== input.endTime || oldEvent.location !== input.location)
      if (hasChanges) void notifyEventUpdateReminder(id)
    },
    setStatus: async (id, status) => { if (!supabase) return; await request(supabase.from('events').update({ status }).eq('id', id)); setEvents((current) => current.map((item) => item.id === id ? { ...item, status } : item)); if (status === 'cancelled') void notifyEventCancelReminder(id) },
    toggleSaved: async (id) => {
      if (!supabase || !userId) return
      const exists = savedIds.includes(id)
      if (exists) await request(supabase.from('event_saves').delete().eq('event_id', id).eq('user_id', userId)); else await request(supabase.from('event_saves').insert({ event_id: id, user_id: userId }))
      setSavedIds((current) => exists ? current.filter((item) => item !== id) : [...current, id])
    },
    register: async (event, attendee) => {
      if (!supabase || !userId) throw new Error('Sign in before registering.')
      const attendeeName = attendee.name.trim()
      const attendeeEmail = attendee.email.trim().toLowerCase()
      if (!attendeeName || !attendeeEmail) throw new Error('Enter your name and email before registering.')
      const registrationStatus: RegistrationStatus = event.registration === 'approval' ? 'pending' : 'approved'
      const data = await request(supabase.from('event_registrations').insert({ event_id: event.id, user_id: userId, attendee_name: attendeeName, attendee_email: attendeeEmail, registration_status: registrationStatus, attendance_status: 'not_marked' }).select().single())
      const record = data as unknown as DbRegistration
      setGuests((current) => [...current, { eventId: record.event_id, userId: record.user_id, name: record.attendee_name, email: record.attendee_email, registrationStatus: record.registration_status, attendanceStatus: record.attendance_status, appliedAt: record.applied_at }])
      const emailResult = await notifyRegistrationSubmitted(event.id)
      if (!emailResult.success) setIssue(`Registration saved. Confirmation email could not be sent: ${emailResult.error ?? 'Email delivery is unavailable.'}`)
    },
    setRegistrationStatus: async (eventId, guestUserId, status) => {
      if (!supabase || !userId) return
      const data = await request(supabase.from('event_registrations').update({ registration_status: status, decided_at: new Date().toISOString(), decided_by: userId }).eq('event_id', eventId).eq('user_id', guestUserId).select().single())
      const record = data as unknown as DbRegistration
      setGuests((current) => current.map((item) => item.eventId === eventId && item.userId === guestUserId ? { ...item, registrationStatus: record.registration_status } : item))
      void notifyRegistrationDecision(eventId, guestUserId)
    },
    setAttendanceStatus: async (eventId, guestUserId, status) => {
      if (!supabase || !userId) return
      await request(supabase.from('event_registrations').update({ attendance_status: status, attendance_marked_at: new Date().toISOString(), attendance_marked_by: userId }).eq('event_id', eventId).eq('user_id', guestUserId))
      setGuests((current) => current.map((item) => item.eventId === eventId && item.userId === guestUserId ? { ...item, attendanceStatus: status } : item))
    },
    sendReminder: async (eventId, recipientUserIds, scheduledAt) => { await sendOrganizerReminder(eventId, recipientUserIds, scheduledAt) },
  }), [events, guests, savedIds, userId, userName, userEmail, userPhone, userAvatar, userRole, loading, issue])
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}

export const useEvents = () => { const store = useContext(EventContext); if (!store) throw new Error('useEvents must be used inside EventProvider'); return store }
