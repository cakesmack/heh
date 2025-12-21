/**
 * useEvents Hook
 * Manages events data fetching and state
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { EventResponse, EventFilter, EventListResponse } from '@/types';

interface UseEventsOptions {
  filters?: EventFilter;
  autoFetch?: boolean;
}

interface UseEventsReturn {
  events: EventResponse[];
  total: number;
  isLoading: boolean;
  error: string | null;
  fetchEvents: (newFilters?: EventFilter) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * useEvents Hook
 * Fetch and manage events list with filtering
 */
export function useEvents(options: UseEventsOptions = {}): UseEventsReturn {
  const { filters: initialFilters, autoFetch = true } = options;

  const [events, setEvents] = useState<EventResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<EventFilter | undefined>(initialFilters);

  /**
   * Fetch events from API
   */
  const fetchEvents = useCallback(async (newFilters?: EventFilter) => {
    setIsLoading(true);
    setError(null);

    const filtersToUse = newFilters !== undefined ? newFilters : currentFilters;

    try {
      const response: EventListResponse = await api.events.list(filtersToUse);
      setEvents(response.events);
      setTotal(response.total);
      setCurrentFilters(filtersToUse);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch events';
      setError(errorMessage);
      setEvents([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentFilters]);

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
