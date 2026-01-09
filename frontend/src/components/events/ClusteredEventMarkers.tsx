/**
 * ClusteredEventMarkers Component
 * Integrates Google Maps markers with MarkerClusterer for zoom-based clustering.
 * Uses @googlemaps/markerclusterer library with @vis.gl/react-google-maps.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { MarkerClusterer, type Marker, GridAlgorithm } from '@googlemaps/markerclusterer';
import { format } from 'date-fns';
import type { EventResponse } from '@/types';

interface ClusteredEventMarkersProps {
    events: EventResponse[];
    selectedMarkerId?: string;
    hoveredEventId?: string | null;
    onEventClick?: (event: EventResponse) => void;
    onMarkerClick?: (marker: { id: string; type: 'event'; longitude: number; latitude: number; title: string }) => void;
    isMobile?: boolean;
}

/**
 * Individual Event Marker component that registers with the clusterer
 */
function EventMarkerWithRef({
    event,
    isSelected,
    isHovered,
    onClick,
    setMarkerRef,
}: {
    event: EventResponse;
    isSelected: boolean;
    isHovered: boolean;
    onClick: () => void;
    setMarkerRef: (marker: Marker | null, key: string) => void;
}) {
    const ref = useCallback(
        (marker: google.maps.marker.AdvancedMarkerElement | null) => {
            setMarkerRef(marker, event.id);
        },
        [setMarkerRef, event.id]
    );

    // Determine marker color based on category
    const categoryColor = event.category?.gradient_color || '#10b981';
    const bgColor = isSelected ? '#1f2937' : isHovered ? '#374151' : categoryColor;

    return (
        <AdvancedMarker
            position={{ lat: event.latitude, lng: event.longitude }}
            ref={ref}
            onClick={onClick}
            title={event.title}
        >
            <div
                className="relative cursor-pointer transition-transform duration-150"
                style={{ transform: isSelected || isHovered ? 'scale(1.2)' : 'scale(1)' }}
            >
                {/* Pin Container */}
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                    style={{ backgroundColor: bgColor }}
                >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                {/* Pin tail */}
                <div
                    className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-0 h-0"
                    style={{
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: `8px solid ${bgColor}`,
                    }}
                />
            </div>
        </AdvancedMarker>
    );
}

/**
 * Main clustered markers component
 */
export function ClusteredEventMarkers({
    events,
    selectedMarkerId,
    hoveredEventId,
    onEventClick,
    onMarkerClick,
    isMobile = false,
}: ClusteredEventMarkersProps) {
    const [markers, setMarkers] = useState<{ [key: string]: Marker }>({});
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    const selectedEvent = useMemo(
        () => events.find(e => e.id === selectedEventId) || null,
        [events, selectedEventId]
    );

    // Get Google Map instance
    const map = useMap();

    // Create MarkerClusterer with increased grid size (80 instead of default 60)
    const clusterer = useMemo(() => {
        if (!map) return null;

        return new MarkerClusterer({
            map,
            // Use GridAlgorithm with larger gridSize for more aggressive clustering
            algorithm: new GridAlgorithm({ gridSize: 80 }),
        });
    }, [map]);

    // Update clusterer when markers change
    useEffect(() => {
        if (!clusterer) return;

        clusterer.clearMarkers();
        clusterer.addMarkers(Object.values(markers));
    }, [clusterer, markers]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clusterer?.clearMarkers();
        };
    }, [clusterer]);

    // Callback to track markers
    const setMarkerRef = useCallback((marker: Marker | null, key: string) => {
        setMarkers(prev => {
            if ((marker && prev[key]) || (!marker && !prev[key])) return prev;

            if (marker) {
                return { ...prev, [key]: marker };
            } else {
                const { [key]: _, ...rest } = prev;
                return rest;
            }
        });
    }, []);

    // Handle marker click
    const handleMarkerClick = useCallback((event: EventResponse) => {
        setSelectedEventId(event.id);
        onEventClick?.(event);
        onMarkerClick?.({
            id: event.id,
            type: 'event',
            longitude: event.longitude,
            latitude: event.latitude,
            title: event.title,
        });
    }, [onEventClick, onMarkerClick]);

    // Close InfoWindow
    const handleInfoWindowClose = useCallback(() => {
        setSelectedEventId(null);
    }, []);

    return (
        <>
            {/* Render all event markers */}
            {events.map(event => (
                <EventMarkerWithRef
                    key={event.id}
                    event={event}
                    isSelected={selectedMarkerId === event.id}
                    isHovered={hoveredEventId === event.id}
                    onClick={() => handleMarkerClick(event)}
                    setMarkerRef={setMarkerRef}
                />
            ))}

            {/* InfoWindow for selected event - Desktop Only */}
            {selectedEvent && !isMobile && markers[selectedEvent.id] && (
                <InfoWindow
                    anchor={markers[selectedEvent.id]}
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
        </>
    );
}

export default ClusteredEventMarkers;
