/**
 * GoogleMapView Component
 * Interactive Google Map displaying events and venues across the Scottish Highlands.
 * Uses @vis.gl/react-google-maps library with custom EventMarker components.
 */
'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import { Map, Marker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { format } from 'date-fns';
import type { EventResponse, VenueResponse } from '@/types';
import EventMarker from './EventMarker';

// Scottish Highlands center coordinates (approximately Inverness)
const HIGHLANDS_CENTER = { lat: 57.3, lng: -4.4 };
const DEFAULT_ZOOM = 7;

export interface MapMarker {
  id: string;
  type: 'event' | 'venue';
  longitude: number;
  latitude: number;
  title: string;
  description?: string;
  category?: string;
  categorySlug?: string;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface GoogleMapViewProps {
  events?: EventResponse[];
  venues?: VenueResponse[];
  onMarkerClick?: (marker: MapMarker, event?: EventResponse) => void;
  onEventClick?: (event: EventResponse) => void;
  selectedMarkerId?: string;
  hoveredEventId?: string | null;
  userLocation?: { latitude: number; longitude: number };
  className?: string;
  height?: string;
  showEvents?: boolean;
  showVenues?: boolean;
  onBoundsChanged?: (bounds: MapBounds) => void;
  isMobile?: boolean;
}

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Inner component to access map instance
function MapContent({
  events,
  venues,
  onMarkerClick,
  onEventClick,
  selectedMarkerId,
  hoveredEventId,
  userLocation,
  showEvents,
  showVenues,
  onBoundsChanged,
  isMobile,
}: Omit<GoogleMapViewProps, 'className' | 'height'>) {
  const map = useMap();
  const [infoWindowEventId, setInfoWindowEventId] = useState<string | null>(null);
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  const debouncedBounds = useDebounce(currentBounds, 300);

  // Listen for bounds changes
  useEffect(() => {
    if (!map) return;

    const listener = map.addListener('bounds_changed', () => {
      const bounds = map.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        setCurrentBounds({
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng(),
        });
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map]);

  // Call parent callback when debounced bounds change
  useEffect(() => {
    if (debouncedBounds && onBoundsChanged) {
      onBoundsChanged(debouncedBounds);
    }
  }, [debouncedBounds, onBoundsChanged]);

  // Filter events with valid coordinates
  const validEvents = useMemo(() => {
    if (!showEvents) return [];
    return events?.filter((e) => e.latitude && e.longitude) || [];
  }, [events, showEvents]);

  // Venue markers (still using default Marker for venues)
  const venueMarkers = useMemo<MapMarker[]>(() => {
    if (!showVenues) return [];
    return (venues || [])
      .filter((v) => v.latitude && v.longitude)
      .map((venue) => ({
        id: venue.id,
        type: 'venue' as const,
        longitude: venue.longitude,
        latitude: venue.latitude,
        title: venue.name,
        description: venue.description,
        category: typeof venue.category === 'string' ? venue.category : undefined,
      }));
  }, [venues, showVenues]);

  // Handle event marker click
  const handleEventMarkerClick = useCallback(
    (event: EventResponse) => {
      if (isMobile) {
        // Mobile: Call parent to open bottom card, no InfoWindow
        onEventClick?.(event);
      } else {
        // Desktop: Show InfoWindow
        setInfoWindowEventId(event.id);
        onEventClick?.(event);
      }
    },
    [isMobile, onEventClick]
  );

  // Handle venue marker click
  const handleVenueMarkerClick = useCallback(
    (marker: MapMarker) => {
      if (!isMobile) {
        setInfoWindowEventId(marker.id);
      }
      onMarkerClick?.(marker);
    },
    [isMobile, onMarkerClick]
  );

  // Close info window
  const handleInfoWindowClose = useCallback(() => {
    setInfoWindowEventId(null);
  }, []);

  // Get selected event for info window
  const selectedEvent = validEvents.find((e) => e.id === infoWindowEventId);
  const selectedVenue = venueMarkers.find((m) => m.id === infoWindowEventId);

  return (
    <>
      {/* Event Markers - Using custom EventMarker component */}
      {validEvents.map((event) => (
        <EventMarker
          key={event.id}
          event={event}
          isSelected={selectedMarkerId === event.id}
          isHovered={hoveredEventId === event.id}
          onClick={() => handleEventMarkerClick(event)}
        />
      ))}

      {/* Venue Markers - Keep default style for venues */}
      {venueMarkers.map((marker) => (
        <Marker
          key={marker.id}
          position={{ lat: marker.latitude, lng: marker.longitude }}
          onClick={() => handleVenueMarkerClick(marker)}
          title={marker.title}
        />
      ))}

      {/* User Location Marker */}
      {userLocation && (
        <Marker
          position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
          title="Your location"
        />
      )}

      {/* Info Window - Desktop only */}
      {!isMobile && selectedEvent && (
        <InfoWindow
          position={{ lat: selectedEvent.latitude, lng: selectedEvent.longitude }}
          onCloseClick={handleInfoWindowClose}
        >
          <div className="p-2 max-w-xs">
            <h3 className="font-semibold text-gray-900 text-sm">{selectedEvent.title}</h3>
            <p className="text-xs text-gray-500 mt-1">
              {format(new Date(selectedEvent.date_start), 'EEE, MMM d • h:mm a')}
            </p>
            <a
              href={`/events/${selectedEvent.id}`}
              className="inline-block mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              View Details →
            </a>
          </div>
        </InfoWindow>
      )}

      {!isMobile && selectedVenue && !selectedEvent && (
        <InfoWindow
          position={{ lat: selectedVenue.latitude, lng: selectedVenue.longitude }}
          onCloseClick={handleInfoWindowClose}
        >
          <div className="p-2 max-w-xs">
            <h3 className="font-semibold text-gray-900 text-sm">{selectedVenue.title}</h3>
            {selectedVenue.category && (
              <p className="text-xs text-gray-500 capitalize">
                Venue: {selectedVenue.category}
              </p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function GoogleMapView({
  events = [],
  venues = [],
  onMarkerClick,
  onEventClick,
  selectedMarkerId,
  hoveredEventId,
  userLocation,
  className = '',
  height = '100%',
  showEvents = true,
  showVenues = true,
  onBoundsChanged,
  isMobile = false,
}: GoogleMapViewProps) {
  return (
    <div className={`relative ${className}`} style={height !== '100%' ? { height } : undefined}>
      <Map
        defaultCenter={HIGHLANDS_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%' }}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID}
      >
        <MapContent
          events={events}
          venues={venues}
          onMarkerClick={onMarkerClick}
          onEventClick={onEventClick}
          selectedMarkerId={selectedMarkerId}
          hoveredEventId={hoveredEventId}
          userLocation={userLocation}
          showEvents={showEvents}
          showVenues={showVenues}
          onBoundsChanged={onBoundsChanged}
          isMobile={isMobile}
        />
      </Map>
    </div>
  );
}

export default GoogleMapView;
