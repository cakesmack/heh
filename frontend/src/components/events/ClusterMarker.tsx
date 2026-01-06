/**
 * ClusterMarker Component
 * Displays a gold/amber marker with count badge for locations with multiple events.
 * Uses AdvancedMarker from @vis.gl/react-google-maps.
 */
'use client';

import { AdvancedMarker } from '@vis.gl/react-google-maps';
import type { EventGroup } from '@/utils/groupEventsByLocation';

interface ClusterMarkerProps {
    group: EventGroup;
    isSelected?: boolean;
    onClick?: () => void;
}

export default function ClusterMarker({
    group,
    isSelected = false,
    onClick,
}: ClusterMarkerProps) {
    const count = group.events.length;

    return (
        <AdvancedMarker
            position={{ lat: group.lat, lng: group.lng }}
            onClick={onClick}
            title={`${count} events at this location`}
            zIndex={isSelected ? 1000 : 100} // Clusters sit above single markers
        >
            <div
                className={`
          relative flex items-center justify-center
          w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer
          transition-transform duration-150 ease-out
          ${isSelected ? 'scale-125' : 'scale-100 hover:scale-110'}
        `}
                style={{ backgroundColor: '#F59E0B' }} // Amber-500 for cluster markers
            >
                {/* Count Badge */}
                <span className="text-white text-xs font-bold leading-none">
                    {count}
                </span>
            </div>
        </AdvancedMarker>
    );
}
