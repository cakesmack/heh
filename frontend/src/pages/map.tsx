/**
 * Map Page
 * Interactive map showing events across the Scottish Highlands
 * Features: Side panel with event list, hover interaction, events-only view
 * Responsive: Mobile shows map only, Desktop shows split view (list + map)
 */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { format, isSameDay, startOfDay, endOfDay, addDays, nextSaturday, nextSunday } from 'date-fns';
import { eventsAPI, categoriesAPI, collectionsAPI, venuesAPI } from '@/lib/api';
import type { EventResponse, Category, Collection } from '@/types';
import type { MapMarker } from '@/components/events/GoogleMapView';
import MapDateFilter, { DateRange } from '@/components/map/MapDateFilter';
import MapSidebar from '@/components/map/MapSidebar';
import MapEventCard from '@/components/map/MapEventCard'; // For mobile modal
// ErrorBoundary defined inline to resolve build import issues
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-4 min-h-[300px]">
          <div className="bg-white p-6 rounded-lg shadow-md max-w-md text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Map Temporarily Unavailable</h2>
            <p className="text-gray-500 mb-4">We encountered an issue displaying the map. Please look at the list view or try refreshing the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionSlug, setSelectedCollectionSlug] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [mapMode, setMapMode] = useState<'events' | 'venues'>('events');
  const [venues, setVenues] = useState<any[]>([]);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const today = startOfDay(new Date());

  // Date Range State
  // Explicitly default to Next 7 Days (Backend no longer does this automatically)
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: today,
    end: endOfDay(addDays(today, 7)) // Optimized: Default to Next 7 Days for performance
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

  // Fetch events, categories, collections, or venues
  useEffect(() => {
    if (!router.isReady) return;

    // Handle initial URL sync before first fetch
    if (!isInitialized) {
      if (router.query.collection) {
        setSelectedCollectionSlug(router.query.collection as string);
        setSelectedCategory(null);
        setIsInitialized(true);
        // We return here because the state updates above will trigger this effect again
        return;
      }
      setIsInitialized(true);
    }

    async function fetchData() {
      setLoading(true);
      setError(null);

      // Clear current markers to prevent leakage
      setEvents([]);
      setVenues([]);

      try {
        if (mapMode === 'events') {
          // Build filter params
          const eventFilters: any = {
            limit: 500,
            date_from: dateRange.start.toISOString(),
            date_to: dateRange.end.toISOString(),
          };

          // Fetch categories and collections if not already loaded
          const promises: Promise<any>[] = [];
          if (categories.length === 0) promises.push(categoriesAPI.list());
          if (collections.length === 0) promises.push(collectionsAPI.list({ show_on_map: true }));

          const results = await Promise.all(promises);

          // REFINED: Index-based handling is safer since we know the order we pushed
          let resultIdx = 0;
          if (categories.length === 0) {
            const res = results[resultIdx++];
            if (res) {
              const cats = res.categories || (Array.isArray(res) ? res : []);
              setCategories(cats);
            }
          }
          if (collections.length === 0) {
            const res = results[resultIdx++];
            if (res) {
              const cols = res.collections || (Array.isArray(res) ? res : []);
              setCollections(cols);
            }
          }

          // Current collections state might be empty on first run, use results if needed
          const fetchedCollections = (collections.length === 0 && results.length > 0)
            ? (categories.length === 0 // If categories were also fetched
              ? (results[1]?.collections || (Array.isArray(results[1]) ? results[1] : [])) // Collections are at index 1
              : (results[0]?.collections || (Array.isArray(results[0]) ? results[0] : []))) // Collections are at index 0
            : [];

          const currentCollections = collections.length > 0 ? collections : fetchedCollections;

          // Mutual Exclusivity Logic: Collections take priority
          const activeCollection = selectedCollectionSlug
            ? currentCollections.find((c: Collection) => c.slug === selectedCollectionSlug)
            : null;

          if (activeCollection) {
            // Merge collection's filter_params
            if (activeCollection.filter_params) {
              Object.entries(activeCollection.filter_params).forEach(([key, value]) => {
                if (key === 'q') eventFilters.q = value;
              });
            }
          } else if (selectedCategory) {
            eventFilters.category_id = selectedCategory;
          }

          const eventsResponse = await eventsAPI.listMap(eventFilters);

          // Cast to EventResponse[] as MapEventResponse is a compatible subset
          setEvents(eventsResponse as unknown as EventResponse[]);
        } else {
          // Venues mode: fetch verified venues only
          const venuesResponse = await venuesAPI.listMap();
          setVenues(venuesResponse);
        }
      } catch (err) {
        console.error('Failed to fetch map data:', err);
        setError('Failed to load map data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router.isReady, isInitialized, dateRange, selectedCategory, selectedCollectionSlug, mapMode]); // Refetch when filters or mapMode change

  // Synchronize state back to URL (Two-way binding)
  useEffect(() => {
    if (!router.isReady || !isInitialized) return;

    const currentCollectionInUrl = router.query.collection as string || null;

    if (selectedCollectionSlug !== currentCollectionInUrl) {
      const newQuery = { ...router.query };

      if (selectedCollectionSlug) {
        newQuery.collection = selectedCollectionSlug;
      } else {
        delete newQuery.collection;
      }

      router.replace(
        {
          pathname: router.pathname,
          query: newQuery,
        },
        undefined,
        { shallow: true }
      );
    }
  }, [selectedCollectionSlug, isInitialized, router.isReady]);
  useEffect(() => {
    setSelectedEvents([]);
    setSelectedMarkerId(undefined);
  }, [dateRange, selectedCategory, mapMode]);

  // Filter events by category locally
  // (Date filtering is handled by backend refetch for efficiency/correctness with recurrence)
  const filteredEvents = useMemo(() => {
    // Base list of events to filter
    const baseEvents = selectedCategory
      ? events.filter(event => event.category?.id === selectedCategory)
      : events;

    // STRICT DEFENSIVE CODING: Filter out invalid coordinates to prevent map crashes
    return baseEvents.filter(e =>
      typeof e.latitude === 'number' &&
      typeof e.longitude === 'number' &&
      !isNaN(e.latitude) &&
      !isNaN(e.longitude)
    );
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
              <h1 className="text-xl font-bold text-gray-900 hidden md:block">Interactive Map</h1>

              {/* Mode Toggle */}
              <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                <button
                  onClick={() => setMapMode('events')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                    mapMode === 'events'
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-950'
                  }`}
                >
                  Events
                </button>
                <button
                  onClick={() => setMapMode('venues')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                    mapMode === 'venues'
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-950'
                  }`}
                >
                  Venues
                </button>
              </div>

              {mapMode === 'events' && (
                <>
                  {/* Collection Filter */}
                  <div className="relative">
                    <select
                      value={selectedCollectionSlug || ''}
                      onChange={(e) => {
                        const slug = e.target.value || null;
                        setSelectedCollectionSlug(slug);
                        if (slug) setSelectedCategory(null); // Mutual Exclusivity
                      }}
                      className="text-sm font-medium border-none bg-emerald-50 text-emerald-800 rounded-full px-4 py-1.5 pr-8 focus:ring-2 focus:ring-emerald-500 cursor-pointer hover:bg-emerald-100 transition-colors"
                    >
                      <option value="">All Collections</option>
                      {collections.map((col) => (
                        <option key={col.id} value={col.slug}>
                          {col.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className="relative">
                    <select
                      value={selectedCategory || ''}
                      disabled={!!selectedCollectionSlug}
                      onChange={(e) => setSelectedCategory(e.target.value || null)}
                      className={`text-sm font-medium border-none rounded-full px-4 py-1.5 pr-8 focus:ring-2 focus:ring-emerald-500 transition-colors ${selectedCollectionSlug
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100/50 text-gray-700 cursor-pointer hover:bg-gray-100'
                        }`}
                    >
                      <option value="">{selectedCollectionSlug ? 'Disabled by Collection' : 'All Categories'}</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Title Spacer */}
            <div className="md:hidden"></div>
          </div>

          {/* Date Filter Pills & Custom Picker */}
          {mapMode === 'events' && (
            <div className="flex items-center gap-4">
              <MapDateFilter
                selectedRangeId={selectedRangeId}
                onRangeSelect={handleRangeSelect}
                currentDateRange={dateRange}
              />
            </div>
          )}

        </div>
      </div>

      {/* Main Content - Split View (Desktop) / Map Only (Mobile) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative h-full">

        {/* Left Panel - Event List Sidebar */}
        {mapMode === 'events' && (
          <MapSidebar
            events={filteredEvents}
            loading={loading}
            error={error}
            selectedMarkerId={selectedMarkerId}
            hoveredEventId={hoveredEventId}
            onEventClick={(event) => {
              router.push(`/events/${event.slug || event.id}`);
            }}
            onHover={(eventId) => setHoveredEventId(eventId)}
            onFocusEvent={(eventId) => {
              setFocusEventId(eventId);
              // Also ensure it's selected (for marker highlight)
              setSelectedMarkerId(eventId);
            }}
          />
        )}

        {/* Left Panel - Venue List Sidebar */}
        {mapMode === 'venues' && (
          <aside className="hidden lg:flex lg:flex-col lg:w-[380px] xl:w-[420px] flex-shrink-0 overflow-y-auto bg-gray-50 border-r border-gray-200">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-gray-100/95 backdrop-blur-sm px-4 py-3 border-b border-gray-200 shadow-sm flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">
                Verified Venues Directory
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {venues.length} Total
              </span>
            </div>

            {/* List */}
            {venues.length === 0 ? (
              <div className="p-8 text-center text-gray-500 flex-1">
                <p className="text-lg font-medium mb-2">No venues found</p>
                <p className="text-sm">Please check back later.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 p-2 space-y-2">
                {venues.map((venue) => {
                  const isSelected = selectedMarkerId === venue.id;
                  return (
                    <div
                      key={venue.id}
                      onClick={() => {
                        setSelectedMarkerId(venue.id);
                        setFocusEventId(venue.id); // Reuses map centering trigger
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex gap-4 ${
                        isSelected
                          ? 'bg-emerald-50/50 border-emerald-200 shadow-sm'
                          : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                      }`}
                    >
                      {/* Image Thumbnail / Initials */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center relative">
                        {venue.image_url ? (
                          <img
                            src={getAbsoluteImageUrl(venue.image_url) || undefined}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
                            {getInitials(venue.name)}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">
                            {venue.name}
                          </h4>
                          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-700 capitalize border border-gray-200">
                            {venue.venue_type || 'Venue'}
                          </span>
                        </div>

                        {/* Link to detail page */}
                        <div className="mt-2 flex items-center justify-between">
                          <a
                            href={`/venues/${venue.slug || venue.id}`}
                            className="text-xs text-emerald-600 font-bold hover:text-emerald-700 transition-colors flex items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()} // Prevent card click event bubbling
                          >
                            View Venue &rarr;
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        )}

        {/* Right Panel - Map */}
        <div className="flex-1 relative">
          <ErrorBoundary>
            <GoogleMapView
              events={filteredEvents}
              venues={venues}
              showEvents={mapMode === 'events'}
              showVenues={mapMode === 'venues'}
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
              onClusterClick={(clusterEvents) => {
                if (isMobile) {
                  setSelectedEvents(clusterEvents);
                }
              }}
              className="absolute inset-0"
            />
          </ErrorBoundary>

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
                    onClick={() => router.push(`/events/${event.slug || event.id}`)}
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

function getAbsoluteImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    return url;
  }
  return `/${url}`;
}

function getInitials(name: string): string {
  if (!name) return 'V';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default MapPage;
