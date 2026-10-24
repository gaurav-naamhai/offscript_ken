import { describe, expect, it } from 'vitest'
import { searchLocationsGeoapify } from './geoapifyService'

describe('Venue Geocoding for Event Venue Map', () => {
  it('returns valid venue coordinates for known venue queries', async () => {
    const result = await searchLocationsGeoapify('Jio World Drive')
    expect(result.results.length).toBeGreaterThan(0)
    const venue = result.results[0]
    expect(venue.coordinates.latitude).toBeGreaterThan(18.5)
    expect(venue.coordinates.latitude).toBeLessThan(19.5)
    expect(venue.coordinates.longitude).toBeGreaterThan(72.5)
    expect(venue.coordinates.longitude).toBeLessThan(73.5)
  })

  it('handles empty or too-short venue queries safely without throwing', async () => {
    const result = await searchLocationsGeoapify('BK')
    expect(result.results).toEqual([])
  })

  it('never returns false or synthetic user coordinates for unmapped queries', async () => {
    const result = await searchLocationsGeoapify('Nonexistent Unknown Planet 99999')
    expect(result.results).toEqual([])
  })
})
