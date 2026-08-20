import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSearch } from '@/context/SearchContext';
import { EventList } from '@/components/events/EventList';
import DiscoveryBar from '@/components/home/DiscoveryBar';
import { FilterBar } from '@/components/search/FilterBar';
import CategoryGrid from '@/components/categories/CategoryGrid';
import PopularLocations from '@/components/PopularLocations';
import { EventFilter, EventResponse } from '@/types';
import { getDateRangeFromFilter } from '@/lib/dateUtils';
import { eventsAPI } from '@/lib/api';

const EVENTS_PER_PAGE = 12;

export default function EventsPage() {
  const router = useRouter();
  const { coordinates } = useGeolocation();
  const { openMobileSearch } = useSearch();

  // Events state
  const [displayedEvents, setDisplayedEvents] = useState<EventResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<EventFilter>({});
  const [initialFilters, setInitialFilters] = useState<any>({});

  // Ref for infinite scroll sentinel
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch events with current filters
  const fetchEvents = useCallback(async (filters: EventFilter, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setDisplayedEvents([]);
    }
    setError(null);

    try {
      console.log("Fetching events with payload:", JSON.stringify({
        ...filters,
        limit: EVENTS_PER_PAGE,
        skip: append ? displayedEvents.length : 0,
      }));
      const response = await eventsAPI.list({
        ...filters,
        limit: EVENTS_PER_PAGE,
        skip: append ? displayedEvents.length : 0,
      });

      if (append) {
        setDisplayedEvents(prev => [...prev, ...response.events]);
      } else {
        setDisplayedEvents(response.events);
      }
      setTotal(response.total);
      setCurrentFilters(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [displayedEvents.length]);

  // Read URL params on mount and apply filters
  useEffect(() => {
    if (!router.isReady) return;

    const { category, q, tag, tag_names, age_restriction, date_from, date_to, location, latitude, longitude, radius, date } = router.query;

    const filters: Partial<EventFilter> & { location?: string; latitude?: number; longitude?: number } = {};
    // Pass category as category (slug) for API filtering
    if (category) filters.category = category as any;
    if (q) filters.q = q as string;
    if (tag) filters.tag = tag as string;
    if (tag_names) filters.tag_names = (tag_names as string).split(',');
    if (age_restriction) filters.age_restriction = age_restriction as string;
    if (router.query.is_recurring) filters.is_recurring = router.query.is_recurring === 'true';

    // Handle date logic
    if (date || date_from || date_to) {
      if (date && date !== 'custom') {
        // Phase 2 Fix: Pass predefined date filters to API's time_range mapping
        filters.date = date as string;
      } else {
        const dateRange = getDateRangeFromFilter(
          (date as string) || '',
          date_from as string,
          date_to as string
        );
        if (dateRange.date_from) filters.date_from = dateRange.date_from;
        if (dateRange.date_to) filters.date_to = dateRange.date_to;
      }
    }

    // Location
    if (location) filters.location = location as string;
    if (latitude) filters.latitude = parseFloat(latitude as string);
    if (longitude) filters.longitude = parseFloat(longitude as string);
    if (radius) filters.radius_km = parseFloat(radius as string);

    // Set initial filters for DiscoveryBar
    setInitialFilters({
      q: filters.q,
      category: filters.category as any,
      location: filters.location,
      date: date as string,
      dateFrom: date_from as string,
      dateTo: date_to as string
    });

    fetchEvents(filters as EventFilter);
  }, [router.isReady, router.query]);

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    const hasMore = displayedEvents.length < total;
    if (!loadMoreRef.current || isLoadingMore || isLoading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          fetchEvents(currentFilters, true);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [displayedEvents.length, total, isLoadingMore, isLoading, currentFilters, fetchEvents]);

  const handleSearch = async (filters: {
    q?: string;
    location?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    category?: string;
    latitude?: number;
    longitude?: number;
    radius?: string;
  }) => {

    // Update URL with new filters (including GPS params if present)
    const query: Record<string, string> = {};
    if (filters.category) query.category = filters.category;
    if (filters.q) query.q = filters.q;
    if (filters.date) query.date = filters.date;
    if (filters.dateFrom) query.date_from = filters.dateFrom;
    if (filters.dateTo) query.date_to = filters.dateTo;
    if (filters.location) query.location = filters.location;

    // GPS coordinates from Near Me
    if (filters.latitude) query.latitude = filters.latitude.toFixed(6);
    if (filters.longitude) query.longitude = filters.longitude.toFixed(6);
    if (filters.radius) query.radius = filters.radius;

    router.push({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
  };

  const hasMore = displayedEvents.length < total;

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8 pb-20 md:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-3 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">Events</h1>
          <p className="text-xs md:text-sm text-gray-600">
            Discover events happening across the Scottish Highlands
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-3 md:mb-8">
          <DiscoveryBar
            onSearch={handleSearch}
            isLoading={isLoading}
            initialFilters={initialFilters}
            mode="embedded"
            hideCategory={true}
            variant="light"
          />
        </div>

        {/* Category & Location scrolling pills */}
        <div className="space-y-1.5 md:space-y-4 mb-3 md:mb-8">
          <CategoryGrid
            activeCategory={currentFilters.category}
            onSelectCategory={(slug) => {
              const newCategory = currentFilters.category === slug ? undefined : slug;
              handleSearch({ ...currentFilters, category: newCategory });
            }}
          />
          <PopularLocations
            activeLocation={currentFilters.location}
            categorySlug={currentFilters.category}
          />
        </div>

        {/* Sticky Filter Bar */}
        <FilterBar
          activeDate={currentFilters.date}
          activeRadius={currentFilters.radius_km ? String(currentFilters.radius_km) : undefined}
          activeCategory={currentFilters.category}
          onFilterChange={(newFilters) => {
            handleSearch({
              ...currentFilters,
              date: newFilters.date,
              radius: newFilters.radius,
              category: newFilters.category,
            });
          }}
        />

        {/* Events List */}
        <div>
          {/* Results Count */}
          {!isLoading && !error && (
            <div className="mb-6">
              <p className="text-sm text-gray-600">
                Showing {displayedEvents.length} of {total} event{total !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          <EventList events={displayedEvents} isLoading={isLoading} error={error} />

          {/* Infinite Scroll Sentinel & Loading Indicator */}
          {hasMore && !isLoading && !error && (
            <div ref={loadMoreRef} className="mt-8 flex justify-center py-4">
              {isLoadingMore && (
                <div className="flex items-center gap-2 text-gray-500">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span>Loading more events...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


