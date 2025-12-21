/**
 * useGeolocation Hook
 * Manages device geolocation state and operations
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Coordinates } from '@/types';

interface GeolocationState {
  coordinates: Coordinates | null;
  error: string | null;
  isLoading: boolean;
  isSupported: boolean;
}

interface UseGeolocationReturn extends GeolocationState {
  getCurrentPosition: () => Promise<Coordinates | null>;
  watchPosition: () => void;
  clearWatch: () => void;
}

/**
 * useGeolocation Hook
 * Provides access to device GPS coordinates
 */
export function useGeolocation(): UseGeolocationReturn {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    error: null,
    isLoading: false,
    isSupported: typeof window !== 'undefined' && 'geolocation' in navigator,
  });

  const [watchId, setWatchId] = useState<number | null>(null);

  /**
   * Get current position (one-time)
   */
  const getCurrentPosition = useCallback(async (): Promise<Coordinates | null> => {
    if (!state.isSupported) {
      const error = 'Geolocation is not supported by your browser';
      setState(prev => ({ ...prev, error, isLoading: false }));
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coordinates: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          setState(prev => ({
            ...prev,
            coordinates,
            isLoading: false,
            error: null,
          }));

          resolve(coordinates);
        },
        (error) => {
          let errorMessage = 'Unable to retrieve your location';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location access.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }

          setState(prev => ({
            ...prev,
            error: errorMessage,
            isLoading: false,
          }));

          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, [state.isSupported]);

  /**
   * Start watching position (continuous updates)
   */
  const watchPosition = useCallback(() => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: 'Geolocation is not supported' }));
      return;
    }

    if (watchId !== null) {
      return; // Already watching
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const coordinates: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setState(prev => ({
          ...prev,
          coordinates,
          isLoading: false,
          error: null,
        }));
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }

        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );

    setWatchId(id);
  }, [state.isSupported, watchId]);

  /**
   * Stop watching position
   */
  const clearWatch = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    ...state,
    getCurrentPosition,
    watchPosition,
    clearWatch,
  };
}
