/**
 * useVenues Hook
 * Manages venues data fetching and state
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type { VenueResponse, VenueFilter, VenueListResponse } from '@/types';

interface UseVenuesOptions {
  filters?: VenueFilter;
  autoFetch?: boolean;
}

interface UseVenuesReturn {
  venues: VenueResponse[];
  total: number;
  totalCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  fetchVenues: (newFilters?: VenueFilter) => Promise<void>;
  fetchMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * useVenues Hook
 * Fetch and manage venues list with filtering
 */
export function useVenues(options: UseVenuesOptions = {}): UseVenuesReturn {
  const { filters: initialFilters, autoFetch = true } = options;

  const [venues, setVenues] = useState<VenueResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use a ref to track current filters so fetchVenues never needs
  // currentFilters in its dependency array (which caused the infinite loop).
  const filtersRef = useRef<VenueFilter | undefined>(initialFilters);
  // Track the current venue count for offset calculation in fetchMore
  const venuesRef = useRef<VenueResponse[]>([]);

  /**
   * Fetch venues from API (replaces current list — used for initial load & search changes).
   * Stable function identity — dependencies are empty so it never
   * gets recreated between renders and never re-triggers useEffect.
   */
  const fetchVenues = useCallback(async (newFilters?: VenueFilter) => {
    setIsLoading(true);
    setError(null);

    const filtersToUse = newFilters !== undefined ? newFilters : filtersRef.current;

    try {
      const response: VenueListResponse = await api.venues.list({
        ...filtersToUse,
        skip: 0,
      });
      setVenues(response.data);
      venuesRef.current = response.data;
      setTotalCount(response.total_count);
      filtersRef.current = filtersToUse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch venues';
      setError(errorMessage);
      setVenues([]);
      venuesRef.current = [];
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch the next page of venues and append to the existing list.
   */
  const fetchMore = useCallback(async () => {
    setIsLoadingMore(true);
    setError(null);

    try {
      const response: VenueListResponse = await api.venues.list({
        ...filtersRef.current,
        skip: venuesRef.current.length,
      });
      const merged = [...venuesRef.current, ...response.data];
      setVenues(merged);
      venuesRef.current = merged;
      setTotalCount(response.total_count);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more venues';
      setError(errorMessage);
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  /**
   * Refetch with current filters
   */
  const refetch = useCallback(async () => {
    return fetchVenues(filtersRef.current);
  }, [fetchVenues]);

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
    total: totalCount,
    totalCount,
    isLoading,
    isLoadingMore,
    error,
    fetchVenues,
    fetchMore,
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
