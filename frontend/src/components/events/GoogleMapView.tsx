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
import ClusteredVenueMarkers from './ClusteredVenueMarkers';
import { optimizeImage } from '@/utils/imageOptimizer';

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

// Clean map styles - hide ALL icons, show only land, water, roads, and road names
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  // Hide ALL Points of Interest
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  // Hide ALL transit
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  // Hide road icons (but keep road lines and names)
  {
    featureType: 'road',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  // Hide administrative icons
  {
    featureType: 'administrative',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  // Hide landscape icons
  {
    featureType: 'landscape',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
];

export interface MapMarker {
  id: string;
  type: 'event' | 'venue';
  longitude: number;
  latitude: number;
  title: string;
  description?: string;
  category?: string;
  categorySlug?: string;
  slug?: string;
  venue_type?: string;
  image_url?: string | null;
}

interface GoogleMapViewProps {
  events?: EventResponse[];
  venues?: any[];
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
  /** Callback when a cluster is clicked. Only fired when it should show a list of events. */
  onClusterClick?: (events: EventResponse[]) => void;
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
  onClusterClick,
}: GoogleMapViewProps) {
  const [infoWindowMarkerId, setInfoWindowMarkerId] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Get map instance for programmatic control
  const map = useMap();

  // Filter events with valid coordinates
  const validEvents = useMemo(() => {
    if (!showEvents) return [];

    return events
      .filter((e) => (e.latitude && e.longitude) || (e.map_display_lat && e.map_display_lng))
      .map(e => ({
        ...e,
        // Prioritize map_display coordinates if available
        latitude: e.map_display_lat || e.latitude,
        longitude: e.map_display_lng || e.longitude
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
        category: typeof venue.category === 'string' ? venue.category : (venue.category?.name || undefined),
        slug: venue.slug,
        venue_type: venue.venue_type || (venue.category?.name || 'Venue'),
        image_url: venue.image_url || null,
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

  // Handle focus on specific event or venue (pan to and open InfoWindow)
  const focusTarget =
    validEvents.find((e) => e.id === focusEventId) ||
    venueMarkers.find((m) => m.id === focusEventId);

  if (focusTarget && map && focusEventId) {
    // Use setTimeout to avoid state update during render
    setTimeout(() => {
      map.panTo({ lat: focusTarget.latitude, lng: focusTarget.longitude });
      map.setZoom(16);
      setInfoWindowMarkerId(focusTarget.id);
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
        onIdle={() => setMapReady(true)}
        styles={MAP_STYLES}
      >
        {/* Event Markers - Using MarkerClusterer for zoom-based clustering */}
        {mapReady && (
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
            onClusterClick={onClusterClick}
            isMobile={isMobile}
          />
        )}

        {/* Venue Markers - Using ClusteredVenueMarkers for clustering */}
        {mapReady && showVenues && (
          <ClusteredVenueMarkers
            venues={venueMarkers}
            selectedMarkerId={selectedMarkerId}
            onMarkerClick={(marker) => {
              setInfoWindowMarkerId(marker.id);
              onMarkerClick?.(marker);
            }}
            isMobile={isMobile}
          />
        )}

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

        {/* Venues InfoWindow is now rendered internally in ClusteredVenueMarkers */}
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

// getAbsoluteImageUrl removed in favor of optimizeImage from utils

function getInitials(name: string): string {
  if (!name) return 'V';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function VenueMapPopup({
  venue,
}: {
  venue: {
    id: string;
    slug?: string;
    title: string;
    venue_type?: string;
    image_url?: string | null;
  };
}) {
  const [imageError, setImageError] = useState(false);
  const initials = getInitials(venue.title);
  const optimizedUrl = venue.image_url ? optimizeImage(venue.image_url, 'thumb') : null;
  const showImage = optimizedUrl && !imageError;

  return (
    <div className="p-1 max-w-[200px] overflow-hidden">
      {/* Top: image_url */}
      {showImage ? (
        <div className="relative w-full h-24 rounded-lg overflow-hidden bg-gray-100 mb-3 -mt-1 -mx-1 w-[calc(100%+8px)]">
          <img
            src={optimizedUrl}
            alt={venue.title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        /* Fallback placeholder */
        <div className="w-full h-24 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-3 -mt-1 -mx-1 w-[calc(100%+8px)] shadow-inner">
          <span className="text-white font-black text-2xl tracking-wider">
            {initials}
          </span>
        </div>
      )}

      {/* Middle: venue_type inside category pill CSS class */}
      {venue.venue_type && (
        <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 mb-2">
          {venue.venue_type}
        </span>
      )}

      {/* Middle: Venue name in bold heading */}
      <h3 className="font-bold text-gray-900 text-sm leading-snug mb-3">
        {venue.title}
      </h3>

      {/* Bottom: full-width green "View Details >" button */}
      <a
        href={`/venues/${venue.slug || venue.id}`}
        className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
      >
        View Details &gt;
      </a>
    </div>
  );
}

export default GoogleMapView;
