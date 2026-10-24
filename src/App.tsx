import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Check,
  Download,
  FileDown,
  MapPin,
  Plus,
  Search,
  Users,
  Bookmark,
  ArrowLeft,
  Clock,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import { AppShell } from './components/AppShell'
import { EventCard } from './components/EventCard'
import { EventForm } from './components/EventForm'
import { HappeningEventsView } from './components/discovery/HappeningEventsView'
import { SAMPLE_EVENTS } from './features/events/sampleEvents'
import type { GatherEvent } from './types/event'
import { EventProvider, useEvents, type EventRecord } from './features/events'
import { activeGuests, dateLabel, eventGuests, guestStatus } from './features/event-utils'
import {
  createHref,
  editHref,
  eventHref,
  getRoute,
  routeHref,
  type SectionId,
  type WorkspaceRoute,
} from './features/workspace'

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

function sampleToRecord(sample: GatherEvent): EventRecord {
  const start = new Date(sample.startDateTime)
  const end = sample.endDateTime ? new Date(sample.endDateTime) : null
  const day = (d: Date) => d.toLocaleDateString('en-CA')
  const clock = (d: Date) => d.toTimeString().slice(0, 5)
  return {
    id: sample.id,
    ownerId: 'sample-curator',
    title: sample.title,
    description: sample.description,
    startDate: isNaN(start.getTime()) ? '2026-11-08' : day(start),
    endDate: end && !isNaN(end.getTime()) ? day(end) : '',
    startTime: isNaN(start.getTime()) ? '10:00' : clock(start),
    endTime: end && !isNaN(end.getTime()) ? clock(end) : '',
    location: sample.venueName ? `${sample.venueName}, ${sample.address}` : sample.address,
    category: sample.category,
    capacity: 40,
    visibility: 'public',
    registration: 'open',
    status: 'published',
    imageUrl: sample.imageUrl || '/images/moonlit-studio.png',
    createdAt: new Date().toISOString(),
  }
}

function App() {
  return (
    <EventProvider>
      <GatherApp />
    </EventProvider>
  )
}

function GatherApp() {
  const [route, setRoute] = useState<WorkspaceRoute>(getRoute)
  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const label = route.eventId
    ? 'Event'
    : route.create
    ? 'Create event'
    : route.editId
    ? 'Edit event'
    : sectionCopy[route.mode][route.section].title

  useEffect(() => {
    document.title = `${label} · ${route.mode === 'user' ? 'City Guide' : 'Organizer'} · Gather`
  }, [label, route.mode])

  return (
    <AppShell route={route}>
      <RouteScreen route={route} />
    </AppShell>
  )
}

function RouteScreen({ route }: { route: WorkspaceRoute }) {
  const { events, createEvent, updateEvent } = useEvents()

  if (route.create) {
    return (
      <EventForm
        onSubmit={(input, status) => {
          void createEvent(input, status).then((id) => {
            window.location.hash = eventHref('organizer', id)
          })
        }}
      />
    )
  }

  if (route.editId) {
    const event = events.find((item) => item.id === route.editId)
    return event ? (
      <EventForm
        event={event}
        onSubmit={(input, status) => {
          void updateEvent(event.id, input, status).then(() => {
            window.location.hash = eventHref('organizer', event.id)
          })
        }}
      />
    ) : (
      <NotFound />
    )
  }

  if (route.eventId) {
    const liveEvent = events.find((item) => item.id === route.eventId)
    const sampleEvent = !liveEvent ? SAMPLE_EVENTS.find((item) => item.id === route.eventId) : null
    const event = liveEvent || (sampleEvent ? sampleToRecord(sampleEvent) : null)

    return event ? (
      <EventDetail event={event} mode={route.mode} isSample={Boolean(sampleEvent)} />
    ) : (
      <NotFound />
    )
  }

  return <Workspace route={route} />
}

function Workspace({ route }: { route: WorkspaceRoute }) {
  const copy = sectionCopy[route.mode][route.section]
  const isOrganizer = route.mode === 'organizer'
  const isDiscovery = route.section === 'happening-events' && route.mode === 'user'

  return (
    <section className="feature-section" aria-labelledby="section-title">
      {/* Hide generic section-heading on user discovery since HappeningEventsView has its own rich curated guide header */}
      {!isDiscovery && (
        <div className="section-heading with-action">
          <div>
            <h1 id="section-title">{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          {isOrganizer && route.section === 'my-events' && (
            <a className="button button-primary" href={createHref}>
              <Plus size={18} />
              <span>Create event</span>
            </a>
          )}
        </div>
      )}

      <DataNotice />
      {route.section === 'happening-events' ? <HappeningEvents mode={route.mode} /> : null}
      {route.section === 'my-events' ? <MyEvents mode={route.mode} /> : null}
      {route.section === 'calendar' ? <CalendarView mode={route.mode} /> : null}
    </section>
  )
}

function HappeningEvents({ mode }: { mode: 'user' | 'organizer' }) {
  const { events, guests, savedIds, toggleSaved, loading } = useEvents()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const published = events.filter((event) => event.status === 'published' && event.visibility === 'public')

  if (mode === 'user') {
    // Map live published events from Supabase
    const liveEvents: GatherEvent[] = published.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      category: e.category,
      startDateTime: `${e.startDate}T${e.startTime || '00:00'}:00`,
      endDateTime: e.endDate ? `${e.endDate}T${e.endTime || '00:00'}:00` : undefined,
      venueName: e.location || 'Location to be announced',
      address: e.location || 'Location to be announced',
      latitude: null,
      longitude: null,
      imageUrl: e.imageUrl || '/images/moonlit-studio.png',
      isSample: false,
    }))

    // If live events exist, combine with sample events; otherwise provide sample events
    const discoveryEvents = liveEvents.length ? [...liveEvents, ...SAMPLE_EVENTS] : SAMPLE_EVENTS

    return (
      <HappeningEventsView
        events={discoveryEvents}
        savedIds={savedIds}
        onToggleSave={toggleSaved}
        loading={loading}
      />
    )
  }

  // Organizer mode discovery screen
  const categories = ['All categories', ...Array.from(new Set(published.map((event) => event.category)))]
  const shown = published.filter(
    (event) =>
      `${event.title} ${event.description} ${event.location}`.toLowerCase().includes(query.toLowerCase()) &&
      (category === 'All categories' || event.category === category)
  )

  if (!events.length) {
    return (
      <EmptyPanel
        title="Your first event starts here."
        description="Create it once, publish when you are ready, and it will appear for attendees here."
        action="Create event"
        href={createHref}
      />
    )
  }

  if (!published.length) {
    return (
      <>
        <DiscoveryHero />
        <EmptyPanel
          title="Nothing is happening yet."
          description="Publish one of your drafts to make it discoverable."
          action="Go to My Events"
          href={routeHref({ mode, section: 'my-events' })}
        />
      </>
    )
  }

  const feature = shown[0]

  return (
    <div className="event-index">
      <DiscoveryHero event={feature} mode={mode} />
      <div className="discover-tools">
        <label className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, artists, or places"
          />
        </label>
        <select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      {shown.length ? (
        <div className="event-grid">
          {shown.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              mode={mode}
              saved={savedIds.includes(event.id)}
              guestCount={activeGuests(guests, event.id).length}
            />
          ))}
        </div>
      ) : (
        <EmptyPanel title="No matches yet." description="Try a different search or category." />
      )}
    </div>
  )
}

function MyEvents({ mode }: { mode: 'user' | 'organizer' }) {
  const { events, guests, savedIds, setStatus, userId, toggleSaved } = useEvents()

  if (mode === 'user') {
    const mine = events.filter((event) => savedIds.includes(event.id) || Boolean(guestStatus(guests, event.id, userId)))

    return mine.length ? (
      <div className="event-index">
        <div className="event-grid">
          {mine.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              mode="user"
              saved={savedIds.includes(event.id)}
              guestCount={activeGuests(guests, event.id).length}
              onSave={() => {
                void toggleSaved(event.id)
              }}
            />
          ))}
        </div>
      </div>
    ) : (
      <EmptyPanel
        title="Your plans will land here."
        description="Save a gathering or RSVP to keep it close on your list."
        href={routeHref({ mode, section: 'happening-events' })}
        action="Explore gatherings"
      />
    )
  }

  // Organizer mode list
  const mine = events.filter((event) => event.ownerId === userId)

  return mine.length ? (
    <div className="organizer-workspace-view">
      <div className="organizer-list-header">
        <span className="col-event">Event & Schedule</span>
        <span className="col-status">Status</span>
        <span className="col-actions">Actions</span>
      </div>
      <div className="organizer-list" role="feed" aria-label="Your organized events">
        {mine.map((event) => (
          <article key={event.id} className="organizer-row">
            <a href={eventHref('organizer', event.id)} className="organizer-row-main">
              <span className={`status-dot status-${event.status}`} aria-hidden="true" />
              <div className="organizer-row-info">
                <strong className="organizer-row-title">{event.title}</strong>
                <small className="organizer-row-meta">
                  {dateLabel(event.startDate, event.startTime)} · {event.location || 'Location TBA'}
                </small>
              </div>
            </a>
            <div className="organizer-row-badge">
              <span className={`status-pill status-${event.status}`}>{event.status}</span>
            </div>
            <div className="row-actions">
              {event.status === 'draft' && (
                <button
                  type="button"
                  className="button button-action-primary"
                  onClick={() => {
                    void setStatus(event.id, 'published')
                  }}
                >
                  Publish
                </button>
              )}
              {event.status === 'published' && (
                <button
                  type="button"
                  className="button button-action-danger"
                  onClick={() => {
                    void setStatus(event.id, 'cancelled')
                  }}
                >
                  Cancel
                </button>
              )}
              <a className="button button-action-secondary" href={editHref(event.id)}>
                Edit
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  ) : (
    <EmptyPanel
      title="There is room for the first one."
      description="Create a draft now, then decide when to publish it."
      action="Create event"
      href={createHref}
    />
  )
}

function CalendarView({ mode }: { mode: 'user' | 'organizer' }) {
  const { events, guests, savedIds, userId } = useEvents()

  const relevant = events.filter((event) =>
    mode === 'organizer'
      ? event.ownerId === userId && event.status !== 'cancelled'
      : event.status === 'published' && (savedIds.includes(event.id) || Boolean(guestStatus(guests, event.id, userId)))
  )

  const grouped = relevant
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .reduce<Record<string, EventRecord[]>>((all, event) => {
      ;(all[event.startDate] ??= []).push(event)
      return all
    }, {})

  return Object.keys(grouped).length ? (
    <div className="calendar-list">
      {Object.entries(grouped).map(([date, dayEvents]) => (
        <div className="calendar-day" key={date}>
          <time className="calendar-day-header">
            {new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' }).format(
              new Date(`${date}T12:00`)
            )}
          </time>
          <div className="calendar-events-group">
            {dayEvents.map((event) => (
              <a key={event.id} href={eventHref(mode, event.id)} className="calendar-event-card">
                <span className="cal-time">{event.startTime}</span>
                <div className="cal-body">
                  <strong className="cal-title">{event.title}</strong>
                  <small className="cal-location">{event.location}</small>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <EmptyPanel
      title="Your calendar is wide open."
      description={
        mode === 'user'
          ? 'Save or RSVP to an event and it will appear here.'
          : 'Your drafts and published events will appear here.'
      }
      href={mode === 'user' ? routeHref({ mode, section: 'happening-events' }) : createHref}
      action={mode === 'user' ? 'Explore events' : 'Create event'}
    />
  )
}

function EventDetail({
  event,
  mode,
  isSample = false,
}: {
  event: EventRecord
  mode: 'user' | 'organizer'
  isSample?: boolean
}) {
  const { guests, savedIds, toggleSaved, rsvp, setStatus, setGuestStatus, checkIn, userId } = useEvents()
  const [attendeeEmail, setAttendeeEmail] = useState('')
  const [rsvpFeedback, setRsvpFeedback] = useState<string | null>(null)

  const currentStatus = guestStatus(guests, event.id, userId)
  const attending = activeGuests(guests, event.id)
  const guestList = eventGuests(guests, event.id)
  const full = Boolean(event.capacity && attending.length >= event.capacity)
  const organizer = mode === 'organizer'
  const isSaved = savedIds.includes(event.id)

  const handleRsvpSubmit = async () => {
    if (isSample) {
      setRsvpFeedback('Thank you! This is a preview gathering. Real RSVPs are enabled on live events.')
      return
    }
    const targetStatus = event.registration === 'approval' ? 'requested' : 'going'
    try {
      await rsvp(event, targetStatus, attendeeEmail || undefined)
      setRsvpFeedback(
        targetStatus === 'going'
          ? 'Confirmed! You are on the attendee list.'
          : 'Request submitted to the organizer.'
      )
    } catch {
      setRsvpFeedback('We could not complete your RSVP. Please try again.')
    }
  }

  return (
    <section className="event-detail" aria-labelledby="event-title">
      {/* Editorial Back Navigation */}
      <div className="detail-navigation-bar">
        <a
          className="back-link"
          href={routeHref({ mode, section: organizer ? 'my-events' : 'happening-events' })}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{organizer ? 'Back to my events' : 'Back to gatherings'}</span>
        </a>

        {isSample && (
          <span className="detail-preview-badge">
            <Sparkles size={13} aria-hidden="true" />
            <span>Curated Preview Gathering</span>
          </span>
        )}
      </div>

      {/* Two-Column Editorial Layout */}
      <div className="detail-layout">
        {/* Left Column: Hero Cover, Story, and Good-to-know */}
        <div className="detail-main-column">
          <div className="detail-cover-card">
            <img
              src={event.imageUrl || '/images/moonlit-studio.png'}
              alt={event.title}
              className="detail-cover-img"
            />
            <div className="detail-cover-badge">
              <span className="badge-category">{event.category}</span>
            </div>
          </div>

          <div className="detail-header-block">
            <div className="detail-kicker-row">
              <span className="event-card-date">{dateLabel(event.startDate, event.startTime)}</span>
              {event.status !== 'published' && (
                <span className={`status-pill status-${event.status}`}>{event.status}</span>
              )}
            </div>

            <h1 id="event-title" className="detail-title">
              {event.title}
            </h1>

            {/* Event Key Facts near the top: Date, Location, Capacity, Registration Status */}
            <div className="detail-key-facts-strip" aria-label="Key event details">
              <div className="key-fact-item">
                <CalendarDays size={16} className="key-fact-icon" aria-hidden="true" />
                <div className="key-fact-content">
                  <span className="key-fact-label">Date &amp; Time</span>
                  <strong className="key-fact-value">{dateLabel(event.startDate, event.startTime)}</strong>
                </div>
              </div>

              <div className="key-fact-item">
                <MapPin size={16} className="key-fact-icon" aria-hidden="true" />
                <div className="key-fact-content">
                  <span className="key-fact-label">Location</span>
                  <strong className="key-fact-value">{event.location || 'Location TBA'}</strong>
                </div>
              </div>

              <div className="key-fact-item">
                <Users size={16} className="key-fact-icon" aria-hidden="true" />
                <div className="key-fact-content">
                  <span className="key-fact-label">Capacity</span>
                  <strong className="key-fact-value">
                    {attending.length}
                    {event.capacity ? ` / ${event.capacity}` : ''} going
                  </strong>
                </div>
              </div>

              <div className="key-fact-item">
                <ShieldCheck size={16} className="key-fact-icon" aria-hidden="true" />
                <div className="key-fact-content">
                  <span className="key-fact-label">Registration</span>
                  <strong className="key-fact-value">
                    {event.registration === 'approval'
                      ? 'Approval required'
                      : event.registration === 'closed'
                      ? 'Registration closed'
                      : 'Open RSVP'}
                  </strong>
                </div>
              </div>
            </div>

            <p className="detail-description">{event.description || 'This event is still taking shape.'}</p>
          </div>

          {/* Good to know facts */}
          <div className="detail-panel info-panel">
            <h2 className="panel-title">Good to know</h2>
            <dl className="editorial-meta-dl">
              <div className="meta-pair">
                <dt>When</dt>
                <dd>
                  {dateLabel(event.startDate, event.startTime)}
                  {event.endDate ? ` — ${dateLabel(event.endDate, event.endTime)}` : ''}
                </dd>
              </div>
              <div className="meta-pair">
                <dt>Where</dt>
                <dd>{event.location || 'Location to be announced'}</dd>
              </div>
              <div className="meta-pair">
                <dt>Access</dt>
                <dd>
                  {event.registration === 'approval'
                    ? 'Request to join (organizer approval)'
                    : event.registration === 'closed'
                    ? 'Registration closed'
                    : 'Open RSVP'}
                </dd>
              </div>
              <div className="meta-pair">
                <dt>Capacity</dt>
                <dd>{event.capacity ? `${event.capacity} total capacity` : 'Unlimited capacity'}</dd>
              </div>
              <div className="meta-pair">
                <dt>Visibility</dt>
                <dd>{event.visibility === 'public' ? 'Public gathering' : 'Private invitation'}</dd>
              </div>
            </dl>
          </div>

          {/* Organizer Guest Panel */}
          {organizer && (
            <GuestPanel
              event={event}
              guests={guestList}
              onApprove={(guestUserId) => {
                void setGuestStatus(event.id, guestUserId, 'going')
              }}
              onCheckIn={(eventId, guestUserId) => {
                void checkIn(eventId, guestUserId)
              }}
            />
          )}
        </div>

        {/* Right Column: Quick Action Box & Status */}
        <aside className="detail-action-sidebar" aria-label="Event actions and RSVP">
          <div className="quick-action-card">
            <h2 className="quick-action-heading">Event Details & RSVP</h2>

            <div className="quick-meta-list">
              <div className="quick-meta-item">
                <Clock size={16} className="quick-meta-icon" aria-hidden="true" />
                <div>
                  <strong>{dateLabel(event.startDate, event.startTime)}</strong>
                  <span>{event.startTime ? `Starts at ${event.startTime}` : 'Time TBA'}</span>
                </div>
              </div>

              <div className="quick-meta-item">
                <MapPin size={16} className="quick-meta-icon" aria-hidden="true" />
                <div>
                  <strong>{event.location || 'Location to be announced'}</strong>
                </div>
              </div>

              <div className="quick-meta-item">
                <Users size={16} className="quick-meta-icon" aria-hidden="true" />
                <div>
                  <strong>
                    {attending.length}
                    {event.capacity ? ` / ${event.capacity}` : ''} going
                  </strong>
                  <span>{full ? 'At full capacity' : 'Spots available'}</span>
                </div>
              </div>
            </div>

            {/* Organizer Actions */}
            {organizer ? (
              <div className="organizer-action-stack">
                <a className="button button-secondary" href={editHref(event.id)}>
                  Edit event
                </a>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => exportGuests(event, attending)}
                >
                  <FileDown size={17} aria-hidden="true" />
                  <span>Guest CSV</span>
                </button>
                {event.status === 'draft' && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      void setStatus(event.id, 'published')
                    }}
                  >
                    Publish gathering
                  </button>
                )}
                {event.status === 'published' && (
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => {
                      void setStatus(event.id, 'cancelled')
                    }}
                  >
                    Cancel gathering
                  </button>
                )}
              </div>
            ) : (
              /* Attendee Actions */
              <div className="attendee-action-stack">
                {/* RSVP Flow */}
                {event.status === 'published' && event.registration !== 'closed' && !full && !isSample ? (
                  <div className="rsvp-control-group">
                    {currentStatus !== 'going' && currentStatus !== 'requested' ? (
                      <>
                        <label htmlFor="rsvp-email" className="rsvp-input-label">
                          Email for updates (if available):
                        </label>
                        <input
                          id="rsvp-email"
                          type="email"
                          className="rsvp-email-input"
                          placeholder="Your email address"
                          value={attendeeEmail}
                          onChange={(e) => setAttendeeEmail(e.target.value)}
                          aria-label="Email for reminders"
                        />
                      </>
                    ) : null}

                    <button
                      type="button"
                      className="button button-primary rsvp-submit-btn"
                      onClick={() => {
                        void handleRsvpSubmit()
                      }}
                    >
                      {currentStatus === 'going' ? (
                        <>
                          <Check size={18} aria-hidden="true" />
                          <span>You’re going</span>
                        </>
                      ) : currentStatus === 'requested' ? (
                        <span>Request sent</span>
                      ) : event.registration === 'approval' ? (
                        <span>Request to join</span>
                      ) : (
                        <span>RSVP for this gathering</span>
                      )}
                    </button>

                    {rsvpFeedback && (
                      <p className="rsvp-feedback-msg" role="status">
                        {rsvpFeedback}
                      </p>
                    )}
                  </div>
                ) : isSample ? (
                  <div className="rsvp-closed-notice">
                    <p>This is a preview gathering. RSVP opens only for live events.</p>
                  </div>
                ) : full ? (
                  <div className="rsvp-closed-notice">
                    <p>This gathering is at full capacity.</p>
                  </div>
                ) : event.registration === 'closed' ? (
                  <div className="rsvp-closed-notice">
                    <p>Registration for this gathering is closed.</p>
                  </div>
                ) : null}

                {/* Save & Calendar buttons */}
                {!isSample && <div className="secondary-action-row">
                  <button
                    type="button"
                    className={`button button-secondary save-action-btn ${isSaved ? 'is-selected' : ''}`}
                    onClick={() => {
                      void toggleSaved(event.id)
                    }}
                    aria-label={isSaved ? 'Remove from saved' : 'Save event'}
                  >
                    <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                    <span>{isSaved ? 'Saved' : 'Save'}</span>
                  </button>

                  <button
                    type="button"
                    className="button button-secondary cal-download-btn"
                    onClick={() => downloadIcs(event)}
                    aria-label="Download calendar invite"
                  >
                    <Download size={17} aria-hidden="true" />
                    <span>Add to calendar</span>
                  </button>
                </div>}
              </div>
            )}

            {/* Attendee Status Card */}
            {!organizer && (
              <div className="attendee-status-box">
                <ShieldCheck size={16} className="status-box-icon" aria-hidden="true" />
                <p>
                  {currentStatus === 'going'
                    ? 'You are confirmed on the guest list. This gathering is in My Events and can be synced with your calendar.'
                    : currentStatus === 'requested'
                    ? 'Your request is with the organizer. It will remain in My Events while you await approval.'
                    : full
                    ? 'This event is currently at full capacity.'
                    : 'RSVP to reserve your place or save for later.'}
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile Sticky Bottom RSVP Action Bar */}
      {mode === 'user' && !isSample && event.status === 'published' && !full && event.registration !== 'closed' && (
        <div className="mobile-sticky-action-bar" aria-label="Mobile quick actions">
          <div className="mobile-action-summary">
            <span className="mobile-action-date">{dateLabel(event.startDate, event.startTime)}</span>
            <span className="mobile-action-title">{event.title}</span>
          </div>
          <button
            type="button"
            className="button button-primary mobile-rsvp-btn"
            onClick={() => {
              void handleRsvpSubmit()
            }}
          >
            {currentStatus === 'going' ? 'Going' : currentStatus === 'requested' ? 'Requested' : 'RSVP'}
          </button>
        </div>
      )}
    </section>
  )
}

function GuestPanel({
  event,
  guests,
  onApprove,
  onCheckIn,
}: {
  event: EventRecord
  guests: ReturnType<typeof activeGuests>
  onApprove: (userId: string) => void
  onCheckIn: (eventId: string, userId: string) => void
}) {
  return (
    <div className="detail-panel guest-panel">
      <div className="guest-panel-header">
        <h2 className="panel-title">Guest List</h2>
        <span className="guest-count-pill">{guests.length} RSVP{guests.length === 1 ? '' : 's'}</span>
      </div>
      {guests.length ? (
        <ul className="guest-list">
          {guests.map((guest) => (
            <li key={guest.userId} className="guest-item">
              <div className="guest-info">
                <strong className="guest-name">{guest.name}</strong>
                <small className="guest-status-text">
                  {guest.status === 'requested' ? 'Awaiting approval' : guest.checkedIn ? 'Checked in' : 'Going'}
                </small>
              </div>
              <div className="guest-actions">
                {guest.status === 'requested' ? (
                  <button type="button" className="text-button" onClick={() => onApprove(guest.userId)}>
                    Approve
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`text-button ${guest.checkedIn ? 'is-checked-in' : ''}`}
                    onClick={() => onCheckIn(event.id, guest.userId)}
                  >
                    {guest.checkedIn ? 'Undo check-in' : 'Check in'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-guest-hint">RSVPs and guest registrations will appear here.</p>
      )}
    </div>
  )
}

function DataNotice() {
  const { loading, issue } = useEvents()
  return loading ? (
    <div className="data-notice" role="status">
      <Sparkles size={15} className="spinner" aria-hidden="true" />
      <span>Preparing your private event space…</span>
    </div>
  ) : issue ? (
    <div className="data-notice is-warning" role="alert">
      <span>{issue}</span>
    </div>
  ) : null
}

function DiscoveryHero({ event, mode = 'user' }: { event?: EventRecord; mode?: 'user' | 'organizer' }) {
  const title = event?.title ?? 'Make a night of it.'
  return (
    <section className="discovery-hero">
      <img src={event?.imageUrl ?? '/images/moonlit-studio.png'} alt="" className="hero-bg-img" />
      <div className="hero-content">
        <span className="hero-kicker">Featured gathering</span>
        <h2 className="hero-title">{title}</h2>
        <span className="hero-meta">
          {event
            ? `${dateLabel(event.startDate, event.startTime)} · ${event.location}`
            : 'A little music, a little conversation, somewhere memorable.'}
        </span>
        {event && (
          <a className="button button-primary" href={eventHref(mode, event.id)}>
            See the event
          </a>
        )}
      </div>
    </section>
  )
}

function EmptyPanel({
  title,
  description,
  action,
  href,
}: {
  title: string
  description: string
  action?: string
  href?: string
}) {
  return (
    <div className="empty-panel" role="status">
      <div className="empty-icon">
        <CalendarDays size={48} strokeWidth={1.35} aria-hidden="true" />
      </div>
      <h2 className="empty-title">{title}</h2>
      <p className="empty-description">{description}</p>
      {action && href && (
        <a className="button button-primary" href={href}>
          <Plus size={16} aria-hidden="true" />
          <span>{action}</span>
        </a>
      )}
    </div>
  )
}

function NotFound() {
  return (
    <EmptyPanel
      title="This gathering is not here."
      description="It may have been removed or the link may have changed."
      href={routeHref({ mode: 'user', section: 'happening-events' })}
      action="Explore gatherings"
    />
  )
}

function downloadIcs(event: EventRecord) {
  const stamp = (date: string, time: string) => `${date.replaceAll('-', '')}T${time.replace(':', '')}00`
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `UID:${event.id}@gather`,
    `DTSTART:${stamp(event.startDate, event.startTime)}`,
    `DTEND:${stamp(event.endDate || event.startDate, event.endTime || event.startTime)}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.location}`,
    `DESCRIPTION:${event.description.replaceAll('\n', '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  download(`${event.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-') || 'event'}.ics`, content, 'text/calendar')
}

function exportGuests(event: EventRecord, guests: ReturnType<typeof activeGuests>) {
  const csv = [
    'name,status,checked_in',
    ...guests.map((guest) => `${guest.name},${guest.status},${guest.checkedIn ? 'yes' : 'no'}`),
  ].join('\n')
  download(`${event.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-') || 'event'}-guests.csv`, csv, 'text/csv')
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default App
