/**
 * GoogleMapView Component
 * Interactive Google Map displaying events and venues across the Scottish Highlands.
 * Uses @vis.gl/react-google-maps library with custom EventMarker components.
 * 
 * REQUIRES: NEXT_PUBLIC_GOOGLE_MAP_ID in .env.local for AdvancedMarker to work
 */
'use client';

import { useMemo, useCallback, useState } from 'react';
import { Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
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

interface GoogleMapViewProps {
  events?: EventResponse[];
  venues?: VenueResponse[];
  onMarkerClick?: (marker: MapMarker) => void;
  onEventClick?: (event: EventResponse) => void;
  selectedMarkerId?: string;
  hoveredEventId?: string | null;
  userLocation?: { latitude: number; longitude: number };
  className?: string;
  height?: string;
  showEvents?: boolean;
  showVenues?: boolean;
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
}: GoogleMapViewProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Filter events with valid coordinates
  const validEvents = useMemo(() => {
    if (!showEvents) return [];
    return events.filter((e) => e.latitude && e.longitude);
  }, [events, showEvents]);

  // Venue markers (still using default Marker for venues)
  const venueMarkers = useMemo<MapMarker[]>(() => {
    if (!showVenues) return [];
    return venues
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
      setSelectedEventId(event.id);
      onEventClick?.(event);
    },
    [onEventClick]
  );

  // Handle venue marker click
  const handleVenueMarkerClick = useCallback(
    (marker: MapMarker) => {
      onMarkerClick?.(marker);
    },
    [onMarkerClick]
  );

  // Close info window
  const handleInfoWindowClose = useCallback(() => {
    setSelectedEventId(null);
  }, []);

  // Get selected event for info window
  const selectedEvent = validEvents.find((e) => e.id === selectedEventId);

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
        {/* Event Markers - Using custom EventMarker component with colored dots */}
        {validEvents.map((event) => (
          <EventMarker
            key={event.id}
            event={event}
            isSelected={selectedMarkerId === event.id}
            isHovered={hoveredEventId === event.id}
            onClick={() => handleEventMarkerClick(event)}
          />
        ))}

        {/* Venue Markers - Keep default Google marker style */}
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

        {/* Info Window - Desktop only, minimal content */}
        {selectedEvent && (
          <InfoWindow
            position={{ lat: selectedEvent.latitude, lng: selectedEvent.longitude }}
            onCloseClick={handleInfoWindowClose}
          >
            <div className="p-2 min-w-[200px]">
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                {selectedEvent.title}
              </h3>
              <p className="text-xs text-emerald-600 font-medium mt-1">
                {format(new Date(selectedEvent.date_start), 'EEE, MMM d • h:mm a')}
              </p>
              {selectedEvent.venue_name && (
                <p className="text-xs text-gray-500 mt-0.5">{selectedEvent.venue_name}</p>
              )}
              <a
                href={`/events/${selectedEvent.id}`}
                className="inline-block mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                View Event →
              </a>
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
}

export default GoogleMapView;
