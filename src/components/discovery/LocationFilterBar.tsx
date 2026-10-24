import { useState, useEffect, useRef } from 'react'
import { Search, X, Navigation, MapPin, Loader2, AlertCircle } from 'lucide-react'
import type { ActiveLocation } from '../../types/event'
import type { GpsStatus } from '../../features/location/useGeolocation'
import {
  searchLocationsGeoapify,
  type LocationSearchResult,
} from '../../features/location/geoapifyService'

interface LocationFilterBarProps {
  activeLocation: ActiveLocation | null
  onSelectLocation: (location: ActiveLocation) => void
  onClearLocation: () => void
  gpsStatus: GpsStatus
  gpsErrorMessage: string | null
  onNearMeClick: () => void
  radiusKm: number
  onChangeRadius: (radius: number) => void
}

const RADIUS_OPTIONS = [5, 10, 25]

export function LocationFilterBar({
  activeLocation,
  onSelectLocation,
  onClearLocation,
  gpsStatus,
  gpsErrorMessage,
  onNearMeClick,
  radiusKm,
  onChangeRadius,
}: LocationFilterBarProps) {
  const [typedQuery, setTypedQuery] = useState<string | null>(null)
  const [prevActiveLocation, setPrevActiveLocation] = useState(activeLocation)
  const [results, setResults] = useState<LocationSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isCustomRadiusOpen, setIsCustomRadiusOpen] = useState(false)
  const [customRadiusInput, setCustomRadiusInput] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const [customRadiusError, setCustomRadiusError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Adjust query during render when activeLocation prop changes (e.g. Near me clicked or location reset)
  if (activeLocation !== prevActiveLocation) {
    setPrevActiveLocation(activeLocation)
    setTypedQuery(null)
    setHighlightedIndex(-1)
  }

  const query = typedQuery ?? (activeLocation ? activeLocation.name : '')

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced geocoding search
  const handleInputChange = (value: string) => {
    setTypedQuery(value)
    setSearchError(null)
    setHighlightedIndex(-1)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    if (value.trim().length < 3) {
      setResults([])
      setIsSearching(false)
      setIsDropdownOpen(false)
      return
    }

    setIsSearching(true)
    setIsDropdownOpen(true)

    debounceTimerRef.current = setTimeout(async () => {
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const response = await searchLocationsGeoapify(value, abortController.signal)

      if (!abortController.signal.aborted) {
        setIsSearching(false)
        setResults(response.results)
        setIsApiKeyMissing(response.isApiKeyMissing)
        setSearchError(response.errorMessage || null)
        if (response.results.length > 0) {
          setHighlightedIndex(0)
        }
      }
    }, 350)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (!isDropdownOpen && results.length > 0) {
        setIsDropdownOpen(true)
        setHighlightedIndex(0)
        return
      }
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false)
      setHighlightedIndex(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isSearching) return

      if (results.length > 0) {
        const targetIndex = highlightedIndex >= 0 ? highlightedIndex : 0
        handleSelectResult(results[targetIndex])
      } else if (query.trim().length >= 3) {
        if (isApiKeyMissing) {
          setSearchError(
            `No demo location found for "${query.trim()}". In demo mode, available locations include Mumbai, Pune, Thane, Navi Mumbai, and BKC venues. Configure VITE_GEOAPIFY_API_KEY in .env for global search.`
          )
        } else {
          setSearchError(`No verified location found for "${query.trim()}". Please choose a suggestion from the list.`)
        }
        setIsDropdownOpen(true)
      }
    }
  }

  const handleSelectResult = (result: LocationSearchResult) => {
    setTypedQuery(null)
    setIsDropdownOpen(false)
    setHighlightedIndex(-1)
    onSelectLocation({
      name: result.name,
      coordinates: result.coordinates,
      isGps: false,
    })
  }

  const handleClear = () => {
    setTypedQuery('')
    setResults([])
    setIsDropdownOpen(false)
    setSearchError(null)
    setHighlightedIndex(-1)
    onClearLocation()
  }

  const handleToggleCustomRadius = () => {
    if (!isCustomRadiusOpen) {
      setCustomRadiusInput(radiusKm.toString())
      setCustomRadiusError(null)
    }
    setIsCustomRadiusOpen(!isCustomRadiusOpen)
  }

  const handleCustomRadiusSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = customRadiusInput.trim()
    if (!trimmed) {
      setCustomRadiusError('Please enter a distance in kilometres.')
      return
    }
    const parsed = parseFloat(trimmed)
    if (isNaN(parsed)) {
      setCustomRadiusError('Please enter a valid numeric value.')
      return
    }
    if (parsed <= 0) {
      setCustomRadiusError('Radius must be greater than 0 km.')
      return
    }
    if (parsed > 500) {
      setCustomRadiusError('Maximum radius is 500 km.')
      return
    }

    setCustomRadiusError(null)
    onChangeRadius(parsed)
    setIsCustomRadiusOpen(false)
  }

  const isNearMeActive = Boolean(activeLocation?.isGps)

  return (
    <div className="discovery-filter-container" ref={containerRef}>
      <div className="discovery-controls">
        {/* Search Field */}
        <div className="location-search-wrapper">
          <div className="location-search-input-box">
            <Search className="search-icon" size={18} aria-hidden="true" />
            <input
              type="text"
              className="location-input"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (query.trim().length >= 3) setIsDropdownOpen(true)
              }}
              placeholder="Search city, neighbourhood, venue (e.g. Jio World Drive)..."
              aria-label="Search location or venue"
              autoComplete="off"
            />
            {isSearching ? (
              <Loader2 className="search-loader spinner" size={16} aria-label="Searching locations" />
            ) : query ? (
              <button
                type="button"
                className="search-clear-button"
                onClick={handleClear}
                aria-label="Clear location search"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && (
            <div className="location-dropdown" role="listbox">
              {isSearching && (
                <div className="dropdown-status-item">
                  <Loader2 size={15} className="spinner" />
                  <span>Searching locations...</span>
                </div>
              )}

              {!isSearching && searchError && (
                <div className="dropdown-error-item" role="alert">
                  <AlertCircle size={15} />
                  <span>{searchError}</span>
                </div>
              )}

              {!isSearching && results.length > 0 && (
                <div className="dropdown-results">
                  {results.map((result, index) => (
                    <button
                      key={result.id}
                      type="button"
                      className={`dropdown-result-item ${highlightedIndex === index ? 'is-highlighted' : ''}`}
                      onClick={() => handleSelectResult(result)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      role="option"
                      aria-selected={highlightedIndex === index || activeLocation?.name === result.name}
                    >
                      <MapPin size={16} className="item-icon" />
                      <div className="item-text">
                        <span className="item-name">
                          {result.name}
                          {result.type && (
                            <span className={`type-tag type-${result.type}`}>
                              {result.type === 'city' ? 'City' : result.type === 'neighbourhood' ? 'Area' : 'Venue'}
                            </span>
                          )}
                          {result.isDemo && <span className="demo-tag">Demo</span>}
                        </span>
                        <span className="item-address">{result.formattedAddress}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!isSearching && !searchError && results.length === 0 && (
                <div className="dropdown-status-item">
                  {isApiKeyMissing ? (
                    <div className="dropdown-empty-help">
                      <p>No demo locations found for &ldquo;{query}&rdquo;.</p>
                      <span className="demo-available-hint">
                        Supported: <strong>Mumbai</strong>, <strong>Pune</strong>, <strong>Thane</strong>, <strong>Navi Mumbai</strong>, and BKC venues.
                      </span>
                    </div>
                  ) : (
                    <span>No locations found for &ldquo;{query}&rdquo;</span>
                  )}
                </div>
              )}

              {isApiKeyMissing && (
                <div className="dropdown-info-footer">
                  <span>
                    💡 <strong>Demo mode active</strong> (showing curated test locations). Add <code>VITE_GEOAPIFY_API_KEY</code> to <code>.env</code> to enable global search for any city or venue.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Near Me Button */}
        <button
          type="button"
          className={`near-me-button ${isNearMeActive ? 'is-active' : ''}`}
          onClick={onNearMeClick}
          disabled={gpsStatus === 'locating'}
          title="Use current GPS location"
        >
          {gpsStatus === 'locating' ? (
            <Loader2 size={16} className="spinner" />
          ) : (
            <Navigation size={16} className={isNearMeActive ? 'icon-fill' : ''} />
          )}
          <span>{gpsStatus === 'locating' ? 'Locating...' : 'Near me'}</span>
        </button>

        {/* Radius Selector */}
        <div className="radius-selector" role="radiogroup" aria-label="Distance radius">
          <span className="radius-label">Radius:</span>
          {RADIUS_OPTIONS.map((radius) => (
            <button
              key={radius}
              type="button"
              className={`radius-pill ${radiusKm === radius && !isCustomRadiusOpen ? 'is-selected' : ''}`}
              onClick={() => {
                setIsCustomRadiusOpen(false)
                setCustomRadiusError(null)
                onChangeRadius(radius)
              }}
              role="radio"
              aria-checked={radiusKm === radius && !isCustomRadiusOpen}
            >
              {radius} km
            </button>
          ))}
          <button
            type="button"
            className={`radius-pill ${
              !RADIUS_OPTIONS.includes(radiusKm) || isCustomRadiusOpen ? 'is-selected' : ''
            }`}
            onClick={handleToggleCustomRadius}
          >
            {!RADIUS_OPTIONS.includes(radiusKm) ? `${radiusKm} km (Custom)` : 'Custom'}
          </button>
        </div>
      </div>

      {/* Custom Radius Input Modal/Bar */}
      {isCustomRadiusOpen && (
        <form onSubmit={handleCustomRadiusSubmit} className="custom-radius-form">
          <label htmlFor="custom-radius-input">Custom radius (km):</label>
          <input
            id="custom-radius-input"
            type="number"
            min="1"
            max="500"
            step="1"
            placeholder="e.g. 15"
            value={customRadiusInput}
            onChange={(e) => {
              setCustomRadiusInput(e.target.value)
              if (customRadiusError) setCustomRadiusError(null)
            }}
            className="custom-radius-input"
            autoFocus
          />
          <button type="submit" className="custom-radius-apply">
            Apply
          </button>
          <button
            type="button"
            className="custom-radius-cancel"
            onClick={() => {
              setIsCustomRadiusOpen(false)
              setCustomRadiusError(null)
            }}
          >
            Cancel
          </button>
          {customRadiusError && (
            <span className="custom-radius-error" role="alert">
              {customRadiusError}
            </span>
          )}
        </form>
      )}

      {/* GPS Denial / Error Alert */}
      {gpsErrorMessage && (
        <div className="location-banner banner-warning" role="alert">
          <AlertCircle size={16} />
          <span>{gpsErrorMessage}</span>
        </div>
      )}

      {/* Active Location Info Bar */}
      {activeLocation && (
        <div className="active-location-summary">
          <span className="summary-text">
            Showing events within <strong>{radiusKm} km</strong> of{' '}
            <strong>{activeLocation.name}</strong>
            {activeLocation.isGps && <span className="gps-pill">Current GPS</span>}
          </span>
        </div>
      )}
    </div>
  )
}
