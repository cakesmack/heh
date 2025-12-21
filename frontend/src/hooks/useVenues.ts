/**
 * useVenues Hook
 * Manages venues data fetching and state
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { VenueResponse, VenueFilter, VenueListResponse } from '@/types';

interface UseVenuesOptions {
  filters?: VenueFilter;
  autoFetch?: boolean;
}

interface UseVenuesReturn {
  venues: VenueResponse[];
  total: number;
  isLoading: boolean;
  error: string | null;
  fetchVenues: (newFilters?: VenueFilter) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * useVenues Hook
 * Fetch and manage venues list with filtering
 */
export function useVenues(options: UseVenuesOptions = {}): UseVenuesReturn {
  const { filters: initialFilters, autoFetch = true } = options;

  const [venues, setVenues] = useState<VenueResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<VenueFilter | undefined>(initialFilters);

  /**
   * Fetch venues from API
   */
  const fetchVenues = useCallback(async (newFilters?: VenueFilter) => {
    setIsLoading(true);
    setError(null);

    const filtersToUse = newFilters !== undefined ? newFilters : currentFilters;

    try {
      const response: VenueListResponse = await api.venues.list(filtersToUse);
      setVenues(response.venues);
      setTotal(response.total);
      setCurrentFilters(filtersToUse);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch venues';
      setError(errorMessage);
      setVenues([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentFilters]);

  /**
   * Refetch with current filters
   */
  const refetch = useCallback(async () => {
    return fetchVenues(currentFilters);
  }, [fetchVenues, currentFilters]);

  /**
   * Auto-fetch on mount if enabled
   */
  useEffect(() => {
    if (autoFetch) {
      fetchVenues();
    }
  }, []); // Only run on mount

  return {
    venues,
    total,
    isLoading,
    error,
    fetchVenues,
    refetch,
  };
}

/**
 * useVenue Hook
 * Fetch and manage a single venue
 */
export function useVenue(venueId: string | null) {
  const [venue, setVenue] = useState<VenueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVenue = useCallback(async () => {
    if (!venueId) {
      setVenue(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.venues.get(venueId);
      setVenue(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch venue';
      setError(errorMessage);
      setVenue(null);
    } finally {
      setIsLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchVenue();
  }, [fetchVenue]);

  return {
    venue,
    isLoading,
    error,
    refetch: fetchVenue,
  };
}
