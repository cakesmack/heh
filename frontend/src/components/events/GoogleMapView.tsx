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
import EventMarker from './EventMarker';

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

        {/* Info Window for Events - Desktop Only - Rich Card Design */}
        {selectedEvent && !isMobile && (
          <InfoWindow
            position={{ lat: selectedEvent.latitude, lng: selectedEvent.longitude }}
            onCloseClick={handleInfoWindowClose}
          >
            <div className="w-[280px] overflow-hidden -m-2">
              {/* Event Image */}
              {selectedEvent.image_url ? (
                <div className="w-full h-32 bg-gray-100">
                  <img
                    src={selectedEvent.image_url}
                    alt={selectedEvent.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <svg className="w-10 h-10 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              {/* Event Details */}
              <div className="p-3 bg-white">
                {/* Category Badge */}
                {selectedEvent.category && (
                  <span
                    className="inline-block px-2 py-0.5 text-xs font-medium rounded-full text-white mb-2"
                    style={{ backgroundColor: selectedEvent.category.gradient_color || '#10b981' }}
                  >
                    {selectedEvent.category.name}
                  </span>
                )}

                {/* Title */}
                <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                  {selectedEvent.title}
                </h3>

                {/* Date & Time */}
                <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {selectedEvent.date_start
                    ? format(new Date(selectedEvent.date_start), 'EEE, MMM d \u2022 h:mm a')
                    : 'Date TBD'}
                </p>

                {/* Venue */}
                {selectedEvent.venue_name && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {selectedEvent.venue_name}
                  </p>
                )}

                {/* View Details Button */}
                <a
                  href={`/events/${selectedEvent.id}`}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  View Details
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
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
