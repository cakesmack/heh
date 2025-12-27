/**
 * MapView Component
 * Interactive Mapbox map displaying events and venues across the Scottish Highlands
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { EventResponse, VenueResponse } from '@/types';

// Initialize Mapbox token
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// Scottish Highlands center coordinates (approximately Inverness)
const HIGHLANDS_CENTER: [number, number] = [-4.4, 57.3];
const DEFAULT_ZOOM = 7;

export interface MapMarker {
  id: string;
  type: 'event' | 'venue';
  longitude: number;
  latitude: number;
  title: string;
  description?: string;
  category?: string;
}

interface MapViewProps {
  events?: EventResponse[];
  venues?: VenueResponse[];
  onMarkerClick?: (marker: MapMarker) => void;
  selectedMarkerId?: string;
  hoveredEventId?: string | null;
  userLocation?: { latitude: number; longitude: number };
  className?: string;
  showEvents?: boolean;
  showVenues?: boolean;
}

export function MapView({
  events = [],
  venues = [],
  onMarkerClick,
  selectedMarkerId,
  hoveredEventId,
  userLocation,
  className = '',
  showEvents = true,
  showVenues = true,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Check for valid Mapbox token
  const hasValidToken = MAPBOX_TOKEN && !MAPBOX_TOKEN.includes('your_mapbox_token');

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !hasValidToken || map.current) return;

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        center: HIGHLANDS_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: true,
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add geolocation control
      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
          },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        'top-right'
      );

      // Add fullscreen control
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

      // Add scale control
      map.current.addControl(
        new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
        'bottom-left'
      );

      map.current.on('load', () => {
        setIsLoaded(true);
      });

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError('Failed to load map. Please check your Mapbox token.');
      });
    } catch (error) {
      console.error('Map initialization error:', error);
      setMapError('Failed to initialize map.');
    }

    return () => {
      // Cleanup markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [hasValidToken]);

  // Create marker for an event or venue
  const createMarker = useCallback(
    (item: MapMarker): mapboxgl.Marker | null => {
      if (!map.current) return null;

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'map-marker';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '50%';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '14px';
      el.style.fontWeight = 'bold';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.border = '2px solid white';
      el.style.transition = 'box-shadow 0.2s, transform 0.2s';

      // Set icon based on type
      if (item.type === 'event') {
        el.style.backgroundColor = '#10b981'; // emerald-500
        el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;
      } else {
        el.style.backgroundColor = '#6366f1'; // indigo-500
        el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
      }

      const isSelected = item.id === selectedMarkerId;
      const isHovered = item.id === hoveredEventId;

      // Highlight selected or hovered marker
      if (isSelected) {
        el.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.5), 0 2px 4px rgba(0,0,0,0.3)';
        el.style.zIndex = '10';
      } else if (isHovered) {
        // Animated hover indicator
        el.style.boxShadow = '0 0 0 6px rgba(16, 185, 129, 0.4), 0 4px 12px rgba(0,0,0,0.4)';
        el.style.transform = 'scale(1.3)';
        el.style.zIndex = '5';
      }

      // Add hover effect using box-shadow (doesn't affect positioning)
      el.addEventListener('mouseenter', () => {
        if (!isSelected) {
          el.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.4)';
        }
      });
      el.addEventListener('mouseleave', () => {
        if (!isSelected) {
          el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        }
      });

      // Create popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: 'map-popup',
      }).setHTML(`
        <div class="p-2">
          <h3 class="font-semibold text-gray-900 text-sm">${item.title}</h3>
          ${item.category ? `<p class="text-xs text-gray-500 capitalize">${item.type}: ${item.category}</p>` : ''}
          ${item.description ? `<p class="text-xs text-gray-600 mt-1 line-clamp-2">${item.description}</p>` : ''}
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([item.longitude, item.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      // Add click handler
      el.addEventListener('click', () => {
        onMarkerClick?.(item);
      });

      return marker;
    },
    [onMarkerClick, selectedMarkerId, hoveredEventId]
  );

  // Update markers when events/venues change
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    // Add event markers
    if (showEvents) {
      events.forEach((event) => {
        const markerData: MapMarker = {
          id: event.id,
          type: 'event',
          longitude: event.longitude,
          latitude: event.latitude,
          title: event.title,
          description: event.description,
          category: event.category?.name,
        };
        const marker = createMarker(markerData);
        if (marker) {
          markersRef.current.set(event.id, marker);
        }
      });
    }

    // Add venue markers
    if (showVenues) {
      venues.forEach((venue) => {
        const markerData: MapMarker = {
          id: venue.id,
          type: 'venue',
          longitude: venue.longitude,
          latitude: venue.latitude,
          title: venue.name,
          description: venue.description,
          category: (venue.category as unknown) as string,
        };
        const marker = createMarker(markerData);
        if (marker) {
          markersRef.current.set(venue.id, marker);
        }
      });
    }
  }, [events, venues, showEvents, showVenues, isLoaded, createMarker]);

  // Update user location marker
  useEffect(() => {
    if (!map.current || !isLoaded || !userLocation) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    // Create user location marker
    const el = document.createElement('div');
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = '#3b82f6'; // blue-500
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 0 0 2px #3b82f6, 0 2px 4px rgba(0,0,0,0.3)';

    userMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([userLocation.longitude, userLocation.latitude])
      .addTo(map.current);
  }, [userLocation, isLoaded]);

  // Fly to selected marker
  useEffect(() => {
    if (!map.current || !isLoaded || !selectedMarkerId) return;

    const marker = markersRef.current.get(selectedMarkerId);
    if (marker) {
      const lngLat = marker.getLngLat();
      map.current.flyTo({
        center: [lngLat.lng, lngLat.lat],
        zoom: 12,
        duration: 1000,
      });
    }
  }, [selectedMarkerId, isLoaded]);

  // Render placeholder if no valid token
  if (!hasValidToken) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center p-8">
          <svg
            className="w-16 h-16 mx-auto text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Unavailable</h3>
          <p className="text-gray-600 text-sm mb-4">
            Please configure your Mapbox API token to view the map.
          </p>
          <div className="bg-gray-200 rounded p-3 text-left text-xs font-mono text-gray-700">
            <p>Add to .env.local:</p>
            <p className="mt-1">NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxxxx</p>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (mapError) {
    return (
      <div className={`bg-red-50 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center p-8">
          <svg
            className="w-16 h-16 mx-auto text-red-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Map Error</h3>
          <p className="text-red-600 text-sm">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-full rounded-lg" />

      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mx-auto mb-4" />
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

      {/* Legend - Hidden on mobile to avoid control conflicts */}
      {isLoaded && (showEvents || showVenues) && (
        <div className="hidden md:block absolute bottom-4 right-4 bg-white rounded-lg shadow-md p-3 text-sm">
          <p className="font-semibold text-gray-700 mb-2">Legend</p>
          {showEvents && (
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: '#10b981' }}
              />
              <span className="text-gray-600">Events ({events.length})</span>
            </div>
          )}
          {showVenues && (
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: '#6366f1' }}
              />
              <span className="text-gray-600">Venues ({venues.length})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MapView;
