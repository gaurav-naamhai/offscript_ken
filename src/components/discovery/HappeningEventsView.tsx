import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, Compass, List, Map, MapPin, Navigation, Search, SlidersHorizontal } from 'lucide-react'
import type { GatherEvent, ActiveLocation } from '../../types/event'
import { filterUpcomingEventsByRadius } from '../../features/events/eventFilter'
import { useGeolocation } from '../../features/location/useGeolocation'
import { LocationFilterBar } from './LocationFilterBar'
import { EventCard } from './EventCard'
import { DiscoveryMap } from './DiscoveryMap'

interface HappeningEventsViewProps {
  events: GatherEvent[]
}

export function HappeningEventsView({ events }: HappeningEventsViewProps) {
  const [showLocationPrompt, setShowLocationPrompt] = useState(true)
  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(null)
  const [radiusKm, setRadiusKm] = useState(10)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All events')
  const { gpsLocation, status: gpsStatus, errorMessage: gpsErrorMessage, requestGps } = useGeolocation()

  const handleNearMe = async () => {
    const coords = gpsLocation ?? await requestGps()
    if (coords) setActiveLocation({ name: 'My location', coordinates: coords, isGps: true })
  }
  const askForLocation = () => {
    setShowLocationPrompt(false)
    setShowFilters(true)
    void handleNearMe()
  }
  const clearLocation = () => setActiveLocation(null)
  const categories = useMemo(() => ['All events', ...new Set(events.map((event) => event.category))], [events])
  const filteredEvents = useMemo(() => {
    const byDistance = filterUpcomingEventsByRadius(events, {
      center: activeLocation?.coordinates ?? null,
      radiusKm: activeLocation ? radiusKm : null,
    })
    return byDistance.filter((event) =>
      (category === 'All events' || event.category === category) &&
      `${event.title} ${event.description} ${event.venueName} ${event.category}`.toLowerCase().includes(query.trim().toLowerCase()),
    )
  }, [events, activeLocation, radiusKm, category, query])

  useEffect(() => {
    if (selectedEventId && !filteredEvents.some((event) => event.id === selectedEventId)) setSelectedEventId(null)
  }, [filteredEvents, selectedEventId])

  return (
    <div className="discovery-section builder-discovery">
      <section className="builder-hero" aria-labelledby="builder-hero-title">
        <img className="builder-hero-image" src="/images/gather-hackathon-hero.png" alt="Mumbai builders working together at a daylight hackathon" fetchPriority="high" />
        <div className="builder-hero-shade" />
        <div className="builder-hero-copy">
          <h1 id="builder-hero-title">Mumbai,<br />in <em>build mode.</em></h1>
          <p>Find your people. Ship something together.</p>
          <a className="builder-hero-link" href="#gather-club-events">Explore this week <ArrowDown size={17} aria-hidden="true" /></a>
        </div>
        <span className="builder-hero-caption">A community for builders in Mumbai</span>
      </section>

      <section className="builder-events" id="gather-club-events" aria-labelledby="builder-events-title">
        <header className="builder-events-heading">
          <div>
            <p className="builder-section-kicker">Real people. Real projects. A stronger Mumbai.</p>
            <h2 id="builder-events-title">Coming together this week</h2>
          </div>
          <div className="builder-heading-actions">
            <button className={`builder-map-toggle ${showFilters ? 'is-active' : ''}`} type="button" aria-expanded={showFilters} onClick={() => setShowFilters((value) => !value)}>
              <SlidersHorizontal size={15} aria-hidden="true" />{showFilters ? 'Close filters' : 'Search & filters'}
            </button>
            <button className={`builder-map-toggle ${showMap ? 'is-active' : ''}`} type="button" aria-pressed={showMap} onClick={() => setShowMap((value) => !value)}>
              {showMap ? <List size={16} aria-hidden="true" /> : <Map size={16} aria-hidden="true" />}
              {showMap ? 'Back to events' : 'Explore the map'}
            </button>
          </div>
        </header>

        {showLocationPrompt && !activeLocation ? <aside className="builder-location-prompt"><MapPin size={19} aria-hidden="true" /><div><strong>Find gatherings near you</strong><span>Share your location to put nearby events first. You can still browse other places.</span></div><button type="button" onClick={askForLocation}><Navigation size={15} aria-hidden="true" />Use my location</button><button className="builder-location-dismiss" type="button" onClick={() => setShowLocationPrompt(false)}>Not now</button></aside> : null}

        {showFilters ? <div className="builder-tools">
          <label className="builder-search"><Search size={17} aria-hidden="true" /><span className="visually-hidden">Search events</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, ideas, places" /></label>
          <LocationFilterBar activeLocation={activeLocation} onSelectLocation={setActiveLocation} onClearLocation={clearLocation} gpsStatus={gpsStatus} gpsErrorMessage={gpsErrorMessage} onNearMeClick={() => { void handleNearMe() }} radiusKm={radiusKm} onChangeRadius={setRadiusKm} />
        </div> : null}

        <nav className="builder-categories" aria-label="Filter events by type">
          {categories.map((item) => <button key={item} type="button" className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
        </nav>

        {filteredEvents.length > 0 ? <p className="builder-results-count">{filteredEvents.length} upcoming {filteredEvents.length === 1 ? 'event' : 'events'} around Mumbai</p> : <div className="builder-no-events"><Compass size={25} /><p>No events match this search. Try another topic or clear your filters.</p><button type="button" onClick={() => { setCategory('All events'); setQuery(''); clearLocation() }}>Show all events</button></div>}

        <div className={`builder-event-layout ${showMap ? 'show-map' : ''}`}>
          <div className="builder-event-grid" role="feed" aria-label="Upcoming tech and startup events">
            {filteredEvents.map((event) => <EventCard key={event.id} event={event} isSelected={selectedEventId === event.id} onClick={() => setSelectedEventId(event.id)} />)}
          </div>
          {showMap ? <div className="discovery-map-column builder-map-column"><DiscoveryMap events={filteredEvents} activeLocation={activeLocation} radiusKm={radiusKm} selectedEventId={selectedEventId} onSelectEvent={setSelectedEventId} /></div> : null}
        </div>
      </section>
    </div>
  )
}
