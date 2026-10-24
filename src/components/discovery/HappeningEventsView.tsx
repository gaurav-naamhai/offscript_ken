import { useState, useMemo } from 'react'
import { Compass, Sparkles, List, Map } from 'lucide-react'
import type { Section } from '../../features/workspace'
import type { ActiveLocation, GatherEvent } from '../../types/event'
import { SAMPLE_EVENTS } from '../../features/events/sampleEvents'
import { filterUpcomingEventsByRadius } from '../../features/events/eventFilter'
import { useGeolocation } from '../../features/location/useGeolocation'
import { LocationFilterBar } from './LocationFilterBar'
import { EventCard } from './EventCard'
import { DiscoveryMap } from './DiscoveryMap'

interface HappeningEventsViewProps {
  section?: Section | { label: string; subtitle?: string }
  /**
   * Pluggable events list. Defaults to SAMPLE_EVENTS for development,
   * but ready to accept live events from the team's event creation or backend system.
   */
  events?: GatherEvent[]
}

export function HappeningEventsView({
  section,
  events = SAMPLE_EVENTS,
}: HappeningEventsViewProps) {
  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(null)
  const [radiusKm, setRadiusKm] = useState<number>(10)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')

  const { gpsLocation, status: gpsStatus, errorMessage: gpsErrorMessage, requestGps } =
    useGeolocation()

  // Handle "Near me" click
  const handleNearMeClick = async () => {
    // If we already have stored GPS coordinates, restore them directly
    if (gpsLocation) {
      setActiveLocation({
        name: 'My GPS Location',
        coordinates: gpsLocation,
        isGps: true,
      })
      return
    }

    // Otherwise, request fresh GPS from browser Geolocation API
    const coords = await requestGps()
    if (coords) {
      setActiveLocation({
        name: 'My GPS Location',
        coordinates: coords,
        isGps: true,
      })
    }
  }

  // Handle manual location selection (never overwrites gpsLocation)
  const handleSelectLocation = (location: ActiveLocation) => {
    setActiveLocation(location)
  }

  const handleClearLocation = () => {
    setActiveLocation(null)
  }

  // Filter events according to active location and selected radius
  const filteredEvents = useMemo(() => {
    return filterUpcomingEventsByRadius(events, {
      center: activeLocation ? activeLocation.coordinates : null,
      radiusKm: activeLocation ? radiusKm : null,
    })
  }, [events, activeLocation, radiusKm])

  const sectionContent = (
    <>
      {/* Location Filter & Search Controls */}
      <div className="discovery-header-controls">
        <LocationFilterBar
          activeLocation={activeLocation}
          onSelectLocation={handleSelectLocation}
          onClearLocation={handleClearLocation}
          gpsStatus={gpsStatus}
          gpsErrorMessage={gpsErrorMessage}
          onNearMeClick={handleNearMeClick}
          radiusKm={radiusKm}
          onChangeRadius={setRadiusKm}
        />

        {/* Mobile View Toggle Bar */}
        <div className="mobile-view-toggle-bar" role="tablist" aria-label="Switch between list and map views">
          <button
            type="button"
            className={`view-toggle-pill ${mobileView === 'list' ? 'is-active' : ''}`}
            onClick={() => setMobileView('list')}
            role="tab"
            aria-selected={mobileView === 'list'}
          >
            <List size={15} aria-hidden="true" />
            <span>List</span>
          </button>
          <button
            type="button"
            className={`view-toggle-pill ${mobileView === 'map' ? 'is-active' : ''}`}
            onClick={() => setMobileView('map')}
            role="tab"
            aria-selected={mobileView === 'map'}
          >
            <Map size={15} aria-hidden="true" />
            <span>Map</span>
          </button>
        </div>
      </div>

      {/* Main Split Content Area */}
      <div className={`discovery-split-layout show-mobile-${mobileView}`}>
        {/* Left Column: Events List / Empty State */}
        <div className="discovery-list-column">
          {filteredEvents.length > 0 ? (
            <div className="discovery-grid-wrapper">
              <div className="discovery-results-meta">
                <span className="results-count">
                  {filteredEvents.length} {filteredEvents.length === 1 ? 'gathering' : 'gatherings'} found
                </span>
                {!activeLocation && (
                  <span className="unfiltered-hint">
                    <Sparkles size={14} aria-hidden="true" />
                    Select a location or click &ldquo;Near me&rdquo; to sort by distance.
                  </span>
                )}
              </div>

              <div className="events-grid" role="feed" aria-label="Upcoming events">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isSelected={selectedEventId === event.id}
                    onClick={() => setSelectedEventId(event.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Empty State when no events are within radius */
            <div className="empty-state discovery-empty-state" role="status">
              <div className="empty-icon">
                <Compass size={54} strokeWidth={1.35} aria-hidden="true" />
              </div>
              <h2>
                {activeLocation?.isGps
                  ? `No gatherings found within ${radiusKm} km of your location`
                  : `No gatherings found within ${radiusKm} km`}
              </h2>
              <p>
                {activeLocation?.isGps
                  ? `There are no upcoming events listed within ${radiusKm} km of your current GPS position. Initial test events are situated across the Mumbai and Maharashtra region.`
                  : `There are no upcoming events listed within ${radiusKm} km of ${activeLocation?.name || 'this location'}. Try increasing the search radius or exploring another area.`}
              </p>
              <div className="empty-state-actions">
                {radiusKm < 500 && (
                  <button
                    type="button"
                    className="discovery-action-button"
                    onClick={() => {
                      const nextRadius =
                        radiusKm < 25
                          ? 25
                          : radiusKm < 50
                          ? 50
                          : radiusKm < 100
                          ? 100
                          : radiusKm < 250
                          ? 250
                          : Math.min(radiusKm + 50, 500)
                      setRadiusKm(nextRadius)
                    }}
                  >
                    Expand radius to{' '}
                    {radiusKm < 25
                      ? 25
                      : radiusKm < 50
                      ? 50
                      : radiusKm < 100
                      ? 100
                      : radiusKm < 250
                      ? 250
                      : Math.min(radiusKm + 50, 500)}{' '}
                    km
                  </button>
                )}
                <button
                  type="button"
                  className="discovery-secondary-button"
                  onClick={handleClearLocation}
                >
                  View all gatherings
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Map */}
        <div className="discovery-map-column">
          <DiscoveryMap
            events={filteredEvents}
            activeLocation={activeLocation}
            radiusKm={radiusKm}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />
        </div>
      </div>
    </>
  )

  if (section) {
    const label = 'label' in section ? section.label : ''
    const subtitle = 'subtitle' in section && typeof section.subtitle === 'string' ? section.subtitle : undefined
    return (
      <section className="feature-section discovery-section" aria-labelledby="section-title">
        <div className="section-heading">
          <h1 id="section-title">{label}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {sectionContent}
      </section>
    )
  }

  return <div className="discovery-section">{sectionContent}</div>
}

