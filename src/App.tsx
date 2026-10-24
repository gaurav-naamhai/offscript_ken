import { useEffect, useState } from 'react'
import { CalendarDays, Check, Download, FileDown, MapPin, Plus, Search, Users } from 'lucide-react'
import { AppShell } from './components/AppShell'
import { EventCard } from './components/EventCard'
import { EventForm } from './components/EventForm'
import { EventProvider, useEvents, type EventRecord } from './features/events'
import { activeGuests, dateLabel, eventGuests, guestStatus } from './features/event-utils'
import { createHref, editHref, eventHref, getRoute, routeHref, type SectionId, type WorkspaceRoute } from './features/workspace'

const sectionCopy: Record<'user' | 'organizer', Record<SectionId, { title: string; subtitle: string }>> = {
  user: {
    'happening-events': { title: 'Happening Events', subtitle: 'Find your next good thing.' },
    'my-events': { title: 'My Events', subtitle: 'The plans you are keeping close.' },
    calendar: { title: 'Calendar', subtitle: 'Make space for what matters.' },
  },
  organizer: {
    'happening-events': { title: 'Happening Events', subtitle: 'A view of what is out in the world.' },
    'my-events': { title: 'My Events', subtitle: 'From first idea to getting together.' },
    calendar: { title: 'Calendar', subtitle: 'Give your gatherings a place to grow.' },
  },
}

function App() {
  return <EventProvider><GatherApp /></EventProvider>
}

function GatherApp() {
  const [route, setRoute] = useState<WorkspaceRoute>(getRoute)
  useEffect(() => { const onHashChange = () => setRoute(getRoute()); window.addEventListener('hashchange', onHashChange); return () => window.removeEventListener('hashchange', onHashChange) }, [])
  const label = route.eventId ? 'Event' : route.create ? 'Create event' : route.editId ? 'Edit event' : sectionCopy[route.mode][route.section].title
  useEffect(() => { document.title = `${label} · ${route.mode === 'user' ? 'User' : 'Organizer'} · Gather` }, [label, route.mode])
  return <AppShell route={route}><RouteScreen route={route} /></AppShell>
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
    <div className="section-heading with-action"><div><h1 id="section-title">{copy.title}</h1><p>{copy.subtitle}</p></div>{route.mode === 'organizer' && route.section === 'my-events' ? <a className="button button-primary" href={createHref}><Plus size={18} />Create event</a> : null}</div>
    <DataNotice />
    {route.section === 'happening-events' ? <HappeningEvents mode={route.mode} /> : null}
    {route.section === 'my-events' ? <MyEvents mode={route.mode} /> : null}
    {route.section === 'calendar' ? <CalendarView mode={route.mode} /> : null}
  </section>
}

function HappeningEvents({ mode }: { mode: 'user' | 'organizer' }) {
  const { events, guests, savedIds, toggleSaved } = useEvents()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const published = events.filter((event) => event.status === 'published' && event.visibility === 'public')
  const categories = ['All categories', ...Array.from(new Set(published.map((event) => event.category)))]
  const shown = published.filter((event) => `${event.title} ${event.description} ${event.location}`.toLowerCase().includes(query.toLowerCase()) && (category === 'All categories' || event.category === category))
  if (!events.length && mode === 'organizer') return <EmptyPanel title="Your first event starts here." description="Create it once, publish when you are ready, and it will appear for attendees here." action="Create event" href={createHref} />
  if (!published.length) return <><DiscoveryHero /><EmptyPanel title="Nothing is happening yet." description={mode === 'user' ? 'Come back once an organizer publishes an event.' : 'Publish one of your drafts to make it discoverable.'} action={mode === 'organizer' ? 'Go to My Events' : undefined} href={mode === 'organizer' ? routeHref({ mode, section: 'my-events' }) : undefined} /></>
  const feature = shown[0]
  return <div className="event-index"><DiscoveryHero event={feature} mode={mode} /><div className="discover-tools"><label className="search-field"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events, artists, or places" /></label><select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>{shown.length ? <div className="event-grid">{shown.map((event) => <EventCard key={event.id} event={event} mode={mode} saved={savedIds.includes(event.id)} guestCount={activeGuests(guests, event.id).length} onSave={mode === 'user' ? () => { void toggleSaved(event.id) } : undefined} />)}</div> : <EmptyPanel title="No matches yet." description="Try a different search or category." />}</div>
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
  const { guests, savedIds, toggleSaved, rsvp, setStatus, setGuestStatus, checkIn, userId } = useEvents()
  const [attendeeEmail, setAttendeeEmail] = useState('')
  const currentStatus = guestStatus(guests, event.id, userId)
  const attending = activeGuests(guests, event.id)
  const guestList = eventGuests(guests, event.id)
  const full = Boolean(event.capacity && attending.length >= event.capacity)
  const organizer = mode === 'organizer'
  return <section className="event-detail"><a className="back-link" href={routeHref({ mode, section: organizer ? 'my-events' : 'happening-events' })}>← Back</a><div className="detail-cover"><img src={event.imageUrl} alt="" /></div><div className="detail-hero"><div><p className="event-card-date">{dateLabel(event.startDate, event.startTime)}</p><h1>{event.title}</h1><p className="detail-description">{event.description || 'This event is still taking shape.'}</p><div className="detail-meta"><span><MapPin size={18} />{event.location}</span><span><Users size={18} />{attending.length}{event.capacity ? ` / ${event.capacity}` : ''} going</span><span><CalendarDays size={18} />{event.category}</span></div></div><div className="detail-actions">{organizer ? <><a className="button button-secondary" href={editHref(event.id)}>Edit event</a><button className="button button-secondary" onClick={() => exportGuests(event, attending)}> <FileDown size={18} />Guest CSV</button>{event.status === 'draft' ? <button className="button button-primary" onClick={() => { void setStatus(event.id, 'published') }}>Publish</button> : event.status === 'published' ? <button className="button button-danger" onClick={() => { void setStatus(event.id, 'cancelled') }}>Cancel event</button> : null}</> : <><button className={`button button-secondary ${savedIds.includes(event.id) ? 'is-selected' : ''}`} onClick={() => { void toggleSaved(event.id) }}>{savedIds.includes(event.id) ? 'Saved' : 'Save event'}</button><button className="button button-secondary" onClick={() => downloadIcs(event)}><Download size={18} />Add to calendar</button>{event.status === 'published' && event.registration !== 'closed' && !full ? <div className="rsvp-control-group">{currentStatus !== 'going' && currentStatus !== 'requested' ? <input type="email" className="rsvp-email-input" placeholder="Email for reminders" value={attendeeEmail} onChange={(e) => setAttendeeEmail(e.target.value)} aria-label="Email for reminders" /> : null}<button className="button button-primary" onClick={() => { void rsvp(event, event.registration === 'approval' ? 'requested' : 'going', attendeeEmail || undefined) }}>{currentStatus === 'going' ? <><Check size={18} />You’re going</> : currentStatus === 'requested' ? 'Request sent' : event.registration === 'approval' ? 'Request to join' : 'RSVP'}</button></div> : null}</>}</div></div>
    <div className="detail-columns"><div className="detail-panel"><h2>Good to know</h2><dl><div><dt>When</dt><dd>{dateLabel(event.startDate, event.startTime)}{event.endDate ? ` — ${dateLabel(event.endDate, event.endTime)}` : ''}</dd></div><div><dt>Access</dt><dd>{event.registration === 'approval' ? 'Request to join' : event.registration === 'closed' ? 'Registration closed' : 'Open RSVP'}</dd></div><div><dt>Visibility</dt><dd>{event.visibility === 'public' ? 'Public event' : 'Private event'}</dd></div></dl></div>{organizer ? <GuestPanel event={event} guests={guestList} onApprove={(guestUserId) => { void setGuestStatus(event.id, guestUserId, 'going') }} onCheckIn={(eventId, guestUserId) => { void checkIn(eventId, guestUserId) }} /> : <div className="detail-panel"><h2>Your place</h2><p>{currentStatus === 'going' ? 'You are on the list. We will keep this event in My Events and your calendar.' : currentStatus === 'requested' ? 'Your request is with the organizer. It will remain in My Events while you wait.' : full ? 'This event is at capacity.' : 'Save it for later or RSVP when you are ready.'}</p></div>}</div>
  </section>
}

function GuestPanel({ event, guests, onApprove, onCheckIn }: { event: EventRecord; guests: ReturnType<typeof activeGuests>; onApprove: (userId: string) => void; onCheckIn: (eventId: string, userId: string) => void }) {
  return <div className="detail-panel guest-panel"><h2>Guests <span>{guests.length}</span></h2>{guests.length ? <ul>{guests.map((guest) => <li key={guest.userId}><div><strong>{guest.name}</strong><small>{guest.status === 'requested' ? 'Awaiting approval' : guest.checkedIn ? 'Checked in' : 'Going'}</small></div>{guest.status === 'requested' ? <button className="text-button" onClick={() => onApprove(guest.userId)}>Approve</button> : <button className="text-button" onClick={() => onCheckIn(event.id, guest.userId)}>{guest.checkedIn ? 'Undo' : 'Check in'}</button>}</li>)}</ul> : <p>RSVPs will appear here.</p>}</div>
}

function DataNotice() { const { loading, issue } = useEvents(); return loading ? <p className="data-notice">Preparing your private event space…</p> : issue ? <p className="data-notice is-warning">{issue}</p> : null }
function DiscoveryHero({ event, mode = 'user' }: { event?: EventRecord; mode?: 'user' | 'organizer' }) { const title = event?.title ?? 'Make a night of it.'; return <section className="discovery-hero"><img src={event?.imageUrl ?? '/images/moonlit-studio.png'} alt="" /><div><p>Featured gathering</p><h2>{title}</h2><span>{event ? `${dateLabel(event.startDate, event.startTime)} · ${event.location}` : 'A little music, a little conversation, somewhere memorable.'}</span>{event ? <a className="button button-primary" href={eventHref(mode, event.id)}>See the event</a> : null}</div></section> }

function EmptyPanel({ title, description, action, href }: { title: string; description: string; action?: string; href?: string }) { return <div className="empty-panel"><div className="empty-icon"><CalendarDays size={52} /></div><h2>{title}</h2><p>{description}</p>{action && href ? <a className="button button-primary" href={href}><Plus size={18} />{action}</a> : null}</div> }
function NotFound() { return <EmptyPanel title="This event is not here." description="It may have been removed from this browser." href={routeHref({ mode: 'user', section: 'happening-events' })} action="Explore events" /> }

function downloadIcs(event: EventRecord) { const stamp = (date: string, time: string) => `${date.replaceAll('-', '')}T${time.replace(':', '')}00`; const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `UID:${event.id}@gather`, `DTSTART:${stamp(event.startDate, event.startTime)}`, `DTEND:${stamp(event.endDate || event.startDate, event.endTime || event.startTime)}`, `SUMMARY:${event.title}`, `LOCATION:${event.location}`, `DESCRIPTION:${event.description.replaceAll('\n', '\\n')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'); download(`${event.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-') || 'event'}.ics`, content, 'text/calendar') }
function exportGuests(event: EventRecord, guests: ReturnType<typeof activeGuests>) { const csv = ['name,status,checked_in', ...guests.map((guest) => `${guest.name},${guest.status},${guest.checkedIn ? 'yes' : 'no'}`)].join('\n'); download(`${event.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-') || 'event'}-guests.csv`, csv, 'text/csv') }
function download(filename: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }

export default App
