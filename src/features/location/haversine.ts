import type { Coordinates } from '../../types/event'

const EARTH_RADIUS_KM = 6371

/**
 * Calculates the straight-line distance in kilometres between two coordinates
 * using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180

  const lat1Rad = toRadians(coord1.latitude)
  const lat2Rad = toRadians(coord2.latitude)
  const deltaLat = toRadians(coord2.latitude - coord1.latitude)
  const deltaLon = toRadians(coord2.longitude - coord1.longitude)

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/**
 * Formats a distance in kilometres into a user-friendly string (e.g., '2.4 km away').
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 0.1) {
    return '< 100 m away'
  }
  return `${distanceKm.toFixed(1)} km away`
}
