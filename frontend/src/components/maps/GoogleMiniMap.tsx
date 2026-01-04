/**
 * GoogleMiniMap Component
 * Simple Google Map preview for venue/event detail pages.
 * Supports single location or multiple markers with auto-fit bounds.
 * Uses @vis.gl/react-google-maps library.
 */
'use client';

import { useEffect, useRef } from 'react';
import { Map, Marker, useMap } from '@vis.gl/react-google-maps';

export interface MapMarker {
  lat: number;
  lng: number;
  title?: string;
}

interface GoogleMiniMapProps {
  latitude?: number;
  longitude?: number;
  markers?: MapMarker[];
  zoom?: number;
  height?: string;
  showMarker?: boolean;
  interactive?: boolean;
  className?: string;
}

// Helper component to handle fitBounds for multiple markers
function MapBoundsHandler({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const boundsSet = useRef(false);

  useEffect(() => {
    if (!map || markers.length < 2 || boundsSet.current) return;

    const bounds = new google.maps.LatLngBounds();
    markers.forEach(marker => {
      bounds.extend({ lat: marker.lat, lng: marker.lng });
    });

    // Add padding so markers aren't at the edge
    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    boundsSet.current = true;
  }, [map, markers]);

  return null;
}

export default function GoogleMiniMap({
  latitude,
  longitude,
  markers = [],
  zoom = 14,
  height = '200px',
  showMarker = true,
  interactive = false,
  className = '',
}: GoogleMiniMapProps) {
  // Build markers array: use provided markers, or create single marker from lat/lng
  const allMarkers: MapMarker[] = markers.length > 0
    ? markers
    : (latitude !== undefined && longitude !== undefined)
      ? [{ lat: latitude, lng: longitude }]
      : [];

  // Default center: first marker or provided coords or Inverness fallback
  const defaultCenter = allMarkers.length > 0
    ? { lat: allMarkers[0].lat, lng: allMarkers[0].lng }
    : { lat: latitude ?? 57.4778, lng: longitude ?? -4.2247 };

  // For multiple markers, start zoomed out - fitBounds will adjust
  const initialZoom = allMarkers.length > 1 ? 10 : zoom;

  return (
    <div className={`rounded-lg overflow-hidden ${className}`} style={{ height }}>
      <Map
        defaultCenter={defaultCenter}
        defaultZoom={initialZoom}
        gestureHandling={interactive ? 'auto' : 'none'}
        disableDefaultUI={!interactive}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Render all markers */}
        {showMarker && allMarkers.map((marker, index) => (
          <Marker
            key={`${marker.lat}-${marker.lng}-${index}`}
            position={{ lat: marker.lat, lng: marker.lng }}
            title={marker.title}
          />
        ))}

        {/* Auto-fit bounds for multiple markers */}
        {allMarkers.length > 1 && <MapBoundsHandler markers={allMarkers} />}
      </Map>
    </div>
  );
}
