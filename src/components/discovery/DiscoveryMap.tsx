import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertCircle, MapPinOff } from 'lucide-react'
import type { ActiveLocation, GatherEventWithDistance } from '../../types/event'
import { formatDistance } from '../../features/location/haversine'

interface DiscoveryMapProps {
  events: GatherEventWithDistance[]
  activeLocation: ActiveLocation | null
  radiusKm: number
  selectedEventId?: string | null
  onSelectEvent?: (eventId: string) => void
}

/**
 * Creates custom HTML divIcon for the active center location (GPS or searched).
 */
function createCenterIcon(isGps: boolean): L.DivIcon {
  return L.divIcon({
    className: 'custom-leaflet-div-icon',
    html: `
      <div class="map-center-pin ${isGps ? 'is-gps' : ''}" title="${isGps ? 'Your GPS Location' : 'Selected Location'}">
        <div class="map-center-pulse"></div>
        <div class="map-center-dot"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

/**
 * Creates custom HTML divIcon for an event marker.
 */
function createEventIcon(isSelected: boolean): L.DivIcon {
  return L.divIcon({
    className: 'custom-leaflet-div-icon',
    html: `
      <div class="map-event-pin ${isSelected ? 'is-selected' : ''}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

export function DiscoveryMap({
  events,
  activeLocation,
  radiusKm,
  selectedEventId,
  onSelectEvent,
}: DiscoveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map())

  const [runtimeMapError, setRuntimeMapError] = useState<string | null>(null)

  const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim()
  const mapError = runtimeMapError

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    try {
      // Default view initialized at neutral center
      const initialLat = activeLocation?.coordinates.latitude ?? 19.0760
      const initialLng = activeLocation?.coordinates.longitude ?? 72.8777

      const map = L.map(containerRef.current, {
        center: [initialLat, initialLng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      })

      // Add zoom control in top-right
      L.control.zoom({ position: 'topright' }).addTo(map)

      // Add attribution in bottom-right
      L.control
        .attribution({ position: 'bottomright', prefix: false })
        .addAttribution(apiKey
          ? 'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> | © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
          : '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>')
        .addTo(map)

      const tileUrl = apiKey
        ? `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${apiKey}`
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 20,
        subdomains: apiKey ? ['maps'] : ['a', 'b', 'c'],
      })

      tileLayer.on('tileerror', () => {
        setRuntimeMapError('Unable to load map tiles. Please check your network connection.')
      })

      tileLayer.addTo(map)

      const layerGroup = L.layerGroup().addTo(map)

      mapRef.current = map
      layerGroupRef.current = layerGroup
    } catch {
      queueMicrotask(() => {
        setRuntimeMapError('Failed to initialize interactive map.')
      })
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        layerGroupRef.current = null
      }
    }
  }, [apiKey, activeLocation?.coordinates.latitude, activeLocation?.coordinates.longitude])

  // ResizeObserver to handle container size changes and invalidate map size
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize()
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // Update Markers, Radius Circle, and Viewport
  useEffect(() => {
    const map = mapRef.current
    const layerGroup = layerGroupRef.current
    if (!map || !layerGroup) return

    layerGroup.clearLayers()
    markersMapRef.current.clear()

    // 1. Draw Active Location Center & Radius Boundary
    let circleBounds: L.LatLngBounds | null = null

    if (activeLocation) {
      const centerLatLng: [number, number] = [
        activeLocation.coordinates.latitude,
        activeLocation.coordinates.longitude,
      ]

      // Center Marker
      const centerMarker = L.marker(centerLatLng, {
        icon: createCenterIcon(activeLocation.isGps),
        zIndexOffset: 1000,
      }).addTo(layerGroup)

      centerMarker.bindPopup(`
        <div class="map-popup-center">
          <strong>${activeLocation.name}</strong>
          <span>${activeLocation.isGps ? 'Your verified GPS center' : 'Search reference point'}</span>
        </div>
      `)

      // Radius Circle (radius in meters)
      const radiusMeters = radiusKm * 1000
      const radiusCircle = L.circle(centerLatLng, {
        radius: radiusMeters,
        color: '#1d5542',
        weight: 1.5,
        opacity: 0.6,
        fillColor: '#edf5f1',
        fillOpacity: 0.18,
        dashArray: '5, 5',
      }).addTo(layerGroup)

      circleBounds = radiusCircle.getBounds()
    }

    // 2. Add Event Markers (only events with valid latitude & longitude)
    const validEvents = events.filter(
      (event): event is GatherEventWithDistance & { latitude: number; longitude: number } =>
        typeof event.latitude === 'number' &&
        !isNaN(event.latitude) &&
        typeof event.longitude === 'number' &&
        !isNaN(event.longitude)
    )

    const eventLatLngs: [number, number][] = []

    validEvents.forEach((event) => {
      const latLng: [number, number] = [event.latitude, event.longitude]
      eventLatLngs.push(latLng)

      const isSelected = selectedEventId === event.id
      const marker = L.marker(latLng, {
        icon: createEventIcon(isSelected),
        zIndexOffset: isSelected ? 500 : 100,
      }).addTo(layerGroup)

      markersMapRef.current.set(event.id, marker)

      const formattedDate = new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
      }).format(new Date(event.startDateTime))

      const distanceBadge =
        event.distanceKm !== null
          ? `<span class="popup-distance">${formatDistance(event.distanceKm)}</span>`
          : ''

      const popupHtml = `
        <div class="map-popup-card">
          <div class="popup-category">${event.category}</div>
          <h4 class="popup-title">${event.title}</h4>
          <div class="popup-date">${formattedDate}</div>
          <div class="popup-venue">${event.venueName}</div>
          <div class="popup-footer">
            ${distanceBadge}
            ${event.price ? `<span class="popup-price">${event.price}</span>` : ''}
          </div>
        </div>
      `

      marker.bindPopup(popupHtml, {
        className: 'custom-event-popup',
        maxWidth: 260,
      })

      marker.on('click', () => {
        onSelectEvent?.(event.id)
      })
    })

    // 3. Viewport Fitting Logic
    if (activeLocation && circleBounds) {
      // Fit to radius circle boundary so user clearly sees the search circle
      map.fitBounds(circleBounds, { padding: [30, 30], maxZoom: 15 })
    } else if (eventLatLngs.length > 0) {
      // "View all gatherings" / unselected location: fit bounds of all geocoded events
      const bounds = L.latLngBounds(eventLatLngs)
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    } else {
      // Fallback neutral view if no coordinates are available
      map.setView([19.0760, 72.8777], 11)
    }
  }, [events, activeLocation, radiusKm, selectedEventId, onSelectEvent])

  // Open popup if selectedEventId changes externally (e.g. from list click)
  useEffect(() => {
    if (!selectedEventId) return
    const marker = markersMapRef.current.get(selectedEventId)
    if (marker && mapRef.current) {
      marker.openPopup()
    }
  }, [selectedEventId])

  // Has events with no coordinates?
  const eventsWithoutCoordsCount = events.filter(
    (e) => typeof e.latitude !== 'number' || typeof e.longitude !== 'number'
  ).length

  return (
    <div className="discovery-map-container" aria-label="Interactive events map">
      <div ref={containerRef} className="discovery-map-canvas" />

      {/* Map Error / Fallback State */}
      {mapError && (
        <div className="discovery-map-error-overlay" role="alert">
          <AlertCircle size={28} className="map-error-icon" />
          <h3 className="map-error-title">Map Unavailable</h3>
          <p className="map-error-desc">{mapError}</p>
        </div>
      )}

      {/* Empty State when no events have coordinates */}
      {!mapError && events.length === 0 && (
        <div className="discovery-map-empty-overlay">
          <MapPinOff size={24} />
          <span>No gatherings within this radius</span>
        </div>
      )}

      {/* Notice for online/unmapped events */}
      {!mapError && eventsWithoutCoordsCount > 0 && (
        <div className="discovery-map-notice">
          <span>
            {eventsWithoutCoordsCount}{' '}
            {eventsWithoutCoordsCount === 1 ? 'online gathering' : 'online gatherings'} listed in results without map coordinates
          </span>
        </div>
      )}
    </div>
  )
}
