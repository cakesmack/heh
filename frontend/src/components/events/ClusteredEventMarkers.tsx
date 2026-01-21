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

export interface ClusteredEventMarkersProps {
    events: EventResponse[];
    selectedMarkerId?: string;
    hoveredEventId?: string | null;
    onEventClick?: (event: EventResponse) => void;
    onMarkerClick?: (marker: { id: string; type: 'event'; longitude: number; latitude: number; title: string }) => void;
    onClusterClick?: (events: EventResponse[]) => void;
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


    // Determine marker color based on category
    const categoryColor = event.category?.gradient_color || '#10b981';
    const bgColor = isSelected ? '#1f2937' : isHovered ? '#374151' : categoryColor;

    return (
        <AdvancedMarker
            position={{ lat: event.latitude, lng: event.longitude }}
            ref={(marker) => {
                setMarkerRef(marker, event.id)
            }}
            onClick={onClick}
            title={event.title}
        >
            <div
                className="relative cursor-pointer transition-transform duration-150"
                style={{ transform: isSelected || isHovered ? 'scale(1.2)' : 'scale(1)' }}
            >
                {/* Pin Container */}
                <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg border-2 border-white overflow-hidden"
                    style={{ backgroundColor: bgColor }}
                >
                    <img
                        src="/images/logo-white.png"
                        alt="Logo"
                        className="w-full h-full object-contain p-0.5"
                    />
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
    onClusterClick,
    isMobile = false,
}: ClusteredEventMarkersProps) {
    // Robust mapping of Marker -> EventID using refs to avoid closure staleness
    const markerToEventId = useMemo(() => new Map<google.maps.marker.AdvancedMarkerElement, string>(), []);
    const [markers, setMarkers] = useState<{ [key: string]: Marker }>({});
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    const selectedEvent = useMemo(
        () => events.find(e => e.id === selectedEventId) || null,
        [events, selectedEventId]
    );

    // Get Google Map instance
    const map = useMap();

    // State for cluster popup (when can't zoom further)
    const [clusterPopup, setClusterPopup] = useState<{
        position: google.maps.LatLng;
        events: EventResponse[];
    } | null>(null);

    // State for the clusterer (now managed via state, not useMemo, to handle async init)
    const [clusterer, setClusterer] = useState<MarkerClusterer | null>(null);

    // Initialize MarkerClusterer only after map is fully ready (idle event)
    useEffect(() => {
        if (!map) return;

        let clustererInstance: MarkerClusterer | null = null;

        // Wait for map to be fully idle (projection available)
        const initClusterer = () => {
            // Double-check map projection is ready
            const projection = map.getProjection();
            if (!projection) {
                // If projection not ready, wait a bit and retry
                setTimeout(initClusterer, 100);
                return;
            }

            clustererInstance = new MarkerClusterer({
                map,
                // Use GridAlgorithm with settings tuned for the map
                algorithm: new GridAlgorithm({
                    gridSize: 60,  // Default grid size
                    maxZoom: 16,   // Stop clustering at zoom 16 (street level)
                }),
                // Custom click handler to show popup or zoom
                onClusterClick: (event, cluster, mapInstance) => {
                    const clusterMarkers = cluster.markers || [];
                    const clusterPosition = cluster.position;

                    // Improved Event Lookup: Use memoized map to lookup ID from marker instance
                    const eventsInCluster = clusterMarkers
                        .map(m => {
                            const marker = m as google.maps.marker.AdvancedMarkerElement;
                            const eventId = markerToEventId.get(marker);
                            if (!eventId) return null;
                            return events.find(e => e.id === eventId);
                        })
                        .filter((e): e is EventResponse => !!e);

                    // Determine bounds of the cluster
                    const bounds = new google.maps.LatLngBounds();
                    clusterMarkers.forEach(m => {
                        // Cast to AdvancedMarkerElement as that's what we are using
                        const marker = m as google.maps.marker.AdvancedMarkerElement;
                        // For AdvancedMarkerElement, position is a property, not a function
                        if (marker.position) {
                            bounds.extend(marker.position);
                        }
                    });

                    const currentZoom = mapInstance.getZoom() || 0;
                    const isMaxZoom = currentZoom >= 15; // Max zoom for clustering is 16, so 15 is "near max"

                    // Check if bounds are very tight (effectively same location)
                    const ne = bounds.getNorthEast();
                    const sw = bounds.getSouthWest();
                    const isSameLocation =
                        Math.abs(ne.lat() - sw.lat()) < 0.00005 &&
                        Math.abs(ne.lng() - sw.lng()) < 0.00005;

                    // ACTION: Show List (Mobile Sheet or Desktop Popup)
                    // Trigger if:
                    // 1. We are at max zoom OR
                    // 2. All markers are effectively at the exact same location
                    if (isSameLocation || isMaxZoom) {
                        if (isMobile && onClusterClick) {
                            // On mobile, delegate to parent to show Bottom Sheet
                            onClusterClick(eventsInCluster);
                        } else {
                            // On desktop, show internal popup
                            setClusterPopup({
                                position: clusterPosition,
                                events: eventsInCluster,
                            });
                        }
                    }
                    // ACTION: Zoom In
                    else {
                        mapInstance.fitBounds(bounds, 50); // 50px padding
                    }
                },
            });

            setClusterer(clustererInstance);
        };

        // Listen for idle event which fires when map is fully loaded
        const idleListener = map.addListener('idle', () => {
            if (!clustererInstance) {
                initClusterer();
            }
        });

        // Also try to init immediately if map might already be ready
        if (map.getProjection()) {
            initClusterer();
        }

        return () => {
            idleListener.remove();
            if (clustererInstance) {
                clustererInstance.clearMarkers();
                clustererInstance.setMap(null);
            }
        };
    }, [map, events, markerToEventId]);

    // Update clusterer when markers change
    useEffect(() => {
        if (!clusterer) return;

        // Only update if we have markers and clusterer is ready
        const markerArray = Object.values(markers);
        if (markerArray.length > 0) {
            clusterer.clearMarkers();
            clusterer.addMarkers(markerArray);
        }
    }, [clusterer, markers]);

    // Cleanup on unmount - handled in the init useEffect above

    // Callback to track markers and populate Map
    const setMarkerRef = useCallback((marker: Marker | null, key: string) => {
        setMarkers(prev => {
            if ((marker && prev[key]) || (!marker && !prev[key])) return prev;

            if (marker) {
                // Add to Map
                markerToEventId.set(marker as google.maps.marker.AdvancedMarkerElement, key);
                return { ...prev, [key]: marker };
            } else {
                // Remove from Map
                const oldMarker = prev[key] as google.maps.marker.AdvancedMarkerElement;
                if (oldMarker) {
                    markerToEventId.delete(oldMarker);
                }

                const { [key]: _, ...rest } = prev;
                return rest;
            }
        });
    }, [markerToEventId]);

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

            {/* Cluster Popup - Shows list of events at same location */}
            {clusterPopup && !isMobile && (
                <InfoWindow
                    position={{ lat: clusterPopup.position.lat(), lng: clusterPopup.position.lng() }}
                    onCloseClick={() => setClusterPopup(null)}
                >
                    <div className="w-[280px] overflow-hidden -m-2">
                        {/* Header */}
                        <div className="px-3 py-2 bg-amber-50 border-b border-amber-100">
                            <h3 className="font-bold text-gray-900 text-sm">
                                {clusterPopup.events.length} Events Here
                            </h3>
                        </div>

                        {/* Scrollable Event List */}
                        <div className="max-h-[250px] overflow-y-auto">
                            {clusterPopup.events.map((event) => (
                                <a
                                    key={event.id}
                                    href={`/events/${event.id}`}
                                    className="flex gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                                >
                                    {/* Thumbnail */}
                                    <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                                        {event.image_url ? (
                                            <img
                                                src={event.image_url}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Event Info */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-gray-900 text-sm leading-snug line-clamp-1">
                                            {event.title}
                                        </h4>
                                        <p className="text-xs text-emerald-600 mt-0.5">
                                            {event.date_start
                                                ? format(new Date(event.date_start), 'EEE, MMM d • h:mm a')
                                                : 'Date TBD'}
                                        </p>
                                        {event.category && (
                                            <span
                                                className="inline-block px-1.5 py-0.5 text-xs font-medium rounded text-white mt-1"
                                                style={{ backgroundColor: event.category.gradient_color || '#10b981' }}
                                            >
                                                {event.category.name}
                                            </span>
                                        )}
                                    </div>

                                    {/* Arrow */}
                                    <div className="flex items-center">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                </InfoWindow>
            )}
        </>
    );
}

export default ClusteredEventMarkers;
