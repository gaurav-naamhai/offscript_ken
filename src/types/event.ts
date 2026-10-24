export interface Coordinates {
  latitude: number
  longitude: number
}

export interface GatherEvent {
  id: string
  title: string
  description: string
  category: string
  startDateTime: string // ISO 8601 string (e.g., '2026-11-15T18:30:00Z')
  endDateTime?: string
  venueName: string
  address: string
  latitude: number | null
  longitude: number | null
  price?: string
  imageUrl?: string
  organizerName?: string
}

export interface GatherEventWithDistance extends GatherEvent {
  distanceKm: number | null
}

export interface ActiveLocation {
  name: string
  coordinates: Coordinates
  isGps: boolean
}
