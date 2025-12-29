/**
 * GoogleMapView Component
 * Interactive Google Map displaying events and venues across the Scottish Highlands.
 * Uses @vis.gl/react-google-maps library.
 */
'use client';

import { useMemo, useCallback, useState } from 'react';
import { Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import type { EventResponse, VenueResponse } from '@/types';

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
  selectedMarkerId,
  hoveredEventId,
  userLocation,
  className = '',
  height = '100%',
  showEvents = true,
  showVenues = true,
}: GoogleMapViewProps) {
  const [infoWindowMarkerId, setInfoWindowMarkerId] = useState<string | null>(null);

  // Memoize marker data to prevent unnecessary recalculations
  const eventMarkers = useMemo<MapMarker[]>(() => {
    if (!showEvents) return [];
    return events
      .filter((e) => e.latitude && e.longitude)
      .map((event) => ({
        id: event.id,
        type: 'event' as const,
        longitude: event.longitude,
        latitude: event.latitude,
        title: event.title,
        description: event.description,
        category: event.category?.name,
        categorySlug: event.category?.slug,
      }));
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

  const allMarkers = useMemo(
    () => [...eventMarkers, ...venueMarkers],
    [eventMarkers, venueMarkers]
  );

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

  // Get selected marker for info window
  const selectedMarker = allMarkers.find((m) => m.id === infoWindowMarkerId);

  return (
    <div className={`${className}`} style={height !== '100%' ? { height } : undefined}>
      <Map
        defaultCenter={HIGHLANDS_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Event and Venue Markers */}
        {allMarkers.map((marker) => (
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

        {/* Info Window */}
        {selectedMarker && (
          <InfoWindow
            position={{ lat: selectedMarker.latitude, lng: selectedMarker.longitude }}
            onCloseClick={handleInfoWindowClose}
          >
            <div className="p-2 max-w-xs">
              <h3 className="font-semibold text-gray-900 text-sm">{selectedMarker.title}</h3>
              {selectedMarker.category && (
                <p className="text-xs text-gray-500 capitalize">
                  {selectedMarker.type}: {selectedMarker.category}
                </p>
              )}
              {selectedMarker.description && (
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {selectedMarker.description}
                </p>
              )}
            </div>
          </InfoWindow>
        )}
      </Map>

      {/* Legend */}
      {(showEvents || showVenues) && (
        <div className="hidden md:block absolute bottom-4 right-4 bg-white rounded-lg shadow-md p-3 text-sm">
          <p className="font-semibold text-gray-700 mb-2">Legend</p>
          {showEvents && (
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: '#EA4335' }}
              />
              <span className="text-gray-600">Events ({eventMarkers.length})</span>
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
