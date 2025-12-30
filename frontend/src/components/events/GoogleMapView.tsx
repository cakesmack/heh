/**
 * GoogleMapView Component
 * Interactive Google Map displaying events and venues across the Scottish Highlands.
 * Uses @vis.gl/react-google-maps library.
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
  isMobile?: boolean;
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
  isMobile = false,
}: GoogleMapViewProps) {
  const [infoWindowMarkerId, setInfoWindowMarkerId] = useState<string | null>(null);

  // Filter events with valid coordinates
  const validEvents = useMemo(() => {
    if (!showEvents) return [];
    return events.filter((e) => e.latitude && e.longitude);
  }, [events, showEvents]);

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

  // No longer need allMarkers - we render events and venues separately
  // allMarkers was combining eventMarkers and venueMarkers

  // Handle marker click
  const handleMarkerClick = useCallback(
    (marker: MapMarker) => {
      setInfoWindowMarkerId(marker.id);
      onMarkerClick?.(marker);
    },
    [onMarkerClick]
  );

  // Close info window
  const handleInfoWindowClose = useCallback(() => {
    setInfoWindowMarkerId(null);
  }, []);

  // Get selected event for info window
  const selectedEvent = validEvents.find((e) => e.id === infoWindowMarkerId);
  const selectedVenue = venueMarkers.find((m) => m.id === infoWindowMarkerId);

  return (
    <div className={`${className}`} style={height !== '100%' ? { height } : undefined}>
      <Map
        defaultCenter={HIGHLANDS_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%' }}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID}
      >
        {/* Event Markers - Using custom EventMarker with colored dots */}
        {validEvents.map((event) => (
          <EventMarker
            key={event.id}
            event={event}
            isSelected={selectedMarkerId === event.id}
            isHovered={hoveredEventId === event.id}
            onClick={() => {
              setInfoWindowMarkerId(event.id);
              onEventClick?.(event);
              onMarkerClick?.({
                id: event.id,
                type: 'event',
                longitude: event.longitude,
                latitude: event.latitude,
                title: event.title,
                description: event.description,
                category: event.category?.name,
              });
            }}
          />
        ))}

        {/* Venue Markers - Keep default Google marker */}
        {venueMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={{ lat: marker.latitude, lng: marker.longitude }}
            onClick={() => handleMarkerClick(marker)}
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

        {/* Info Window for Events - Desktop Only */}
        {selectedEvent && !isMobile && (
          <InfoWindow
            position={{ lat: selectedEvent.latitude, lng: selectedEvent.longitude }}
            onCloseClick={handleInfoWindowClose}
          >
            <div className="p-2 min-w-[200px]">
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                {selectedEvent.title}
              </h3>
              <p className="text-xs text-emerald-600 font-medium mt-1">
                {selectedEvent.date_start
                  ? format(new Date(selectedEvent.date_start), 'EEE, MMM d \u2022 h:mm a')
                  : 'Date TBD'}
              </p>
              {selectedEvent.venue_name && (
                <p className="text-xs text-gray-500 mt-0.5">{selectedEvent.venue_name}</p>
              )}
              <a
                href={`/events/${selectedEvent.id}`}
                className="inline-block mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                View Event \u2192
              </a>
            </div>
          </InfoWindow>
        )}

        {/* Info Window for Venues - Desktop Only */}
        {selectedVenue && !selectedEvent && !isMobile && (
          <InfoWindow
            position={{ lat: selectedVenue.latitude, lng: selectedVenue.longitude }}
            onCloseClick={handleInfoWindowClose}
          >
            <div className="p-2 max-w-xs">
              <h3 className="font-semibold text-gray-900 text-sm">{selectedVenue.title}</h3>
              {selectedVenue.category && (
                <p className="text-xs text-gray-500 capitalize">Venue: {selectedVenue.category}</p>
              )}
            </div>
          </InfoWindow>
        )}
      </Map>

      {/* Legend - Desktop Only */}
      {(showEvents || showVenues) && !isMobile && (
        <div className="hidden md:block absolute bottom-4 right-4 bg-white rounded-lg shadow-md p-3 text-sm">
          <p className="font-semibold text-gray-700 mb-2">Legend</p>
          {showEvents && (
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: '#EA4335' }}
              />
              <span className="text-gray-600">Events ({validEvents.length})</span>
            </div>
          )}
          {showVenues && (
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: '#EA4335' }}
              />
              <span className="text-gray-600">Venues ({venueMarkers.length})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GoogleMapView;
