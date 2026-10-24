import { useState, useCallback } from 'react'
import type { Coordinates } from '../../types/event'

export type GpsStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable' | 'timeout'

export interface UseGeolocationReturn {
  gpsLocation: Coordinates | null
  status: GpsStatus
  errorMessage: string | null
  requestGps: () => Promise<Coordinates | null>
}

/**
 * Hook for managing the browser's native Geolocation API.
 * Keeps GPS coordinates isolated from active search selection.
 */
export function useGeolocation(): UseGeolocationReturn {
  const [gpsLocation, setGpsLocation] = useState<Coordinates | null>(null)
  const [status, setStatus] = useState<GpsStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const requestGps = useCallback((): Promise<Coordinates | null> => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable')
      setErrorMessage('Geolocation is not supported by your browser.')
      return Promise.resolve(null)
    }

    setStatus('locating')
    setErrorMessage(null)

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }
          setGpsLocation(coords)
          setStatus('granted')
          setErrorMessage(null)
          resolve(coords)
        },
        (error) => {
          let nextStatus: GpsStatus = 'unavailable'
          let message = 'Unable to determine your GPS location.'

          switch (error.code) {
            case error.PERMISSION_DENIED:
              nextStatus = 'denied'
              message = 'Location access was denied. You can still search for any venue manually.'
              break
            case error.POSITION_UNAVAILABLE:
              nextStatus = 'unavailable'
              message = 'Your device GPS is currently unavailable.'
              break
            case error.TIMEOUT:
              nextStatus = 'timeout'
              message = 'Location request timed out. Please try again.'
              break
          }

          setStatus(nextStatus)
          setErrorMessage(message)
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      )
    })
  }, [])

  return {
    gpsLocation,
    status,
    errorMessage,
    requestGps,
  }
}
