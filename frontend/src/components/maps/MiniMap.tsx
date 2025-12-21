/**
 * MiniMap Component
 * Reusable Mapbox map for event/venue pages.
 */
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoiY21hY2tkZXYiLCJhIjoiY21peW80Z3JzMGcxcDNmcG12Y3I0OGZmNyJ9.vOpaT8dR6gE8vpmiRAI2Bw';
mapboxgl.accessToken = MAPBOX_TOKEN;

interface MiniMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  height?: string;
  showMarker?: boolean;
  interactive?: boolean;
  className?: string;
  markerColor?: string;
}

export default function MiniMap({
  latitude,
  longitude,
  zoom = 14,
  height = '200px',
  showMarker = true,
  interactive = false,
  className = '',
  markerColor = '#10B981',
}: MiniMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    if (!MAPBOX_TOKEN) {
      setError('Map not available');
      return;
    }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [longitude, latitude],
        zoom: zoom,
        interactive: interactive,
        attributionControl: false,
      });

      map.current.on('load', () => {
        setMapLoaded(true);

        if (showMarker && map.current) {
          marker.current = new mapboxgl.Marker({ color: markerColor })
            .setLngLat([longitude, latitude])
            .addTo(map.current);
        }
      });

      map.current.on('error', () => {
        setError('Failed to load map');
      });

      // Add navigation controls if interactive
      if (interactive && map.current) {
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      }
    } catch (err) {
      setError('Failed to initialize map');
    }

    return () => {
      marker.current?.remove();
      map.current?.remove();
    };
  }, []);

  // Update marker position if coordinates change
  useEffect(() => {
    if (mapLoaded && map.current) {
      map.current.setCenter([longitude, latitude]);

      if (marker.current) {
        marker.current.setLngLat([longitude, latitude]);
      }
    }
  }, [latitude, longitude, mapLoaded]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ height }}
      >
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainer}
      className={`rounded-lg overflow-hidden ${className}`}
      style={{ height }}
    />
  );
}
