/**
 * useCheckIn Hook
 * Manages check-in operations and state
 */

'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useGeolocation } from './useGeolocation';
import type { CheckInResponse } from '@/types';

interface UseCheckInReturn {
  isCheckingIn: boolean;
  checkInError: string | null;
  checkInResponse: CheckInResponse | null;
  performCheckIn: (eventId: string) => Promise<CheckInResponse | null>;
  clearCheckInState: () => void;
}

/**
 * useCheckIn Hook
 * Handle event check-in with automatic location detection
 */
export function useCheckIn(): UseCheckInReturn {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInResponse, setCheckInResponse] = useState<CheckInResponse | null>(null);

  const { getCurrentPosition } = useGeolocation();

  /**
   * Perform check-in to an event
   */
  const performCheckIn = useCallback(
    async (eventId: string): Promise<CheckInResponse | null> => {
      setIsCheckingIn(true);
      setCheckInError(null);
      setCheckInResponse(null);

      try {
        // Get current location
        const coordinates = await getCurrentPosition();

        if (!coordinates) {
          throw new Error('Unable to get your location. Please enable location services.');
        }

        // Perform check-in
        const response = await api.checkIns.checkIn(eventId, {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          device_time: new Date().toISOString(),
        });

        setCheckInResponse(response);
        return response;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Check-in failed';
        setCheckInError(errorMessage);
        return null;
      } finally {
        setIsCheckingIn(false);
      }
    },
    [getCurrentPosition]
  );

  /**
   * Clear check-in state
   */
  const clearCheckInState = useCallback(() => {
    setCheckInError(null);
    setCheckInResponse(null);
  }, []);

  return {
    isCheckingIn,
    checkInError,
    checkInResponse,
    performCheckIn,
    clearCheckInState,
  };
}
