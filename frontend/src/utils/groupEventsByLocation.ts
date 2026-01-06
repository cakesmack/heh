/**
 * Group events by their geographic location.
 * Events at the same lat/lng coordinates are grouped together.
 */
import type { EventResponse } from '@/types';

export interface EventGroup {
    key: string;
    lat: number;
    lng: number;
    events: EventResponse[];
}

/**
 * Groups events by their latitude/longitude coordinates.
 * Uses fixed precision (4 decimal places ~11m accuracy) to handle slight coordinate variations.
 * 
 * @param events - Array of events to group
 * @returns Array of event groups with their coordinates and events
 */
export function groupEventsByLocation(events: EventResponse[]): EventGroup[] {
    const groups = new Map<string, EventGroup>();

    for (const event of events) {
        // Skip events without valid coordinates
        if (event.latitude == null || event.longitude == null) {
            continue;
        }

        // Round to 4 decimal places (~11m precision) to group nearby events
        const lat = Math.round(event.latitude * 10000) / 10000;
        const lng = Math.round(event.longitude * 10000) / 10000;
        const key = `${lat},${lng}`;

        if (groups.has(key)) {
            groups.get(key)!.events.push(event);
        } else {
            groups.set(key, {
                key,
                lat,
                lng,
                events: [event],
            });
        }
    }

    return Array.from(groups.values());
}
