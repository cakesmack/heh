'use client';

import { useState, useEffect, useCallback } from 'react';
import { Map, Marker, MapMouseEvent } from '@vis.gl/react-google-maps';

interface LocationPickerMapProps {
    latitude: number;
    longitude: number;
    onLocationChange: (lat: number, lng: number) => void;
    height?: string;
    zoom?: number;
}

export default function LocationPickerMap({
    latitude,
    longitude,
    onLocationChange,
    height = '300px',
    zoom = 13
}: LocationPickerMapProps) {
    const [markerPosition, setMarkerPosition] = useState({ lat: latitude, lng: longitude });

    // Update internal state when props change
    useEffect(() => {
        setMarkerPosition({ lat: latitude, lng: longitude });
    }, [latitude, longitude]);

    const handleMapClick = useCallback((e: MapMouseEvent) => {
        if (e.detail.latLng) {
            const newLat = e.detail.latLng.lat;
            const newLng = e.detail.latLng.lng;
            setMarkerPosition({ lat: newLat, lng: newLng });
            onLocationChange(newLat, newLng);
        }
    }, [onLocationChange]);

    const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            setMarkerPosition({ lat: newLat, lng: newLng });
            onLocationChange(newLat, newLng);
        }
    }, [onLocationChange]);

    return (
        <div className="rounded-lg overflow-hidden border border-gray-300" style={{ height }}>
            <Map
                defaultCenter={{ lat: latitude, lng: longitude }}
                defaultZoom={zoom}
                gestureHandling={'greedy'}
                disableDefaultUI={false}
                onClick={handleMapClick}
                style={{ width: '100%', height: '100%' }}
            >
                <Marker
                    position={markerPosition}
                    draggable={true}
                    onDragEnd={handleMarkerDragEnd}
                />
            </Map>
            <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-t border-gray-200">
                Click on the map or drag the marker to set the exact location.
            </div>
        </div>
    );
}
