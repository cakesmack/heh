/**
 * GoogleMiniMap Component
 * Simple Google Map preview for venue/event detail pages.
 * Uses @vis.gl/react-google-maps library.
 */
'use client';

import { Map, Marker } from '@vis.gl/react-google-maps';

interface GoogleMiniMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  height?: string;
  showMarker?: boolean;
  interactive?: boolean;
  className?: string;
  markerColor?: string;
}

export default function GoogleMiniMap({
  latitude,
  longitude,
  zoom = 14,
  height = '200px',
  showMarker = true,
  interactive = false,
  className = '',
}: GoogleMiniMapProps) {
  const position = { lat: latitude, lng: longitude };

  return (
    <div className={`rounded-lg overflow-hidden ${className}`} style={{ height }}>
      <Map
        defaultCenter={position}
        defaultZoom={zoom}
        gestureHandling={interactive ? 'auto' : 'none'}
        disableDefaultUI={!interactive}
        style={{ width: '100%', height: '100%' }}
      >
        {showMarker && (
          <Marker position={position} />
        )}
      </Map>
    </div>
  );
}
