import type { Coordinates, GatherEvent, GatherEventWithDistance } from '../../types/event'
import { calculateHaversineDistanceKm } from '../location/haversine'

export interface FilterOptions {
  center: Coordinates | null
  radiusKm: number | null
  referenceDate?: Date
  includePastEvents?: boolean
}

/**
 * Pure function to filter and sort events by distance and upcoming date.
 * Independent of UI and dataset source.
 */
export function filterUpcomingEventsByRadius(
  events: GatherEvent[],
  options: FilterOptions
): GatherEventWithDistance[] {
  const {
    center,
    radiusKm,
    referenceDate = new Date(),
    includePastEvents = false,
  } = options

  return events
    .filter((event) => {
      // Date filtering: exclude past events unless explicitly requested
      if (!includePastEvents && event.startDateTime) {
        const eventDate = new Date(event.startDateTime)
        if (!isNaN(eventDate.getTime()) && eventDate < referenceDate) {
          return false
        }
      }
      return true
    })
    .map((event) => {
      // Validate coordinates
      const hasValidCoords =
        typeof event.latitude === 'number' &&
        !isNaN(event.latitude) &&
        typeof event.longitude === 'number' &&
        !isNaN(event.longitude)

      if (!center || !hasValidCoords) {
        return {
          ...event,
          distanceKm: null,
        }
      }

      const distance = calculateHaversineDistanceKm(center, {
        latitude: event.latitude!,
        longitude: event.longitude!,
      })

      return {
        ...event,
        distanceKm: distance,
      }
    })
    .filter((event) => {
      // If no center or no radius selected, return all upcoming events
      if (!center || radiusKm === null) {
        return true
      }

      // If radius filter is active, only include events that have coordinates and are within radius
      if (event.distanceKm === null) {
        return false
      }

      return event.distanceKm <= radiusKm
    })
    .sort((a, b) => {
      // When center is active, sort by nearest distance first
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm
      }
      if (a.distanceKm !== null) return -1
      if (b.distanceKm !== null) return 1

      // Otherwise, sort chronologically
      return (
        new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
      )
    })
}
