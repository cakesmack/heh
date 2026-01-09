/**
 * GoogleMapView Component
 * Interactive Google Map displaying events and venues across the Scottish Highlands.
 * Uses @vis.gl/react-google-maps library.
 */
'use client';

import { useMemo, useCallback, useState } from 'react';
import { Map, Marker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { format } from 'date-fns';
import type { EventResponse, VenueResponse } from '@/types';
import ClusteredEventMarkers from './ClusteredEventMarkers';

// GPS/Location icon component
function LocationIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

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
  onMapClick?: () => void;
  selectedMarkerId?: string;
  hoveredEventId?: string | null;
  userLocation?: { latitude: number; longitude: number };
  className?: string;
  height?: string;
  showEvents?: boolean;
  showVenues?: boolean;
  isMobile?: boolean;
  /** Event ID to focus on (pan to and open InfoWindow) */
  focusEventId?: string | null;
  /** Callback when focus is complete */
  onFocusComplete?: () => void;
}

export function GoogleMapView({
  events = [],
  venues = [],
  onMarkerClick,
  onEventClick,
  onMapClick,
  selectedMarkerId,
  hoveredEventId,
  userLocation,
  className = '',
  height = '100%',
  showEvents = true,
  showVenues = true,
  isMobile = false,
  focusEventId,
  onFocusComplete,
}: GoogleMapViewProps) {
  const [infoWindowMarkerId, setInfoWindowMarkerId] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get map instance for programmatic control
  const map = useMap();

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

  // Handle map click (click on empty map area)
  const handleMapClick = useCallback(() => {
    setInfoWindowMarkerId(null);
    onMapClick?.();
  }, [onMapClick]);

  // Handle "Locate Me" button click
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const userPos = { lat: latitude, lng: longitude };
        setCurrentUserLocation(userPos);

        // Pan to user location and zoom in
        if (map) {
          map.panTo(userPos);
          map.setZoom(12);
        }

        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please check your browser permissions.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [map]);

  // Handle focus on specific event (pan to and open InfoWindow)
  const focusEvent = validEvents.find((e) => e.id === focusEventId);
  if (focusEvent && map && focusEventId) {
    // Use setTimeout to avoid state update during render
    setTimeout(() => {
      map.panTo({ lat: focusEvent.latitude, lng: focusEvent.longitude });
      map.setZoom(14);
      setInfoWindowMarkerId(focusEvent.id);
      onFocusComplete?.();
    }, 0);
  }

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
        clickableIcons={false}
        onClick={handleMapClick}
        style={{ width: '100%', height: '100%' }}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID}
      >
        {/* Event Markers - Using MarkerClusterer for zoom-based clustering */}
        <ClusteredEventMarkers
          events={validEvents}
          selectedMarkerId={selectedMarkerId}
          hoveredEventId={hoveredEventId}
          onEventClick={onEventClick}
          onMarkerClick={(marker) => {
            setInfoWindowMarkerId(marker.id);
            onMarkerClick?.({
              ...marker,
              description: undefined,
              category: undefined,
            });
          }}
          isMobile={isMobile}
        />

        {/* Venue Markers - Keep default Google marker */}
        {venueMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={{ lat: marker.latitude, lng: marker.longitude }}
            onClick={() => handleMarkerClick(marker)}
            title={marker.title}
          />
        ))}

        {/* User Location Marker (passed from parent) */}
        {userLocation && (
          <Marker
            position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
            title="Your location"
          />
        )}

        {/* Current User Location Marker (from Locate Me button) */}
        {currentUserLocation && !userLocation && (
          <Marker
            position={currentUserLocation}
            title="Your location"
          />
        )}

        {/* Info Window for Venues - Desktop Only */}
        {selectedVenue && !isMobile && (
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

      {/* Locate Me Button - Floating control */}
      <button
        onClick={handleLocateMe}
        disabled={isLocating}
        className="absolute bottom-20 right-3 z-10 bg-white rounded-lg shadow-lg p-2.5 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
        title="Find my location"
        aria-label="Find my location"
      >
        {isLocating ? (
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 2v2m0 16v2M2 12h2m16 0h2"
            />
          </svg>
        )}
      </button>

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
