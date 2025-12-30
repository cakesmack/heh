/**
 * Map Page
 * Interactive map showing events across the Scottish Highlands
 * Features: Side panel with event list, hover interaction, date filtering, viewport sync
 * Responsive: Mobile shows map only, Desktop shows split view (list + map)
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { format, isSameDay, startOfDay } from 'date-fns';
import { eventsAPI, categoriesAPI } from '@/lib/api';
import type { EventResponse, Category } from '@/types';
import type { MapMarker, MapBounds } from '@/components/events/GoogleMapView';
import MapFilterBar from '@/components/map/MapFilterBar';

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

export default function MapPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | undefined>(undefined);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  // Date filter state - default to today
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));

  // Viewport bounds state for list sync
  const [viewportBounds, setViewportBounds] = useState<MapBounds | null>(null);

  // Selected event for mobile modal (when tapping a marker)
  const [selectedEvent, setSelectedEvent] = useState<EventResponse | null>(null);

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch events and categories
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [eventsResponse, categoriesResponse] = await Promise.all([
          eventsAPI.list({ limit: 500 }),
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
  }, []);

  // Filter events by category AND date
  const filteredEvents = useMemo(() => {
    let result = events;

    // Filter by category
    if (selectedCategory) {
      result = result.filter(event => event.category?.id === selectedCategory);
    }

    // Filter by date (same calendar day)
    result = result.filter(event => {
      if (!event.date_start) return false;
      return isSameDay(new Date(event.date_start), selectedDate);
    });

    return result;
  }, [events, selectedCategory, selectedDate]);

  // Further filter by viewport bounds for the sidebar list
  const visibleEvents = useMemo(() => {
    if (!viewportBounds) return filteredEvents;

    return filteredEvents.filter(event => {
      if (!event.latitude || !event.longitude) return false;

      const inLatBounds = event.latitude >= viewportBounds.south && event.latitude <= viewportBounds.north;
      const inLngBounds = event.longitude >= viewportBounds.west && event.longitude <= viewportBounds.east;

      return inLatBounds && inLngBounds;
    });
  }, [filteredEvents, viewportBounds]);

  // Handle bounds change from map
  const handleBoundsChanged = useCallback((bounds: MapBounds) => {
    setViewportBounds(bounds);
  }, []);

  // Handle marker click
  const handleMarkerClick = useCallback((marker: MapMarker) => {
    setSelectedMarkerId(marker.id);

    // Find event details
    const event = events.find(e => e.id === marker.id);
    if (event) {
      setSelectedEvent(event);
    }

    // On desktop, scroll to list item
    if (window.innerWidth >= 1024) {
      const card = document.getElementById(`event-card-${marker.id}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [events]);

  // Handle event click directly from marker
  const handleEventClick = useCallback((event: EventResponse) => {
    setSelectedMarkerId(event.id);
    setSelectedEvent(event);

    // On desktop, scroll to list item
    if (window.innerWidth >= 1024) {
      const card = document.getElementById(`event-card-${event.id}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, []);

  // Handle event card click
  const handleEventCardClick = (event: EventResponse) => {
    router.push(`/events/${event.id}`);
  };

  // Close mobile modal
  const closeMobileModal = () => {
    setSelectedEvent(null);
    setSelectedMarkerId(undefined);
  };

  return (
    // Height: 100vh minus header (64px) minus bottom nav on mobile (64px)
    <div className="flex flex-col h-[calc(100vh-128px)] md:h-[calc(100vh-64px)] bg-white overflow-hidden">
      {/* Filter Bar with Date Picker and Categories */}
      <MapFilterBar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />

      {/* Header - Event Count */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2">
        <p className="text-sm text-gray-500">
          {loading ? 'Loading...' : (
            <>
              <span className="font-medium text-gray-900">{filteredEvents.length}</span> events on{' '}
              <span className="font-medium text-gray-900">{format(selectedDate, 'EEEE, MMM d')}</span>
              {viewportBounds && visibleEvents.length !== filteredEvents.length && (
                <span className="text-gray-400">
                  {' '}• {visibleEvents.length} in view
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Main Content - Split View (Desktop) / Map Only (Mobile) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative h-full">
        {/* Left Panel - Event List: Hidden on mobile/tablet, visible on desktop (lg+) */}
        <aside className="hidden lg:flex lg:flex-col lg:w-[380px] xl:w-[420px] flex-shrink-0 overflow-y-auto bg-gray-50 border-r border-gray-200">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent mx-auto mb-4" />
              <p className="text-gray-500">Loading events...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">{error}</div>
          ) : visibleEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg font-medium mb-2">No events in this area</p>
              <p className="text-sm">Try zooming out or selecting a different date.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {visibleEvents.map((event) => (
                <div
                  key={event.id}
                  id={`event-card-${event.id}`}
                  className={`p-4 cursor-pointer transition-all duration-200 ${selectedMarkerId === event.id
                    ? 'bg-emerald-50 border-l-4 border-emerald-500'
                    : hoveredEventId === event.id
                      ? 'bg-gray-100'
                      : 'bg-white hover:bg-gray-50'
                    }`}
                  onClick={() => handleEventCardClick(event)}
                  onMouseEnter={() => setHoveredEventId(event.id)}
                  onMouseLeave={() => setHoveredEventId(null)}
                >
                  <div className="flex gap-3">
                    {/* Event Image */}
                    <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200">
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
                      {event.category && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: event.category.gradient_color || '#6b7280' }}
                          />
                          <span className="text-xs font-medium text-gray-600">
                            {event.category.name}
                          </span>
                        </div>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        {event.date_start ? format(new Date(event.date_start), 'h:mm a') : 'Time TBD'}
                      </p>
                      {event.venue_name && (
                        <p className="text-sm text-gray-500 truncate">{event.venue_name}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Right Panel - Map: Full width on mobile, shares space on desktop */}
        <div className="flex-1 relative">
          <GoogleMapView
            events={filteredEvents}
            venues={[]}
            showEvents={true}
            showVenues={false}
            onMarkerClick={handleMarkerClick}
            onEventClick={handleEventClick}
            selectedMarkerId={selectedMarkerId}
            hoveredEventId={hoveredEventId}
            onBoundsChanged={handleBoundsChanged}
            isMobile={isMobile}
            className="absolute inset-0"
          />

          {/* Mobile Event Preview Modal - shows when marker is tapped on mobile */}
          {selectedEvent && (
            <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-xl z-20 md:hidden animate-in slide-in-from-bottom-10 fade-in duration-200 pb-safe">
              <div className="p-4">
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200">
                    {selectedEvent.image_url ? (
                      <img
                        src={selectedEvent.image_url}
                        alt={selectedEvent.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-gray-900 truncate pr-6">{selectedEvent.title}</h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeMobileModal();
                        }}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <p className="text-sm text-emerald-600 font-medium mt-1">
                      {selectedEvent.date_start ? format(new Date(selectedEvent.date_start), 'EEE, MMM d • h:mm a') : 'Date TBD'}
                    </p>

                    {selectedEvent.venue_name && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">{selectedEvent.venue_name}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => router.push(`/events/${selectedEvent.id}`)}
                    className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                  >
                    Go to Event
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
