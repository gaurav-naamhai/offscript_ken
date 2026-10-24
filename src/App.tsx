import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, Download, MapPin, Moon, Plus, Search, Sun, Users } from 'lucide-react'
import { AppShell } from './components/AppShell'
import { EventCard } from './components/EventCard'
import { HappeningEventsView } from './components/discovery/HappeningEventsView'
import { EventForm } from './components/EventForm'
import { SAMPLE_EVENTS } from './features/events/sampleEvents'
import { EventProvider, useEvents, type EventRecord } from './features/events'
import { activeGuests, dateLabel, eventGuests, guestStatus } from './features/event-utils'
import type { GatherEvent } from './types/event'
import { createHref, editHref, eventHref, getRoute, routeHref, type SectionId, type WorkspaceRoute } from './features/workspace'

const sectionCopy: Record<'user' | 'organizer', Record<SectionId, { title: string; subtitle: string }>> = {
  user: {
    'happening-events': { title: 'Mumbai, in build mode.', subtitle: 'Find your people. Ship something together.' },
    'my-events': { title: 'Small plans, lovely people.', subtitle: 'The gatherings you have saved, and the ones you cannot wait to join.' },
    calendar: { title: 'A little room for plans.', subtitle: 'Your gatherings, in one place.' },
  },
  organizer: {
    'happening-events': { title: 'Your club, out in the city.', subtitle: 'See what is bringing people together this week.' },
    'my-events': { title: 'Your gatherings.', subtitle: 'From first idea to getting together.' },
    calendar: { title: 'The week ahead.', subtitle: 'Give your gatherings a place to grow.' },
  },
}

function App() {
  return <EventProvider><GatherApp /></EventProvider>
}

function GatherApp() {
  const [route, setRoute] = useState<WorkspaceRoute>(getRoute)
  const { userId, userName, userEmail, userAvatar, userRole, loading, issue, startMemberProfile, signOut } = useEvents()
  useEffect(() => { const onHashChange = () => setRoute(getRoute()); window.addEventListener('hashchange', onHashChange); return () => window.removeEventListener('hashchange', onHashChange) }, [])
  const label = route.eventId ? 'Event' : route.create ? 'Create event' : route.editId ? 'Edit event' : sectionCopy[route.mode][route.section].title
  useEffect(() => { document.title = `${label} · Gather Club` }, [label])
  if (loading) return <div className="auth-loading"><span className="auth-mark">gather<span>club</span></span><p>Setting the table…</p></div>
  if (!userId || !userEmail) return <SignInScreen issue={issue} onSubmit={startMemberProfile} />
  return <AppShell route={route} userName={userName} userEmail={userEmail} userAvatar={userAvatar} userRole={userRole} onSignOut={() => { void signOut() }}><RouteScreen route={route} /></AppShell>
}

function SignInScreen({ issue, onSubmit }: { issue: string | null; onSubmit: (details: { name: string; phone: string; email: string; role: 'attendee' | 'organizer' }) => Promise<void> }) {
  const [role, setRole] = useState<'attendee' | 'organizer'>('attendee')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('gather-theme') === 'dark' ? 'dark' : 'light')
  useEffect(() => { localStorage.setItem('gather-theme', theme) }, [theme])
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setError(''); try { await onSubmit({ name, phone, email, role }) } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not save your details. Please try again.') } finally { setBusy(false) } }
  return <main className={`signin-page signin-theme-${theme}`}>
    <section className="signin-visual" aria-label="Gather Club community moments">
      <img className="signin-photo signin-photo-main" src="/images/gather-tech-talk.png" alt="A founder shares an idea with a small Mumbai tech community" />
      <div className="signin-photo-rail" aria-hidden="true">
        <img src="/images/gather-rooftop-social.png" alt="" />
        <img src="/images/gather-creative-salon.png" alt="" />
      </div>
      <div className="signin-visual-copy"><span>GATHER CLUB · MUMBAI</span><h1>Good plans.<br />Good people.</h1><p>For the curious, the builders, and everyone they bring along.</p></div>
    </section>
    <section className="signin-panel"><div className="signin-top"><a className="signin-wordmark" href="#/user/happening-events">gather<span>club</span></a><button type="button" className="signin-theme-toggle" aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button></div><div className="signin-content"><p className="signin-kicker">A seat is waiting</p><h2>Come as you are.</h2><p className="signin-intro">Tell us where to send event updates, then start finding gatherings around Mumbai.</p><form className="member-signup-form" onSubmit={(event) => { void submit(event) }}><fieldset className="member-role-field"><legend>I’m here as</legend><div className="member-role-options"><button type="button" className={role === 'attendee' ? 'is-selected' : ''} aria-pressed={role === 'attendee'} onClick={() => setRole('attendee')}><strong>Attendee</strong><span>Find gatherings to join</span></button><button type="button" className={role === 'organizer' ? 'is-selected' : ''} aria-pressed={role === 'organizer'} onClick={() => setRole('organizer')}><strong>Organizer</strong><span>Bring people together</span></button></div></fieldset><label className="member-field"><span>Your name</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="How should we call you?" required /></label><label className="member-field"><span>Phone number <em>optional</em></span><input autoComplete="tel" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" /></label><label className="member-field"><span>Email address</span><input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label><button className="google-signin member-submit" type="submit" disabled={busy}>{busy ? 'Saving your details…' : 'Continue'}<span aria-hidden="true">↗</span></button></form><p className="signin-reassurance">Your details are saved for event registration, decisions, and reminders.</p>{error || issue ? <p className="signin-error" role="alert">{error || issue}</p> : null}<p className="signin-terms">We use your email only for event-related updates from Gather Club.</p></div><div className="signin-footer"><span>Made for getting together.</span><span>Mumbai · India</span></div></section>
  </main>
}

function RouteScreen({ route }: { route: WorkspaceRoute }) {
  const { events, createEvent, updateEvent } = useEvents()
  if (route.create) return <EventForm onSubmit={(input, status) => { void createEvent(input, status).then((id) => { window.location.hash = eventHref('organizer', id) }) }} />
  if (route.editId) { const event = events.find((item) => item.id === route.editId); return event ? <EventForm event={event} onSubmit={(input, status) => { void updateEvent(event.id, input, status).then(() => { window.location.hash = eventHref('organizer', event.id) }) }} /> : <NotFound /> }
  if (route.eventId) { const event = events.find((item) => item.id === route.eventId); return event ? <EventDetail event={event} mode={route.mode} /> : <NotFound /> }
  return <Workspace route={route} />
}

function Workspace({ route }: { route: WorkspaceRoute }) {
  const copy = sectionCopy[route.mode][route.section]
  return <section className="feature-section" aria-labelledby="section-title">
    {!(route.mode === 'user' && route.section === 'happening-events') ? <div className="section-heading with-action"><div><h1 id="section-title">{copy.title}</h1><p>{copy.subtitle}</p></div>{route.mode === 'organizer' && route.section === 'my-events' ? <a className="button button-primary" href={createHref}><Plus size={18} />Create event</a> : null}</div> : null}
    {route.section === 'happening-events' ? <HappeningEvents mode={route.mode} /> : null}
    {route.section === 'my-events' ? <MyEvents mode={route.mode} /> : null}
    {route.section === 'calendar' ? <CalendarView mode={route.mode} /> : null}
    <DataNotice />
  </section>
}

function HappeningEvents({ mode }: { mode: 'user' | 'organizer' }) {
  const { events, guests, savedIds } = useEvents()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const published = events.filter((event) => event.status === 'published' && event.visibility === 'public')
  if (mode === 'user') {
    const liveEvents: GatherEvent[] = published.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      category: event.category,
      startDateTime: `${event.startDate}T${event.startTime || '00:00'}:00`,
      endDateTime: event.endDate ? `${event.endDate}T${event.endTime || '00:00'}:00` : undefined,
      venueName: event.location || 'Location to be announced',
      address: event.location || 'Location to be announced',
      latitude: event.latitude ?? null,
      longitude: event.longitude ?? null,
      imageUrl: event.imageUrl,
      registrationHref: eventHref('user', event.id),
    }))
    return <HappeningEventsView events={liveEvents.length ? [...liveEvents, ...SAMPLE_EVENTS] : SAMPLE_EVENTS} />
  }
  const categories = ['All categories', ...Array.from(new Set(published.map((event) => event.category)))]
  const shown = published.filter((event) => `${event.title} ${event.description} ${event.location}`.toLowerCase().includes(query.toLowerCase()) && (category === 'All categories' || event.category === category))
  if (!events.length) return <EmptyPanel title="Your first event starts here." description="Create it once, publish when you are ready, and it will appear for attendees here." action="Create event" href={createHref} />
  if (!published.length) return <div className="event-index"><DiscoveryHero mode={mode} /><EmptyPanel title="There is always room for one more." description="Publish a gathering when it is ready, and people will find their way to it." action="Go to My Events" href={routeHref({ mode, section: 'my-events' })} /></div>
  const grouped = shown.reduce<Record<string, EventRecord[]>>((all, event) => { (all[event.startDate] ??= []).push(event); return all }, {})
  return <div className="event-index"><DiscoveryHero mode={mode} /><div className="club-events-heading" id="gatherings"><div><p className="club-kicker">A good week starts here · Mumbai</p><h2>Small plans, lovely people.</h2></div><span>{shown.length} {shown.length === 1 ? 'gathering' : 'gatherings'}</span></div><div className="discover-tools"><label className="search-field"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search gatherings, hosts, or places" /></label></div><div className="category-chips" aria-label="Browse by interest">{categories.map((item) => <button type="button" key={item} className={category === item ? 'is-selected' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item === 'All categories' ? 'All gatherings' : item}</button>)}</div>{shown.length ? <div className="day-groups">{Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, dayEvents]) => <section className="day-group" key={date}><header><h3>{new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date(`${date}T12:00`))}</h3><time>{new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00`))}</time></header><div className="event-grid">{dayEvents.map((event) => <EventCard key={event.id} event={event} mode={mode} saved={savedIds.includes(event.id)} guestCount={activeGuests(guests, event.id).length} />)}</div></section>)}</div> : <EmptyPanel title="No matches just yet." description="Try another kind of gathering or search for a different place." />}</div>
}

function MyEvents({ mode }: { mode: 'user' | 'organizer' }) {
  const { events, guests, savedIds, setStatus, userId } = useEvents()
  if (mode === 'user') {
    const mine = events.filter((event) => savedIds.includes(event.id) || Boolean(guestStatus(guests, event.id, userId)))
    return mine.length ? <div className="event-index"><div className="event-grid">{mine.map((event) => <EventCard key={event.id} event={event} mode="user" saved={savedIds.includes(event.id)} guestCount={activeGuests(guests, event.id).length} />)}</div></div> : <EmptyPanel title="Your plans will land here." description="Save an event or RSVP to keep it on your list." href={routeHref({ mode, section: 'happening-events' })} action="Explore events" />
  }
  const mine = events.filter((event) => event.ownerId === userId)
  return mine.length ? <div className="organizer-list">{mine.map((event) => <article key={event.id} className="organizer-row"><a href={eventHref('organizer', event.id)}><span className={`status-dot status-${event.status}`} /><div><strong>{event.title}</strong><small>{dateLabel(event.startDate, event.startTime)} · {event.location}</small></div></a><span className={`status-label status-${event.status}`}>{event.status}</span><div className="row-actions">{event.status === 'draft' ? <button className="text-button" onClick={() => { void setStatus(event.id, 'published') }}>Publish</button> : null}{event.status === 'published' ? <button className="text-button" onClick={() => { void setStatus(event.id, 'cancelled') }}>Cancel</button> : null}<a className="text-button" href={editHref(event.id)}>Edit</a></div></article>)}</div> : <EmptyPanel title="There is room for the first one." description="Create a draft now, then decide when to publish it." action="Create event" href={createHref} />
}

function CalendarView({ mode }: { mode: 'user' | 'organizer' }) {
  const { events, guests, savedIds, userId } = useEvents()
  const relevant = events.filter((event) => mode === 'organizer' ? event.ownerId === userId && event.status !== 'cancelled' : event.status === 'published' && (savedIds.includes(event.id) || Boolean(guestStatus(guests, event.id, userId))))
  const grouped = relevant.sort((a, b) => a.startDate.localeCompare(b.startDate)).reduce<Record<string, EventRecord[]>>((all, event) => { (all[event.startDate] ??= []).push(event); return all }, {})
  return Object.keys(grouped).length ? <div className="calendar-list">{Object.entries(grouped).map(([date, dayEvents]) => <div className="calendar-day" key={date}><time>{new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00`))}</time><div>{dayEvents.map((event) => <a key={event.id} href={eventHref(mode, event.id)} className="calendar-event"><span>{event.startTime}</span><strong>{event.title}</strong><small>{event.location}</small></a>)}</div></div>)}</div> : <EmptyPanel title="Your calendar is wide open." description={mode === 'user' ? 'Save or RSVP to an event and it will appear here.' : 'Your drafts and published events will appear here.'} href={mode === 'user' ? routeHref({ mode, section: 'happening-events' }) : createHref} action={mode === 'user' ? 'Explore events' : 'Create event'} />
}

function EventDetail({ event, mode }: { event: EventRecord; mode: 'user' | 'organizer' }) {
  const { guests, savedIds, toggleSaved, register, setStatus, setRegistrationStatus, setAttendanceStatus, sendReminder, userId, userName, userEmail, issue } = useEvents()
  const [registrationError, setRegistrationError] = useState('')
  const [attendeeName, setAttendeeName] = useState(userName ?? '')
  const [attendeeEmail, setAttendeeEmail] = useState(userEmail ?? '')
  const [showRegistrationForm, setShowRegistrationForm] = useState(false)
  const [submittingRegistration, setSubmittingRegistration] = useState(false)
  const currentStatus = guestStatus(guests, event.id, userId)
  const attending = activeGuests(guests, event.id)
  const guestList = eventGuests(guests, event.id)
  const full = Boolean(event.capacity && attending.length >= event.capacity)
  const organizer = mode === 'organizer'
  const submitRegistration = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    setRegistrationError('')
    setSubmittingRegistration(true)
    void register(event, { name: attendeeName, email: attendeeEmail })
      .catch((error) => setRegistrationError(error instanceof Error ? error.message : 'Your registration could not be saved.'))
      .finally(() => setSubmittingRegistration(false))
  }
  const userMessage = currentStatus === 'approved' ? 'Your registration is approved. We will keep this event in My Events and your calendar.' : currentStatus === 'pending' ? 'Your registration is pending organizer approval.' : currentStatus === 'rejected' ? 'This registration was not approved by the organizer.' : full ? 'This event is at capacity.' : 'Save it for later or register when you are ready.'
  return <section className="event-detail"><a className="back-link" href={routeHref({ mode, section: organizer ? 'my-events' : 'happening-events' })}>← Back</a>{issue ? <p className="data-notice is-warning" role="status">{issue}</p> : null}<div className="detail-cover"><img src={event.imageUrl} alt="" /></div><div className="detail-hero"><div><p className="event-card-date">{dateLabel(event.startDate, event.startTime)}</p><h1>{event.title}</h1><p className="detail-description">{event.description || 'This event is still taking shape.'}</p><div className="detail-meta"><span><MapPin size={18} />{event.location}</span><span><Users size={18} />{attending.length}{event.capacity ? ` / ${event.capacity}` : ''} approved</span><span><CalendarDays size={18} />{event.category}</span></div></div><div className="detail-actions">{organizer ? <><a className="button button-secondary" href={editHref(event.id)}>Edit event</a>{event.status === 'draft' ? <button className="button button-primary" onClick={() => { void setStatus(event.id, 'published') }}>Publish</button> : event.status === 'published' ? <button className="button button-danger" onClick={() => { void setStatus(event.id, 'cancelled') }}>Cancel event</button> : null}</> : <><button className={`button button-secondary ${savedIds.includes(event.id) ? 'is-selected' : ''}`} onClick={() => { void toggleSaved(event.id) }}>{savedIds.includes(event.id) ? 'Saved' : 'Save event'}</button><button className="button button-secondary" onClick={() => downloadIcs(event)}><Download size={18} />Add to calendar</button>{event.status === 'published' && event.registration !== 'closed' && !full && !currentStatus ? <div className="rsvp-control-group">{showRegistrationForm ? <form onSubmit={(formEvent) => { void submitRegistration(formEvent) }}><label className="member-field"><span>Your name</span><input autoComplete="name" value={attendeeName} onChange={(formEvent) => setAttendeeName(formEvent.target.value)} required /></label><label className="member-field"><span>Email address</span><input autoComplete="email" type="email" value={attendeeEmail} onChange={(formEvent) => setAttendeeEmail(formEvent.target.value)} required /></label>{registrationError ? <p className="rsvp-error" role="alert">{registrationError}</p> : null}<button className="button button-primary" type="submit" disabled={submittingRegistration}>{submittingRegistration ? 'Registering…' : event.registration === 'approval' ? 'Request to join' : 'Confirm registration'}</button></form> : <button className="button button-primary" onClick={() => setShowRegistrationForm(true)}>{event.registration === 'approval' ? 'Request to join' : 'Register'}</button>}</div> : null}</>}</div></div>
    <div className="detail-columns"><div className="detail-panel"><h2>Good to know</h2><dl><div><dt>When</dt><dd>{dateLabel(event.startDate, event.startTime)}{event.endDate ? ` — ${dateLabel(event.endDate, event.endTime)}` : ''}</dd></div><div><dt>Access</dt><dd>{event.registration === 'approval' ? 'Approval required' : event.registration === 'closed' ? 'Registration closed' : 'Open registration'}</dd></div><div><dt>Visibility</dt><dd>{event.visibility === 'public' ? 'Public event' : 'Private event'}</dd></div></dl></div>{organizer ? <GuestPanel event={event} guests={guestList} onRegistrationDecision={(guestUserId, status) => { void setRegistrationStatus(event.id, guestUserId, status) }} onAttendance={(guestUserId, status) => { void setAttendanceStatus(event.id, guestUserId, status) }} onSendReminder={(recipientUserIds, scheduledAt) => { void sendReminder(event.id, recipientUserIds, scheduledAt) }} /> : <div className="detail-panel"><h2>Your registration</h2><p>{userMessage}</p></div>}</div>
  </section>
}

function GuestPanel({ event: _event, guests, onRegistrationDecision, onAttendance, onSendReminder }: { event: EventRecord; guests: ReturnType<typeof eventGuests>; onRegistrationDecision: (userId: string, status: 'approved' | 'rejected') => void; onAttendance: (userId: string, status: 'attended' | 'no_show') => void; onSendReminder: (recipientUserIds?: string[], scheduledAt?: string) => void }) {
  const approved = guests.filter((guest) => guest.registrationStatus === 'approved')
  const [scheduledAt, setScheduledAt] = useState('')
  return <div className="detail-panel guest-panel"><div className="guest-panel-heading"><h2>Registrations <span>{guests.length}</span></h2>{approved.length ? <button className="text-button" onClick={() => onSendReminder()}>Email all approved</button> : null}</div>{approved.length ? <div className="reminder-schedule"><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} aria-label="Reminder send time" /><button className="text-button" disabled={!scheduledAt} onClick={() => onSendReminder(undefined, scheduledAt)}>Schedule approved reminder</button></div> : null}{guests.length ? <ul>{guests.map((guest) => <li key={guest.userId}><div><strong>{guest.name}</strong><small>{guest.email} · {guest.registrationStatus === 'pending' ? 'Awaiting approval' : guest.registrationStatus === 'approved' ? `Approved · ${guest.attendanceStatus === 'not_marked' ? 'Attendance not marked' : guest.attendanceStatus === 'attended' ? 'Attended' : 'No-show'}` : 'Rejected'}</small></div><div className="guest-actions">{guest.registrationStatus === 'pending' ? <><button className="text-button" onClick={() => onRegistrationDecision(guest.userId, 'approved')}>Approve</button><button className="text-button" onClick={() => onRegistrationDecision(guest.userId, 'rejected')}>Reject</button></> : guest.registrationStatus === 'approved' ? <><button className="text-button" onClick={() => onSendReminder([guest.userId])}>Reminder</button><button className="text-button" onClick={() => onAttendance(guest.userId, guest.attendanceStatus === 'attended' ? 'no_show' : 'attended')}>{guest.attendanceStatus === 'attended' ? 'Mark no-show' : 'Mark attended'}</button></> : null}</div></li>)}</ul> : <p>Registrations will appear here.</p>}</div>
}

function DataNotice() { const { loading, issue } = useEvents(); return loading ? <p className="data-notice">Preparing your private event space…</p> : issue ? <p className="data-notice is-warning">{issue}</p> : null }
function DiscoveryHero({ mode }: { mode: 'user' | 'organizer' }) { return <section className="discovery-hero"><img src="https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1400&q=88" onError={(event) => { event.currentTarget.src = '/images/moonlit-studio.png' }} alt="Friends sharing dinner around a long table" /><div><p>Good plans. Good people. No plus-one needed.</p><h1 id="section-title">Come as you are.</h1><span>Shared tables, living-room concerts, and little adventures with people who are glad you came.</span><button className="button button-primary" type="button" onClick={() => document.getElementById('gatherings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{mode === 'organizer' ? 'See your club' : 'Find your first gathering'} <span aria-hidden="true">↗</span></button></div></section> }

function EmptyPanel({ title, description, action, href }: { title: string; description: string; action?: string; href?: string }) { return <div className="empty-panel"><div className="empty-icon"><CalendarDays size={52} /></div><h2>{title}</h2><p>{description}</p>{action && href ? <a className="button button-primary" href={href}><Plus size={18} />{action}</a> : null}</div> }
function NotFound() { return <EmptyPanel title="This event is not here." description="It may have been removed from this browser." href={routeHref({ mode: 'user', section: 'happening-events' })} action="Explore events" /> }

function downloadIcs(event: EventRecord) { const stamp = (date: string, time: string) => `${date.replaceAll('-', '')}T${time.replace(':', '')}00`; const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `UID:${event.id}@gather`, `DTSTART:${stamp(event.startDate, event.startTime)}`, `DTEND:${stamp(event.endDate || event.startDate, event.endTime || event.startTime)}`, `SUMMARY:${event.title}`, `LOCATION:${event.location}`, `DESCRIPTION:${event.description.replaceAll('\n', '\\n')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'); download(`${event.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-') || 'event'}.ics`, content, 'text/calendar') }
function download(filename: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }

export default App
