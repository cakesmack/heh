/**
 * ClusteredVenueMarkers Component
 * Integrates Google Maps markers with MarkerClusterer for zoom-based clustering of venues.
 */
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { MarkerClusterer, type Marker, GridAlgorithm } from '@googlemaps/markerclusterer';
import { VenueMapPopup } from './GoogleMapView';

export interface ClusteredVenueMarkersProps {
    venues: any[];
    selectedMarkerId?: string;
    onMarkerClick?: (marker: { id: string; type: 'venue'; longitude: number; latitude: number; title: string }) => void;
    isMobile?: boolean;
}

/**
 * Individual Venue Marker component that registers with the clusterer
 */
function VenueMarkerWithRef({
    venue,
    isSelected,
    onClick,
    setMarkerRef,
}: {
    venue: any;
    isSelected: boolean;
    onClick: () => void;
    setMarkerRef: (marker: Marker | null, key: string) => void;
}) {
    const ref = useCallback(
        (marker: google.maps.marker.AdvancedMarkerElement | null) => {
            setMarkerRef(marker, venue.id);
        },
        [setMarkerRef, venue.id]
    );

    const bgColor = isSelected ? '#1f2937' : '#10b981'; // Green (Venues), Dark Grey if selected

    return (
        <AdvancedMarker
            position={{ lat: venue.latitude, lng: venue.longitude }}
            ref={ref}
            onClick={onClick}
            title={venue.title || venue.name}
        >
            <div
                className="relative cursor-pointer transition-transform duration-150"
                style={{ transform: isSelected ? 'scale(1.2)' : 'scale(1)' }}
            >
                {/* Pin Container */}
                <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg border-2 border-white overflow-hidden"
                    style={{ backgroundColor: bgColor }}
                >
                    <svg className="w-5 h-5 text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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
 * Custom renderer for Venue Clusters (Green/Emerald Theme)
 */
const venueClusterRenderer = {
    render: ({ count, position }: { count: number; position: google.maps.LatLng }) => {
        return new google.maps.marker.AdvancedMarkerElement({
            position,
            content: (() => {
                const div = document.createElement('div');
                div.className = 'relative flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95';
                div.innerHTML = `
                    <div class="w-10 h-10 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center shadow-lg text-white font-bold text-sm">
                        ${count}
                    </div>
                `;
                return div;
            })()
        });
    }
};

/**
 * Main clustered markers component for venues
 */
export function ClusteredVenueMarkers({
    venues,
    selectedMarkerId,
    onMarkerClick,
    isMobile = false,
}: ClusteredVenueMarkersProps) {
    const markerToVenueId = useMemo(() => new Map<google.maps.marker.AdvancedMarkerElement, string>(), []);
    const [markers, setMarkers] = useState<{ [key: string]: Marker }>({});
    const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

    const validVenues = useMemo(() => {
        return (venues || []).filter(v =>
            v &&
            typeof v.latitude === 'number' && typeof v.longitude === 'number' &&
            !isNaN(v.latitude) && !isNaN(v.longitude)
        );
    }, [venues]);

    const selectedVenue = useMemo(
        () => validVenues.find(v => v.id === selectedVenueId) || null,
        [validVenues, selectedVenueId]
    );

    const map = useMap();
    const [clusterer, setClusterer] = useState<MarkerClusterer | null>(null);

    // Sync selected marker from parent
    useEffect(() => {
        if (selectedMarkerId) {
            setSelectedVenueId(selectedMarkerId);
        } else {
            setSelectedVenueId(null);
        }
    }, [selectedMarkerId]);

    // Initialize MarkerClusterer
    useEffect(() => {
        if (!map) return;

        let clustererInstance: MarkerClusterer | null = null;

        const initClusterer = () => {
            const projection = map.getProjection();
            if (!projection) {
                setTimeout(initClusterer, 100);
                return;
            }

            clustererInstance = new MarkerClusterer({
                map,
                algorithm: new GridAlgorithm({
                    gridSize: 25,
                    maxZoom: 19
                }),
                renderer: venueClusterRenderer,
                onClusterClick: (event, cluster, mapInstance) => {
                    const clusterMarkers = cluster.markers || [];
                    const bounds = new google.maps.LatLngBounds();
                    clusterMarkers.forEach(m => {
                        const marker = m as google.maps.marker.AdvancedMarkerElement;
                        if (marker.position) bounds.extend(marker.position);
                    });
                    mapInstance.fitBounds(bounds, 40);
                }
            });

            setClusterer(clustererInstance);
        };

        const idleListener = map.addListener('idle', () => {
            if (!clustererInstance) {
                initClusterer();
            }
        });

        if (map.getProjection()) {
            initClusterer();
        }

        return () => {
            idleListener.remove();
            if (clustererInstance) {
                try {
                    clustererInstance.clearMarkers();
                } catch {
                    // Projection already torn down — silently skip
                }
                clustererInstance.setMap(null);
            }
        };
    }, [map, validVenues]);

    // Update markers in clusterer
    useEffect(() => {
        if (!clusterer) return;

        const markerArray = Object.values(markers);
        if (markerArray.length > 0) {
            clusterer.clearMarkers();
            clusterer.addMarkers(markerArray);
        }
    }, [clusterer, markers]);

    const setMarkerRef = useCallback((marker: Marker | null, key: string) => {
        setMarkers(prev => {
            if ((marker && prev[key]) || (!marker && !prev[key])) return prev;

            if (marker) {
                markerToVenueId.set(marker as google.maps.marker.AdvancedMarkerElement, key);
                return { ...prev, [key]: marker };
            } else {
                const oldMarker = prev[key] as google.maps.marker.AdvancedMarkerElement;
                if (oldMarker) {
                    markerToVenueId.delete(oldMarker);
                }
                const { [key]: _, ...rest } = prev;
                return rest;
            }
        });
    }, [markerToVenueId]);

    const handleMarkerClick = useCallback((venue: any) => {
        setSelectedVenueId(venue.id);
        onMarkerClick?.({
            id: venue.id,
            type: 'venue',
            longitude: venue.longitude,
            latitude: venue.latitude,
            title: venue.title || venue.name,
        });
    }, [onMarkerClick]);

    const handleInfoWindowClose = useCallback(() => {
        setSelectedVenueId(null);
    }, []);

    return (
        <>
            {validVenues.map(venue => (
                <VenueMarkerWithRef
                    key={venue.id}
                    venue={venue}
                    isSelected={selectedVenueId === venue.id}
                    onClick={() => handleMarkerClick(venue)}
                    setMarkerRef={setMarkerRef}
                />
            ))}

            {selectedVenue && !isMobile && markers[selectedVenue.id] && (
                <InfoWindow
                    anchor={markers[selectedVenue.id]}
                    onCloseClick={handleInfoWindowClose}
                >
                    <VenueMapPopup venue={{
                        id: selectedVenue.id,
                        slug: selectedVenue.slug,
                        title: selectedVenue.title || selectedVenue.name,
                        name: selectedVenue.title || selectedVenue.name,
                        venue_type: selectedVenue.venue_type,
                        image_url: selectedVenue.image_url,
                        event_count: selectedVenue.event_count,
                    }} />
                </InfoWindow>
            )}
        </>
    );
}

export default ClusteredVenueMarkers;
