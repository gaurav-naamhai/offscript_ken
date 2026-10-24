import { useState, useMemo } from 'react'
import {
  Compass,
  Sparkles,
  List,
  Map,
  Search,
  X,
  Columns,
  Grid3X3,
  Calendar,
  Filter,
} from 'lucide-react'
import type { Section } from '../../features/workspace'
import type { ActiveLocation, GatherEvent } from '../../types/event'
import { SAMPLE_EVENTS } from '../../features/events/sampleEvents'
import { filterUpcomingEventsByRadius } from '../../features/events/eventFilter'
import { useGeolocation } from '../../features/location/useGeolocation'
import { LocationFilterBar, RadiusSelector } from './LocationFilterBar'
import { EventCard } from './EventCard'
import { DiscoveryMap } from './DiscoveryMap'

type DateFilterKey = 'all' | 'today' | 'weekend' | 'week'
type ViewMode = 'split' | 'grid' | 'map'

interface HappeningEventsViewProps {
  section?: Section | { label: string; subtitle?: string }
  /**
   * Pluggable events list.
   */
  events?: GatherEvent[]
  savedIds?: string[]
  onToggleSave?: (id: string) => void
  loading?: boolean
}

function matchesDateFilter(isoString: string, filter: DateFilterKey): boolean {
  if (filter === 'all') return true
  try {
    const eventDate = new Date(isoString)
    if (isNaN(eventDate.getTime())) return true
    const now = new Date()

    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffMs = eventDay.getTime() - today.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (filter === 'today') {
      return diffDays === 0
    }
    if (filter === 'week') {
      return diffDays >= 0 && diffDays <= 7
    }
    if (filter === 'weekend') {
      const currentDayOfWeek = now.getDay() // 0=Sun, 6=Sat
      const daysUntilSat = (6 - currentDayOfWeek + 7) % 7
      const daysUntilSun = (7 - currentDayOfWeek + 7) % 7
      return (
        diffDays === daysUntilSat ||
        diffDays === daysUntilSun ||
        (diffDays >= 0 && diffDays <= 2 && (currentDayOfWeek === 0 || currentDayOfWeek === 6))
      )
    }
    return true
  } catch {
    return true
  }
}

export function HappeningEventsView({
  section,
  events = SAMPLE_EVENTS,
  savedIds = [],
  onToggleSave,
  loading = false,
}: HappeningEventsViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All categories')
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('all')
  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(null)
  const [radiusKm, setRadiusKm] = useState<number>(10)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  const [showSampleEvents, setShowSampleEvents] = useState(true)

  const { gpsLocation, status: gpsStatus, errorMessage: gpsErrorMessage, requestGps } =
    useGeolocation()

  // Handle "Near me" click
  const handleNearMeClick = async () => {
    if (gpsLocation) {
      setActiveLocation({
        name: 'My GPS Location',
        coordinates: gpsLocation,
        isGps: true,
      })
      return
    }

    const coords = await requestGps()
    if (coords) {
      setActiveLocation({
        name: 'My GPS Location',
        coordinates: coords,
        isGps: true,
      })
    }
  }

  const handleSelectLocation = (location: ActiveLocation) => {
    setActiveLocation(location)
  }

  const handleClearLocation = () => {
    setActiveLocation(null)
  }

  // Derive all unique categories present in events
  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    events.forEach((e) => {
      if (e.category) set.add(e.category)
    })
    return ['All categories', ...Array.from(set).sort()]
  }, [events])

  // Count live vs sample events
  const hasLiveEvents = useMemo(() => events.some((e) => !e.isSample), [events])
  const hasSampleEvents = useMemo(() => events.some((e) => Boolean(e.isSample)), [events])

  // Base list depending on sample events toggle
  const baseEvents = useMemo(() => {
    if (!showSampleEvents && hasLiveEvents) {
      return events.filter((e) => !e.isSample)
    }
    return events
  }, [events, showSampleEvents, hasLiveEvents])

  // 1. Haversine & radius filtering
  const distanceFiltered = useMemo(() => {
    return filterUpcomingEventsByRadius(baseEvents, {
      center: activeLocation ? activeLocation.coordinates : null,
      radiusKm: activeLocation ? radiusKm : null,
      includePastEvents: false,
    })
  }, [baseEvents, activeLocation, radiusKm])

  // 2. Keyword, date, and category filtering
  const fullyFilteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return distanceFiltered.filter((event) => {
      // Keyword match (title, description, venue, address, organizer, category)
      if (q) {
        const matchesQ =
          event.title.toLowerCase().includes(q) ||
          event.description.toLowerCase().includes(q) ||
          event.venueName.toLowerCase().includes(q) ||
          event.address.toLowerCase().includes(q) ||
          event.category.toLowerCase().includes(q) ||
          (event.organizerName ? event.organizerName.toLowerCase().includes(q) : false)
        if (!matchesQ) return false
      }

      // Category match
      if (selectedCategory !== 'All categories' && event.category !== selectedCategory) {
        return false
      }

      // Date match
      if (!matchesDateFilter(event.startDateTime, dateFilter)) {
        return false
      }

      return true
    })
  }, [distanceFiltered, searchQuery, selectedCategory, dateFilter])

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedCategory !== 'All categories' ||
    dateFilter !== 'all' ||
    activeLocation !== null

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedCategory('All categories')
    setDateFilter('all')
    setActiveLocation(null)
  }

  const sectionContent = (
    <div className="city-guide-container">
      {/* Editorial Guide Header */}
      <header className="city-guide-header">
        <div className="guide-hero-content">
          <span className="guide-kicker">Curated City Guide · Mumbai & Beyond</span>
          <h1 className="guide-title">Gatherings worth stepping out for</h1>
          <p className="guide-subtitle">
            Intimate acoustic sets, single-origin tastings, open-air design walks, and community salons.
          </p>
        </div>

        {/* Live vs Preview sample banner if applicable */}
        {hasSampleEvents && (
          <div className="sample-indicator-banner" role="status">
            <Sparkles size={16} className="sparkle-icon" aria-hidden="true" />
            <div className="sample-indicator-text">
              <strong>Curated Preview Mode</strong>
              <span>
                {hasLiveEvents
                  ? 'Showing live published events alongside curated cultural previews.'
                  : 'Displaying curated gatherings across Mumbai & Maharashtra for demonstration. As organizers publish live events, they will appear here.'}
              </span>
            </div>
            {hasLiveEvents && (
              <button
                type="button"
                className="sample-toggle-pill"
                onClick={() => setShowSampleEvents(!showSampleEvents)}
              >
                {showSampleEvents ? 'Hide preview samples' : 'Show preview samples'}
              </button>
            )}
          </div>
        )}
      </header>

      {/* Prominent Search and Location Filter Bar */}
      <div className="discovery-header-controls">
        <div className="city-search-row">
          {/* Keyword Search */}
          <div className="event-keyword-search">
            <Search className="search-icon" size={18} aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search gatherings, music, artists, or venues..."
              className="keyword-input"
              aria-label="Search events by keyword, artist, or venue"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear keyword search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Location Autocomplete & Quick Location */}
          <LocationFilterBar
            activeLocation={activeLocation}
            onSelectLocation={handleSelectLocation}
            onClearLocation={handleClearLocation}
            gpsStatus={gpsStatus}
            gpsErrorMessage={gpsErrorMessage}
            onNearMeClick={handleNearMeClick}
            radiusKm={radiusKm}
            onChangeRadius={setRadiusKm}
            showRadius={false}
          />
        </div>

        {/* Secondary Filter Row: Date Pills, Category Pills, Radius, View Switcher */}
        <div className="filter-pills-row">
          {/* Date Filter Pills */}
          <div className="date-filter-group" role="radiogroup" aria-label="Date filter">
            <span className="filter-group-label">
              <Calendar size={13} aria-hidden="true" />
              <span>When:</span>
            </span>
            <button
              type="button"
              className={`filter-pill ${dateFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setDateFilter('all')}
              role="radio"
              aria-checked={dateFilter === 'all'}
            >
              All dates
            </button>
            <button
              type="button"
              className={`filter-pill ${dateFilter === 'today' ? 'is-active' : ''}`}
              onClick={() => setDateFilter('today')}
              role="radio"
              aria-checked={dateFilter === 'today'}
            >
              Today
            </button>
            <button
              type="button"
              className={`filter-pill ${dateFilter === 'weekend' ? 'is-active' : ''}`}
              onClick={() => setDateFilter('weekend')}
              role="radio"
              aria-checked={dateFilter === 'weekend'}
            >
              This weekend
            </button>
            <button
              type="button"
              className={`filter-pill ${dateFilter === 'week' ? 'is-active' : ''}`}
              onClick={() => setDateFilter('week')}
              role="radio"
              aria-checked={dateFilter === 'week'}
            >
              Next 7 days
            </button>
          </div>

          {/* Category Dropdown/Pills */}
          <div className="category-filter-group">
            <span className="filter-group-label">
              <Filter size={13} aria-hidden="true" />
              <span>Category:</span>
            </span>
            <select
              className="category-select-pill"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter events by category"
            >
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Radius Filter Pills */}
          <RadiusSelector radiusKm={radiusKm} onChangeRadius={setRadiusKm} />

          {/* Desktop View Mode Switcher */}
          <div className="desktop-view-mode-group" role="tablist" aria-label="Layout view mode">
            <button
              type="button"
              className={`view-mode-button ${viewMode === 'split' ? 'is-active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Split View (Feed + Map)"
              role="tab"
              aria-selected={viewMode === 'split'}
            >
              <Columns size={15} aria-hidden="true" />
              <span>Split</span>
            </button>
            <button
              type="button"
              className={`view-mode-button ${viewMode === 'grid' ? 'is-active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Feed Only"
              role="tab"
              aria-selected={viewMode === 'grid'}
            >
              <Grid3X3 size={15} aria-hidden="true" />
              <span>Feed</span>
            </button>
            <button
              type="button"
              className={`view-mode-button ${viewMode === 'map' ? 'is-active' : ''}`}
              onClick={() => setViewMode('map')}
              title="Map Only"
              role="tab"
              aria-selected={viewMode === 'map'}
            >
              <Map size={15} aria-hidden="true" />
              <span>Map</span>
            </button>
          </div>

          {/* Mobile View Toggle Bar */}
          <div className="mobile-view-toggle-bar" role="tablist" aria-label="Switch list and map views">
            <button
              type="button"
              className={`view-toggle-pill ${mobileView === 'list' ? 'is-active' : ''}`}
              onClick={() => setMobileView('list')}
              role="tab"
              aria-selected={mobileView === 'list'}
            >
              <List size={15} aria-hidden="true" />
              <span>List ({fullyFilteredEvents.length})</span>
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
      </div>

      {/* Main Split Content Area */}
      <div className={`discovery-split-layout layout-${viewMode} show-mobile-${mobileView}`}>
        {/* Left Column: Events Feed */}
        <div className="discovery-list-column">
          {loading ? (
            <div className="discovery-loading-state" role="status">
              <div className="loading-card-skeleton" />
              <div className="loading-card-skeleton" />
              <div className="loading-card-skeleton" />
            </div>
          ) : fullyFilteredEvents.length > 0 ? (
            <div className="discovery-grid-wrapper">
              <div className="discovery-results-meta">
                <span className="results-count">
                  {fullyFilteredEvents.length}{' '}
                  {fullyFilteredEvents.length === 1 ? 'gathering' : 'gatherings'} found
                </span>

                <div className="results-meta-details">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      className="reset-filters-link"
                      onClick={handleResetFilters}
                    >
                      Reset filters
                    </button>
                  )}
                  {!activeLocation && (
                    <span className="unfiltered-hint">
                      <Sparkles size={13} aria-hidden="true" />
                      Select a location or click &ldquo;Near me&rdquo; to sort by distance
                    </span>
                  )}
                </div>
              </div>

              <div
                className={`events-grid ${viewMode === 'grid' ? 'grid-wide' : 'grid-split'}`}
                role="feed"
                aria-label="Curated events feed"
              >
                {fullyFilteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isSelected={selectedEventId === event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    saved={savedIds.includes(event.id)}
                    onToggleSave={event.isSample ? undefined : onToggleSave}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Curated Empty State */
            <div className="empty-state discovery-empty-state" role="status">
              <div className="empty-icon">
                <Compass size={50} strokeWidth={1.35} aria-hidden="true" />
              </div>
              <h2 className="empty-title">No gatherings match these criteria</h2>
              <p className="empty-description">
                {activeLocation
                  ? `We couldn't find events matching your search within ${radiusKm} km of ${activeLocation.name}. Try expanding your search radius or resetting date and category filters.`
                  : 'We could not find any events matching your selected filters. Try clearing the search term or choosing "All categories".'}
              </p>
              <div className="empty-state-actions">
                {activeLocation && radiusKm < 500 && (
                  <button
                    type="button"
                    className="discovery-action-button"
                    onClick={() => {
                      const next = radiusKm < 25 ? 25 : radiusKm < 50 ? 50 : radiusKm < 100 ? 100 : 250
                      setRadiusKm(next)
                    }}
                  >
                    Expand radius to {radiusKm < 25 ? 25 : radiusKm < 50 ? 50 : radiusKm < 100 ? 100 : 250} km
                  </button>
                )}
                <button
                  type="button"
                  className="discovery-secondary-button"
                  onClick={handleResetFilters}
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Map */}
        <div className="discovery-map-column">
          <DiscoveryMap
            events={fullyFilteredEvents}
            activeLocation={activeLocation}
            radiusKm={radiusKm}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />
        </div>
      </div>
    </div>
  )

  if (section) {
    const label = 'label' in section ? section.label : ''
    const subtitle = 'subtitle' in section && typeof section.subtitle === 'string' ? section.subtitle : undefined
    return (
      <section className="feature-section discovery-section" aria-labelledby="section-title">
        {label && (
          <div className="section-heading sr-only">
            <h1 id="section-title">{label}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        )}
        {sectionContent}
      </section>
    )
  }

  return <div className="discovery-section">{sectionContent}</div>
}
