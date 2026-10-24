import type { Coordinates } from '../../types/event'

export type LocationType = 'city' | 'neighbourhood' | 'venue'

export interface LocationSearchResult {
  id: string
  name: string
  formattedAddress: string
  coordinates: Coordinates
  type?: LocationType
  isDemo?: boolean
}

export interface GeocodingResponse {
  results: LocationSearchResult[]
  isApiKeyMissing: boolean
  errorMessage?: string
}

/**
 * Curated offline demo suggestions available when VITE_GEOAPIFY_API_KEY is not configured yet.
 * Includes both city-level centroids and prominent neighbourhoods/venues.
 */
const OFFLINE_DEMO_LOCATIONS: LocationSearchResult[] = [
  // --- Cities ---
  {
    id: 'demo-city-mumbai',
    name: 'Mumbai',
    formattedAddress: 'Mumbai, Maharashtra, India',
    coordinates: { latitude: 19.0760, longitude: 72.8777 },
    type: 'city',
    isDemo: true,
  },
  {
    id: 'demo-city-pune',
    name: 'Pune',
    formattedAddress: 'Pune, Maharashtra, India',
    coordinates: { latitude: 18.5204, longitude: 73.8567 },
    type: 'city',
    isDemo: true,
  },
  {
    id: 'demo-city-thane',
    name: 'Thane',
    formattedAddress: 'Thane, Maharashtra, India',
    coordinates: { latitude: 19.2183, longitude: 72.9781 },
    type: 'city',
    isDemo: true,
  },
  {
    id: 'demo-city-navi-mumbai',
    name: 'Navi Mumbai',
    formattedAddress: 'Navi Mumbai, Maharashtra, India',
    coordinates: { latitude: 19.0330, longitude: 73.0297 },
    type: 'city',
    isDemo: true,
  },

  // --- Venues & Neighbourhoods ---
  {
    id: 'demo-jio-world-drive',
    name: 'Jio World Drive',
    formattedAddress: 'Bandra Kurla Complex, Bandra East, Mumbai 400051',
    coordinates: { latitude: 19.0657, longitude: 72.8647 },
    type: 'venue',
    isDemo: true,
  },
  {
    id: 'demo-bandra-west',
    name: 'Bandra West (Linking Road / Hill Road)',
    formattedAddress: 'Bandra West, Mumbai 400050',
    coordinates: { latitude: 19.0596, longitude: 72.8295 },
    type: 'neighbourhood',
    isDemo: true,
  },
  {
    id: 'demo-lower-parel',
    name: 'Lower Parel / Phoenix Palladium',
    formattedAddress: 'Senapati Bapat Marg, Lower Parel, Mumbai 400013',
    coordinates: { latitude: 18.9953, longitude: 72.8258 },
    type: 'neighbourhood',
    isDemo: true,
  },
  {
    id: 'demo-powai',
    name: 'Hiranandani Gardens, Powai',
    formattedAddress: 'Powai, Mumbai 400076',
    coordinates: { latitude: 19.1176, longitude: 72.9060 },
    type: 'neighbourhood',
    isDemo: true,
  },
  {
    id: 'demo-south-mumbai',
    name: 'Kala Ghoda / Fort Arts District',
    formattedAddress: 'Fort, South Mumbai 400001',
    coordinates: { latitude: 18.9284, longitude: 72.8331 },
    type: 'neighbourhood',
    isDemo: true,
  },
]

/**
 * Service to search for venues, addresses, and landmarks via Geoapify Geocoding Autocomplete API.
 * Docs: https://apidocs.geoapify.com/docs/geocoding/
 * 
 * Set VITE_GEOAPIFY_API_KEY in your .env file to enable live search.
 */
export async function searchLocationsGeoapify(
  query: string,
  signal?: AbortSignal
): Promise<GeocodingResponse> {
  const trimmed = query.trim()
  if (trimmed.length < 3) {
    return { results: [], isApiKeyMissing: false }
  }

  const rawKey = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim()
  const apiKey = rawKey && rawKey !== 'your_geoapify_api_key_here' && !rawKey.startsWith('your_') ? rawKey : undefined

  // Graceful fallback when API key is not yet set in environment
  if (!apiKey) {
    const queryLower = trimmed.toLowerCase()
    const matchingDemos = OFFLINE_DEMO_LOCATIONS.filter(
      (loc) =>
        loc.name.toLowerCase().includes(queryLower) ||
        loc.formattedAddress.toLowerCase().includes(queryLower)
    )

    // Relevance ranking:
    // 1. Exact name match (e.g. "Mumbai" matches City of Mumbai before Jio World Drive)
    // 2. Name starts with query
    // 3. Name contains query
    // 4. City-level entries preferred over specific venues for general city names
    matchingDemos.sort((a, b) => {
      const aName = a.name.toLowerCase()
      const bName = b.name.toLowerCase()

      const aExact = aName === queryLower ? 1 : 0
      const bExact = bName === queryLower ? 1 : 0
      if (aExact !== bExact) return bExact - aExact

      const aStarts = aName.startsWith(queryLower) ? 1 : 0
      const bStarts = bName.startsWith(queryLower) ? 1 : 0
      if (aStarts !== bStarts) return bStarts - aStarts

      const aContains = aName.includes(queryLower) ? 1 : 0
      const bContains = bName.includes(queryLower) ? 1 : 0
      if (aContains !== bContains) return bContains - aContains

      if (a.type === 'city' && b.type !== 'city') return -1
      if (b.type === 'city' && a.type !== 'city') return 1

      return 0
    })

    return {
      results: matchingDemos.slice(0, 5),
      isApiKeyMissing: true,
    }
  }

  try {
    const endpoint = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
      trimmed
    )}&limit=5&format=json&apiKey=${apiKey}`

    const response = await fetch(endpoint, {
      signal,
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          results: [],
          isApiKeyMissing: false,
          errorMessage: 'Invalid or restricted Geoapify API key.',
        }
      }
      if (response.status === 429) {
        return {
          results: [],
          isApiKeyMissing: false,
          errorMessage: 'Geoapify rate limit reached. Please try again in a moment.',
        }
      }
      return {
        results: [],
        isApiKeyMissing: false,
        errorMessage: `Location search error (${response.status}).`,
      }
    }

    const data = await response.json()
    const rawResults = data.results || []

    const results: LocationSearchResult[] = rawResults.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any, index: number) => {
        const isCity =
          item.result_type === 'city' ||
          item.result_type === 'administrative' ||
          (!item.address_line1 && Boolean(item.city))

        const name =
          (isCity && item.city) ||
          item.name ||
          item.address_line1 ||
          item.formatted?.split(',')[0] ||
          trimmed

        const type: LocationType = isCity
          ? 'city'
          : item.result_type === 'suburb' || item.result_type === 'district'
          ? 'neighbourhood'
          : 'venue'

        const formattedAddress =
          item.formatted || item.address_line2 || `${item.city || ''}, ${item.country || ''}`

        return {
          id: item.place_id || `geoapify-${index}-${item.lat}-${item.lon}`,
          name,
          formattedAddress,
          type,
          coordinates: {
            latitude: Number(item.lat),
            longitude: Number(item.lon),
          },
        }
      }
    )

    // Relevance ranking for live results
    const queryLower = trimmed.toLowerCase()
    results.sort((a, b) => {
      const aName = a.name.toLowerCase()
      const bName = b.name.toLowerCase()

      const aExact = aName === queryLower ? 1 : 0
      const bExact = bName === queryLower ? 1 : 0
      if (aExact !== bExact) return bExact - aExact

      const aStarts = aName.startsWith(queryLower) ? 1 : 0
      const bStarts = bName.startsWith(queryLower) ? 1 : 0
      if (aStarts !== bStarts) return bStarts - aStarts

      if (a.type === 'city' && b.type !== 'city' && bName.includes(queryLower)) return -1
      if (b.type === 'city' && a.type !== 'city' && aName.includes(queryLower)) return 1

      return 0
    })

    return {
      results,
      isApiKeyMissing: false,
    }
  } catch (error: unknown) {
    if (signal?.aborted) {
      return { results: [], isApiKeyMissing: false }
    }
    const message =
      error instanceof Error ? error.message : 'Network error fetching locations'
    return {
      results: [],
      isApiKeyMissing: false,
      errorMessage: message,
    }
  }
}
