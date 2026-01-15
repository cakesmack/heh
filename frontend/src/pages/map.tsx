/**
 * Map Page
 * Interactive map showing events across the Scottish Highlands
 * Features: Side panel with event list, hover interaction, events-only view
 * Responsive: Mobile shows map only, Desktop shows split view (list + map)
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { format, isSameDay, startOfDay, endOfDay, addDays, nextSaturday, nextSunday } from 'date-fns';
import { eventsAPI, categoriesAPI } from '@/lib/api';
import type { EventResponse, Category } from '@/types';
import type { MapMarker } from '@/components/events/GoogleMapView';
import MapDateFilter, { DateRange } from '@/components/map/MapDateFilter';
import MapSidebar from '@/components/map/MapSidebar';
import MapEventCard from '@/components/map/MapEventCard'; // For mobile modal

// Dynamically import GoogleMapView to avoid SSR issues
const GoogleMapView = dynamic(() => import('@/components/events/GoogleMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mx-auto mb-4" />
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});

export function MapPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const today = startOfDay(new Date());

  // Date Range State
  // Explicitly default to Next 7 Days (Backend no longer does this automatically)
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: today,
    end: endOfDay(addDays(today, 7)) // Default: Next 7 Days
  });
  const [selectedRangeId, setSelectedRangeId] = useState<string>('week');
  const [customDate, setCustomDate] = useState<string>(''); // For custom date picker

  // Map Interaction State
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | undefined>(undefined);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  // Selected events for mobile modal (when tapping a marker)
  const [selectedEvents, setSelectedEvents] = useState<EventResponse[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Focus event ID for "View on Map" feature
  const [focusEventId, setFocusEventId] = useState<string | null>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle Date Range Selection
  const handleRangeSelect = (range: DateRange) => {
    setSelectedRangeId(range.id);
    setDateRange({ start: range.start, end: range.end });
    setCustomDate(''); // Clear custom date picker
  };

  // Handle Custom Date Picker
  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomDate(val);
    if (val) {
      const date = startOfDay(new Date(val));
      setDateRange({ start: date, end: endOfDay(date) });
      setSelectedRangeId('custom');
    }
  };

  // Fetch events and categories
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Build filter params
        const eventFilters: { limit: number; date_from?: string; date_to?: string } = {
          limit: 500,
          date_from: dateRange.start.toISOString(),
          date_to: dateRange.end.toISOString(),
        };

        const [eventsResponse, categoriesResponse] = await Promise.all([
          eventsAPI.list(eventFilters),
          categoriesAPI.list(),
        ]);

        setEvents(eventsResponse.events);
        setCategories(categoriesResponse.categories);
      } catch (err) {
        console.error('Failed to fetch map data:', err);
        setError('Failed to load map data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [dateRange]); // Refetch when date range changes

  // Clear selected event when date/category changes
  useEffect(() => {
    setSelectedEvents([]);
    setSelectedMarkerId(undefined);
  }, [dateRange, selectedCategory]);

  // Filter events by category locally
  // (Date filtering is handled by backend refetch for efficiency/correctness with recurrence)
  const filteredEvents = useMemo(() => {
    if (!selectedCategory) return events;
    return events.filter(event => event.category?.id === selectedCategory);
  }, [events, selectedCategory]);

  // Handle marker click
  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedMarkerId(marker.id);

    // Find event details
    const event = events.find(e => e.id === marker.id);
    if (event) {
      if (isMobile) {
        // On mobile, find all events at this location (with coordinate safety check)
        const eventsAtLocation = filteredEvents.filter(e =>
          e.latitude != null && e.longitude != null &&
          event.latitude != null && event.longitude != null &&
          Math.abs(e.latitude - event.latitude) < 0.0001 &&
          Math.abs(e.longitude - event.longitude) < 0.0001
        );
        setSelectedEvents(eventsAtLocation);
      } else {
        setSelectedEvents([event]);
      }
    }

    // On desktop, scroll to list item
    if (window.innerWidth >= 768) {
      const card = document.getElementById(`event-card-${marker.id}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Close mobile modal
  const closeMobileModal = () => {
    setSelectedEvents([]);
    setSelectedMarkerId(undefined);
  };

  return (
    // Height: 100vh minus header (64px) minus bottom nav on mobile (64px)
    <div className="flex flex-col h-[calc(100vh-128px)] md:h-[calc(100vh-64px)] bg-white overflow-hidden">
      {/* Header with Filters */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 z-20 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">

          {/* Top Row: Title + Category (Mobile optimized) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900 hidden md:block">Event Map</h1>

              {/* Category Filter */}
              <div className="relative">
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="text-sm font-medium border-none bg-gray-100/50 rounded-full px-4 py-1.5 pr-8 focus:ring-2 focus:ring-emerald-500 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mobile Title Spacer */}
            <div className="md:hidden"></div>
          </div>

          {/* Date Filter Pills & Custom Picker */}
          <div className="flex items-center gap-4">
            <MapDateFilter
              selectedRangeId={selectedRangeId}
              onRangeSelect={handleRangeSelect}
              currentDateRange={dateRange}
            />
          </div>

        </div>
      </div>

      {/* Main Content - Split View (Desktop) / Map Only (Mobile) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative h-full">

        {/* Left Panel - Event List Sidebar */}
        <MapSidebar
          events={filteredEvents}
          loading={loading}
          error={error}
          selectedMarkerId={selectedMarkerId}
          hoveredEventId={hoveredEventId}
          onEventClick={(event) => {
            router.push(`/events/${event.id}`);
          }}
          onHover={(eventId) => setHoveredEventId(eventId)}
        />

        {/* Right Panel - Map */}
        <div className="flex-1 relative">
          <GoogleMapView
            events={filteredEvents}
            venues={[]}
            showEvents={true}
            showVenues={false}
            onMarkerClick={handleMarkerClick}
            onMapClick={closeMobileModal}
            onEventClick={(event) => {
              setSelectedMarkerId(event.id);

              // On desktop, scroll to list item
              if (!isMobile) {
                const card = document.getElementById(`event-card-${event.id}`);
                if (card) {
                  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              } else {
                // On mobile, find all events at this location/day
                const eventsAtLocation = filteredEvents.filter(e =>
                  e.latitude != null && e.longitude != null &&
                  event.latitude != null && event.longitude != null &&
                  Math.abs(e.latitude - event.latitude) < 0.0001 &&
                  Math.abs(e.longitude - event.longitude) < 0.0001
                );
                setSelectedEvents(eventsAtLocation);
              }
            }}
            selectedMarkerId={selectedMarkerId}
            hoveredEventId={hoveredEventId}
            isMobile={isMobile}
            focusEventId={focusEventId}
            onFocusComplete={() => setFocusEventId(null)}
            className="absolute inset-0"
          />

          {/* Mobile Event Preview Card - shows when marker is tapped on mobile */}
          {selectedEvents.length > 0 && isMobile && (
            <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-2xl z-30 md:hidden animate-in slide-in-from-bottom-10 fade-in duration-300 pb-safe max-h-[70vh] flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white rounded-t-xl z-20">
                <h3 className="font-bold text-gray-900">
                  {selectedEvents.length} {selectedEvents.length === 1 ? 'Event' : 'Events'} at this location
                </h3>
                <button
                  onClick={closeMobileModal}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Event List */}
              <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {selectedEvents.map((event) => (
                  <MapEventCard
                    key={event.id}
                    event={event}
                    onClick={() => router.push(`/events/${event.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default MapPage;
