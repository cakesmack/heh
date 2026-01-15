/**
 * useEvents Hook
 * Manages events data fetching and state
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { EventResponse, EventFilter, EventListResponse } from '@/types';

// ... (imports)

interface UseEventsOptions {
  filters?: EventFilter;
  autoFetch?: boolean;
  limit?: number; // Add limit option
}

interface UseEventsReturn {
  events: EventResponse[];
  total: number;
  isLoading: boolean;
  error: string | null;
  fetchEvents: (newFilters?: EventFilter) => Promise<void>;
  refetch: () => Promise<void>;

  // Pagination
  loadMore: () => Promise<void>;
  hasMore: boolean;
  isLoadingMore: boolean;
}

/**
 * useEvents Hook
 * Fetch and manage events list with filtering
 */
export function useEvents(options: UseEventsOptions = {}): UseEventsReturn {
  const { filters: initialFilters, autoFetch = true, limit = 20 } = options;

  const [events, setEvents] = useState<EventResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<EventFilter | undefined>(initialFilters);
  const [hasMore, setHasMore] = useState(true);

  /**
   * Fetch events from API (Initial / Reset)
   */
  const fetchEvents = useCallback(async (newFilters?: EventFilter) => {
    setIsLoading(true);
    setError(null);
    setHasMore(true); // Reset hasMore on new search

    const filtersToUse = newFilters !== undefined ? newFilters : currentFilters;

    try {
      // Use skip from filters if provided, otherwise default to 0
      const response: EventListResponse = await api.events.list({
        ...filtersToUse,
        skip: filtersToUse?.skip || 0,
        limit
      });

      setEvents(response.events);
      setTotal(response.total);
      setCurrentFilters(filtersToUse);

      // Update hasMore based on result size
      setHasMore(response.events.length >= limit);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch events';
      setError(errorMessage);
      setEvents([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [currentFilters, limit]);

  /**
   * Load next page of events
   */
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoading) return;

    setIsLoadingMore(true);

    try {
      const skip = events.length;
      const response: EventListResponse = await api.events.list({
        ...currentFilters,
        skip,
        limit
      });

      if (response.events.length > 0) {
        setEvents(prev => [...prev, ...response.events]);

        // If we got fewer than limit, we reached the end
        if (response.events.length < limit) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }

    } catch (err) {
      console.error("Failed to load more events", err);
      // Don't set main error state for pagination failure, just stop trying
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [events.length, currentFilters, hasMore, isLoading, isLoadingMore, limit]);

  /**
   * Refetch with current filters
   */
  const refetch = useCallback(async () => {
    return fetchEvents(currentFilters);
  }, [fetchEvents, currentFilters]);

  /**
   * Auto-fetch on mount if enabled
   */
  useEffect(() => {
    if (autoFetch) {
      fetchEvents();
    }
  }, []); // Only run on mount

  return {
    events,
    total,
    isLoading,
    error,
    fetchEvents,
    refetch,
    loadMore,
    hasMore,
    isLoadingMore
  };
}

/**
 * useEvent Hook
 * Fetch and manage a single event
 */
export function useEvent(eventId: string | null) {
  const [event, setEvent] = useState<EventResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!eventId) {
      setEvent(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.events.get(eventId);
      setEvent(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch event';
      setError(errorMessage);
      setEvent(null);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return {
    event,
    isLoading,
    error,
    refetch: fetchEvent,
  };
}
