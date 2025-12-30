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
import { format, isSameDay, startOfDay } from 'date-fns';
import { eventsAPI, categoriesAPI } from '@/lib/api';
import type { EventResponse, Category } from '@/types';
import type { MapMarker } from '@/components/events/GoogleMapView';

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | undefined>(undefined);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));

  // Selected events for mobile modal (when tapping a marker)
  const [selectedEvents, setSelectedEvents] = useState<EventResponse[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
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

  // Filter events by category and date
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Category filter
      if (selectedCategory && event.category?.id !== selectedCategory) return false;

      // Date filter (Single Day)
      if (selectedDate && event.date_start) {
        return isSameDay(new Date(event.date_start), selectedDate);
      }

      return true;
    });
  }, [events, selectedCategory, selectedDate]);

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

  // Handle event card click
  const handleEventClick = (event: EventResponse) => {
    router.push(`/events/${event.id}`);
  };

  // Close mobile modal
  const closeMobileModal = () => {
    setSelectedEvents([]);
    setSelectedMarkerId(undefined);
  };

  return (
    // Height: 100vh minus header (64px) minus bottom nav on mobile (64px)
    <div className="flex flex-col h-[calc(100vh-128px)] md:h-[calc(100vh-64px)] bg-white overflow-hidden">
      {/* Header with Category Filter */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Event Map</h1>
            <p className="text-sm text-gray-500">
              {filteredEvents.length} events across the Scottish Highlands
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden sm:inline text-nowrap">Date:</span>
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setSelectedDate(startOfDay(new Date(val)));
                  }
                }}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden sm:inline text-nowrap">Filter:</span>
              <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
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
        </div>
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
          ) : filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg font-medium mb-2">No events found</p>
              <p className="text-sm">Try selecting a different category.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  id={`event-card-${event.id}`}
                  className={`p-4 cursor-pointer transition-all duration-200 ${selectedMarkerId === event.id
                    ? 'bg-emerald-50 border-l-4 border-emerald-500'
                    : hoveredEventId === event.id
                      ? 'bg-gray-100'
                      : 'bg-white hover:bg-gray-50'
                    }`}
                  onClick={() => handleEventClick(event)}
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
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 mt-1">
                          {event.category.name}
                        </span>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        {event.date_start ? format(new Date(event.date_start), 'EEE, MMM d') : 'Date TBD'}
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
            onEventClick={(event) => {
              setSelectedMarkerId(event.id);

              // On desktop, scroll to list item
              if (!isMobile) {
                const card = document.getElementById(`event-card-${event.id}`);
                if (card) {
                  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              } else {
                // On mobile, find all events at this location/day (with coordinate safety check)
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
            className="absolute inset-0"
          />

          {/* Mobile Event Preview Card - shows when marker is tapped on mobile */}
          {selectedEvents.length > 0 && isMobile && (
            <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-2xl z-30 md:hidden animate-in slide-in-from-bottom-10 fade-in duration-300 pb-safe max-h-[70vh] flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white rounded-t-xl">
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
              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {selectedEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => router.push(`/events/${event.id}`)}
                    className="flex gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-100"
                  >
                    {/* Thumbnail */}
                    <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                      {event.image_url ? (
                        <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Basic Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h4 className="font-semibold text-gray-900 text-sm truncate leading-snug">{event.title}</h4>
                      <p className="text-xs text-emerald-600 font-medium mt-0.5">
                        {event.date_start ? format(new Date(event.date_start), 'h:mm a') : 'Time TBD'}
                      </p>
                      {event.venue_name && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{event.venue_name}</p>
                      )}
                    </div>

                    <div className="flex items-center pr-1">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer action if single event */}
              {selectedEvents.length === 1 && (
                <div className="p-4 pt-2 border-t border-gray-50 bg-gray-50/50 rounded-b-xl">
                  <button
                    onClick={() => router.push(`/events/${selectedEvents[0].id}`)}
                    className="w-full bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors text-sm"
                  >
                    View Details
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default MapPage;
