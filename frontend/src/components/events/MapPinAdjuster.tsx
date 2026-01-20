
import React, { useEffect, useMemo, useState } from 'react';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { Venue } from '@/types';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface MapPinAdjusterProps {
    participatingVenues: Venue[];
    currentLat?: number | null;
    currentLng?: number | null;
    label?: string;
    onChange: (lat: number, lng: number) => void;
    onLabelChange?: (label: string) => void;
}

const MapController = ({ bounds }: { bounds: google.maps.LatLngBounds | null }) => {
    const map = useMap();
    useEffect(() => {
        if (map && bounds) {
            map.fitBounds(bounds);
        }
    }, [map, bounds]);
    return null;
};

export const MapPinAdjuster: React.FC<MapPinAdjusterProps> = ({
    participatingVenues,
    currentLat,
    currentLng,
    label,
    onChange,
    onLabelChange
}) => {
    // Calculate bounds of participating venues
    const bounds = useMemo(() => {
        if (participatingVenues.length === 0) return null;
        if (typeof window === 'undefined' || !window.google) return null;

        const b = new window.google.maps.LatLngBounds();
        participatingVenues.forEach(v => {
            if (v.latitude && v.longitude) {
                b.extend({ lat: v.latitude, lng: v.longitude });
            }
        });

        // Also extend to include the current pin if set
        if (currentLat && currentLng) {
            b.extend({ lat: currentLat, lng: currentLng });
        }

        return b;
    }, [participatingVenues, currentLat, currentLng]);

    // Calculate default center (centroid) if no pin set
    const defaultCenter = useMemo(() => {
        if (currentLat && currentLng) return { lat: currentLat, lng: currentLng };

        const valid = participatingVenues.filter(v => v.latitude && v.longitude);
        if (valid.length === 0) return { lat: 57.47, lng: -4.22 }; // Inverness default

        const latSum = valid.reduce((acc, v) => acc + (v.latitude || 0), 0);
        const lngSum = valid.reduce((acc, v) => acc + (v.longitude || 0), 0);
        return { lat: latSum / valid.length, lng: lngSum / valid.length };
    }, [participatingVenues, currentLat, currentLng]);

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-300">Map Appearance</h3>
                <span className="text-xs text-gray-500">Drag the red pin to set the map center</span>
            </div>

            {/* Label Input */}
            {onLabelChange && (
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Map Label (e.g. "City Centre")</label>
                    <input
                        type="text"
                        value={label || ''}
                        onChange={(e) => onLabelChange(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                        placeholder="Optional label for the pin..."
                    />
                </div>
            )}

            <div className="h-[400px] w-full rounded-lg overflow-hidden border border-gray-700 relative">
                <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                    <Map
                        defaultCenter={defaultCenter}
                        defaultZoom={13}
                        gestureHandling={'greedy'}
                        disableDefaultUI={false}
                        mapId="DEMO_MAP_ID" // Required for Advanced Markers if needed, strictly optional here
                        className="w-full h-full"
                    >
                        {/* Map Controller for Bounds */}
                        <MapController bounds={bounds} />

                        {/* Participating Venues (Small Gray Dots) */}
                        {participatingVenues.map(v => (
                            v.latitude && v.longitude && (
                                <Marker
                                    key={v.id}
                                    position={{ lat: v.latitude, lng: v.longitude }}
                                    icon={{
                                        url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", // Using blue for venues
                                        scaledSize: { width: 32, height: 32 } as any
                                    }}
                                    title={v.name}
                                />
                            )
                        ))}

                        {/* The Big Red Draggable Pin */}
                        <Marker
                            draggable
                            position={{ lat: currentLat || defaultCenter.lat, lng: currentLng || defaultCenter.lng }}
                            onDragEnd={(e) => {
                                if (e.latLng) {
                                    onChange(e.latLng.lat(), e.latLng.lng());
                                }
                            }}
                            icon={{
                                url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                                scaledSize: { width: 48, height: 48 } as any
                            }}
                            zIndex={100}
                        />
                    </Map>
                </APIProvider>
            </div>

            <div className="text-xs text-gray-500">
                * The red pin determines where the event appears on the map. The blue dots show your selected venues.
            </div>
        </div>
    );
};
