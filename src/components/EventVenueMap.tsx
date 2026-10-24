import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertCircle, Loader2, MapPin, MapPinOff } from 'lucide-react'
import type { Coordinates } from '../types/event'
import { searchLocationsGeoapify } from '../features/location/geoapifyService'

export interface EventVenueMapProps {
  venueName?: string
  address?: string
  location?: string
  latitude?: number | null
  longitude?: number | null
  title?: string
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function createVenuePinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'custom-leaflet-div-icon',
    html: `
      <div class="map-venue-pin" aria-label="Venue location">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  })
}

export function EventVenueMap({
  venueName,
  address,
  location,
  latitude,
  longitude,
  title,
}: EventVenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  // Direct coordinates if provided on the event
  const directCoords: Coordinates | null =
    typeof latitude === 'number' &&
    !isNaN(latitude) &&
    typeof longitude === 'number' &&
    !isNaN(longitude)
      ? { latitude, longitude }
      : null

  const [geocodedCoords, setGeocodedCoords] = useState<Coordinates | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodingFailed, setGeocodingFailed] = useState(false)
  const [runtimeMapError, setRuntimeMapError] = useState<string | null>(null)

  const rawLocationText = `${venueName || ''} ${address || ''} ${location || ''}`.trim()
  const lowerLocation = rawLocationText.toLowerCase()
  const isVirtual =
    !rawLocationText ||
    lowerLocation.includes('online') ||
    lowerLocation.includes('virtual') ||
    lowerLocation.includes('to be announced') ||
    lowerLocation.includes('tba') ||
    lowerLocation.includes('tbd')

  // Asynchronously resolve coordinates via Geoapify only when coordinates are not already present
  useEffect(() => {
    if (
      typeof latitude === 'number' &&
      !isNaN(latitude) &&
      typeof longitude === 'number' &&
      !isNaN(longitude)
    ) {
      return
    }

    const query = [venueName, address].filter(Boolean).join(', ') || address || location || ''
    if (isVirtual || query.trim().length < 3) {
      return
    }

    let isMounted = true
    const controller = new AbortController()

    // Dispatch geocoding request asynchronously
    const runGeocode = async () => {
      setIsGeocoding(true)
      setGeocodingFailed(false)
      try {
        const res = await searchLocationsGeoapify(query, controller.signal)
        if (!isMounted) return
        if (res.results && res.results.length > 0) {
          setGeocodedCoords(res.results[0].coordinates)
          setGeocodingFailed(false)
        } else {
          setGeocodedCoords(null)
          setGeocodingFailed(true)
        }
      } catch {
        if (!isMounted) return
        setGeocodedCoords(null)
        setGeocodingFailed(true)
      } finally {
        if (isMounted) {
          setIsGeocoding(false)
        }
      }
    }

    void runGeocode()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [latitude, longitude, venueName, address, location, isVirtual])

  const resolvedCoords = directCoords || geocodedCoords
  const query = [venueName, address].filter(Boolean).join(', ') || address || location || ''
  const isUnavailable = !directCoords && (isVirtual || query.trim().length < 3 || geocodingFailed)

  // Initialize and update Leaflet map centered exclusively on the venue
  useEffect(() => {
    if (!resolvedCoords || !containerRef.current) return

    setRuntimeMapError(null)

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    try {
      const map = L.map(containerRef.current, {
        center: [resolvedCoords.latitude, resolvedCoords.longitude],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      })

      L.control.zoom({ position: 'topright' }).addTo(map)

      L.control
        .attribution({ position: 'bottomright', prefix: false })
        .addAttribution(
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        )
        .addTo(map)

      const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      })

      tileLayer.on('tileerror', () => {
        setRuntimeMapError('Unable to load map tiles. Please check your internet connection.')
      })

      tileLayer.addTo(map)

      // Add a single venue marker
      const marker = L.marker([resolvedCoords.latitude, resolvedCoords.longitude], {
        icon: createVenuePinIcon(),
        title: venueName || location || title || 'Venue location',
      }).addTo(map)

      const displayTitle = venueName || location || title || 'Venue'
      const displayAddress = address || location || ''
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${resolvedCoords.latitude},${resolvedCoords.longitude}`
      )}`

      const popupHtml = `
        <div class="venue-map-popup">
          <strong class="venue-popup-name">${escapeHtml(displayTitle)}</strong>
          ${displayAddress ? `<span class="venue-popup-address">${escapeHtml(displayAddress)}</span>` : ''}
          <a class="venue-popup-directions" href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer">
            Directions on Google Maps &rarr;
          </a>
        </div>
      `

      marker.bindPopup(popupHtml, {
        className: 'custom-venue-popup',
        maxWidth: 280,
      })

      marker.openPopup()

      mapRef.current = map
    } catch {
      queueMicrotask(() => {
        setRuntimeMapError('Failed to initialize interactive venue map.')
      })
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [resolvedCoords, venueName, address, location, title])

  // ResizeObserver for clean responsive invalidation
  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize()
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  const displayLocationText = venueName
    ? `${venueName}${address ? ` · ${address}` : ''}`
    : address || location || 'Location to be announced'

  if (isGeocoding) {
    return (
      <div className="venue-map-container is-loading" aria-label="Loading venue map" aria-live="polite">
        <div className="venue-map-loading-indicator">
          <Loader2 size={24} className="venue-spinner" aria-hidden="true" />
          <span>Locating venue on map...</span>
        </div>
      </div>
    )
  }

  if (isUnavailable || !resolvedCoords) {
    return (
      <div className="venue-map-container is-fallback" role="region" aria-label="Venue location details">
        <div className="venue-map-fallback">
          <div className="venue-fallback-icon-wrap">
            <MapPinOff size={28} className="venue-fallback-icon" aria-hidden="true" />
          </div>
          <div className="venue-fallback-content">
            <h3 className="venue-fallback-title">Exact venue map unavailable</h3>
            <p className="venue-fallback-desc">
              {isVirtual
                ? 'This gathering is online or virtual and does not have physical map coordinates.'
                : 'Physical coordinates could not be located on the map for this venue.'}
            </p>
            {displayLocationText && (
              <div className="venue-fallback-location-badge">
                <MapPin size={14} aria-hidden="true" />
                <span>{displayLocationText}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="venue-map-container" aria-label="Event venue map">
      <div ref={containerRef} className="venue-map-canvas" />

      {runtimeMapError && (
        <div className="venue-map-error-overlay" role="alert">
          <AlertCircle size={26} className="map-error-icon" aria-hidden="true" />
          <h4 className="map-error-title">Map Unavailable</h4>
          <p className="map-error-desc">{runtimeMapError}</p>
        </div>
      )}
    </div>
  )
}
