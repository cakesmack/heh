import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useEvents } from '@/hooks/useEvents';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSearch } from '@/context/SearchContext';
import { EventList } from '@/components/events/EventList';
import DiscoveryBar from '@/components/home/DiscoveryBar';
import { EventFilter } from '@/types';
import { getDateRangeFromFilter } from '@/lib/dateUtils';

export default function EventsPage() {
  const router = useRouter();
  const { coordinates } = useGeolocation();
  const { openMobileSearch } = useSearch();
  const { events, total, isLoading, error, fetchEvents } = useEvents({ autoFetch: false });
  const [initialFilters, setInitialFilters] = useState<any>({});

  // Read URL params on mount and apply filters
  useEffect(() => {
    if (!router.isReady) return;

    const { category, q, age_restriction, date_from, date_to, location, latitude, longitude, radius, date } = router.query;

    const filters: Partial<EventFilter> & { location?: string; latitude?: number; longitude?: number } = {};
    // Pass category as category (slug) for API filtering
    if (category) filters.category = category as any;
    if (q) filters.q = q as string;
    if (age_restriction) filters.age_restriction = age_restriction as string;

    // Handle date logic
    if (date || date_from || date_to) {
      const dateRange = getDateRangeFromFilter(
        (date as string) || '',
        date_from as string,
        date_to as string
      );
      if (dateRange.date_from) filters.date_from = dateRange.date_from;
      if (dateRange.date_to) filters.date_to = dateRange.date_to;
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

    fetchEvents(filters);
  }, [router.isReady, router.query]);

  const handleSearch = async (filters: {
    q?: string;
    location?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    category?: string;
  }) => {

    // Update URL with new filters
    const query: Record<string, string> = {};
    if (filters.category) query.category = filters.category;
    if (filters.q) query.q = filters.q;
    if (filters.date) query.date = filters.date;
    if (filters.dateFrom) query.date_from = filters.dateFrom;
    if (filters.dateTo) query.date_to = filters.dateTo;
    if (filters.location) query.location = filters.location;

    router.push({ pathname: '/events', query }, undefined, { shallow: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Events</h1>
          <p className="text-gray-600">
            Discover events happening across the Scottish Highlands
          </p>
        </div>

        {/* Mobile Search Trigger */}
        <div className="md:hidden mb-6">
          <button
            onClick={openMobileSearch}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="font-medium">Search & Filter Events...</span>
            </span>
            <span className="bg-gray-100 p-1.5 rounded-md">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </span>
          </button>
        </div>

        {/* Search Bar (Desktop) */}
        <div className="mb-8">
          <DiscoveryBar
            onSearch={handleSearch}
            isLoading={isLoading}
            initialFilters={initialFilters}
            mode="embedded"
          />
        </div>

        {/* Events List */}
        <div>
          {/* Results Count */}
          {!isLoading && !error && (
            <div className="mb-6">
              <p className="text-sm text-gray-600">
                {total} event{total !== 1 ? 's' : ''} found
              </p>
            </div>
          )}

          <EventList events={events} isLoading={isLoading} error={error} />
        </div>
      </div>
    </div>
  );
}
