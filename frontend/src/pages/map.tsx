/**
 * Map Page
 * Interactive map showing events across the Scottish Highlands
 * Features: Side panel with event list, hover interaction, events-only view
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { eventsAPI, categoriesAPI } from '@/lib/api';
import type { EventResponse, Category } from '@/types';
import type { MapMarker } from '@/components/events/MapView';

// Dynamically import MapView to avoid SSR issues with Mapbox
const MapView = dynamic(() => import('@/components/events/MapView'), {
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

  // Filter events by category
  const filteredEvents = useMemo(() => {
    if (!selectedCategory) return events;
    return events.filter(event => event.category?.id === selectedCategory);
  }, [events, selectedCategory]);

  // Handle marker click
  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedMarkerId(marker.id);
    // Scroll to the event card in the list
    const card = document.getElementById(`event-card-${marker.id}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Handle event card click
  const handleEventClick = (event: EventResponse) => {
    router.push(`/events/${event.id}`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-white overflow-hidden">
      {/* Header with Category Filter */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Event Map</h1>
            <p className="text-sm text-gray-500">
              {filteredEvents.length} events across the Scottish Highlands
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filter:</span>
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Event List */}
        <div className="w-[380px] lg:w-[420px] flex-shrink-0 overflow-y-auto bg-gray-50 border-r border-gray-200">
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
        </div>

        {/* Right Panel - Map */}
        <div className="flex-1 relative">
          <MapView
            events={filteredEvents}
            venues={[]}
            showEvents={true}
            showVenues={false}
            onMarkerClick={handleMarkerClick}
            selectedMarkerId={selectedMarkerId}
            hoveredEventId={hoveredEventId}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
