/**
 * EventMarker Component
 * Dynamic dot marker for events on the map.
 * Uses category color from database.
 * 
 * Uses regular Marker with custom icon to avoid Map ID requirement.
 */
'use client';

import { Marker } from '@vis.gl/react-google-maps';
import type { EventResponse } from '@/types';

interface EventMarkerProps {
    event: EventResponse;
    isSelected?: boolean;
    isHovered?: boolean;
    onClick?: () => void;
}

const DEFAULT_COLOR = '#6b7280'; // gray-500 fallback

// Create SVG data URL for colored circle marker
function createMarkerIcon(color: string, isSelected: boolean, isHovered: boolean): google.maps.Icon {
    const size = isSelected ? 18 : isHovered ? 15 : 12;
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${color}" stroke="white" stroke-width="2"/>
    </svg>
  `;

    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size / 2),
    };
}

export default function EventMarker({
    event,
    isSelected = false,
    isHovered = false,
    onClick,
}: EventMarkerProps) {
    // Get category color from database, fallback to gray
    const markerColor = event.category?.gradient_color || DEFAULT_COLOR;

    // Only render if we have valid coordinates
    if (!event.latitude || !event.longitude) {
        return null;
    }

    // Check if google.maps is available (it may not be during SSR)
    const icon = typeof google !== 'undefined' && google.maps
        ? createMarkerIcon(markerColor, isSelected, isHovered)
        : undefined;

    return (
        <Marker
            position={{ lat: event.latitude, lng: event.longitude }}
            onClick={onClick}
            title={event.title}
            icon={icon}
        />
    );
}
