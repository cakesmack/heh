/**
 * EventMarker Component
 * Dynamic dot marker for events on the map.
 * Uses category color from database with white border and hover effects.
 * 
 * REQUIRES: NEXT_PUBLIC_GOOGLE_MAP_ID in .env.local for AdvancedMarker
 */
'use client';

import { AdvancedMarker } from '@vis.gl/react-google-maps';
import type { EventResponse } from '@/types';

interface EventMarkerProps {
    event: EventResponse;
    isSelected?: boolean;
    isHovered?: boolean;
    onClick?: () => void;
}

const DEFAULT_COLOR = '#6b7280'; // gray-500 fallback

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

    return (
        <AdvancedMarker
            position={{ lat: event.latitude, lng: event.longitude }}
            onClick={onClick}
            title={event.title}
        >
            <div
                className={`
          w-3 h-3 rounded-full border-2 border-white shadow-md cursor-pointer
          transition-transform duration-150 ease-out
          ${isSelected ? 'scale-150' : isHovered ? 'scale-125' : 'scale-100'}
        `}
                style={{ backgroundColor: markerColor }}
            />
        </AdvancedMarker>
    );
}
