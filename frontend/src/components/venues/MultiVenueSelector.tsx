'use client';

import { useState } from 'react';
import { VenueResponse } from '@/types';
import { VenueTypeahead } from '../venues/VenueTypeahead';
import GooglePlacesAutocomplete from '../common/GooglePlacesAutocomplete';
import { api } from '@/lib/api';
import { Button } from '../common/Button';

interface MultiVenueSelectorProps {
    selectedVenues: VenueResponse[];
    onChange: (venues: VenueResponse[]) => void;
    disabled?: boolean;
    onFocus?: () => void;
}

export default function MultiVenueSelector({
    selectedVenues,
    onChange,
    disabled = false,
    onFocus
}: MultiVenueSelectorProps) {
    // Temporary state for the typeahead input
    const [currentValue, setCurrentValue] = useState<string | null>(null);
    const [showAddLocation, setShowAddLocation] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const handleAddVenue = (venueId: string, venue: VenueResponse | null) => {
        if (venue && !selectedVenues.find(v => v.id === venue.id)) {
            onChange([...selectedVenues, venue]);
        }
        // Reset typeahead
        setCurrentValue(null);
        setCurrentValue(null);
    };

    const handleCreateVenue = async (place: google.maps.places.PlaceResult) => {
        if (!place.name || !place.formatted_address || !place.geometry?.location) return;

        setIsCreating(true);
        try {
            const venueData = {
                name: place.name,
                address: place.formatted_address,
                latitude: place.geometry.location.lat(),
                longitude: place.geometry.location.lng(),
                status: 'unverified'
            };

            // Note: We need to handle the category_id issue. 
            // I'll update the schema in a separate tool call immediately after this.

            const newVenue: any = await api.venues.create(venueData as any);
            // API might reject due to missing category_id.
            // I will pause creation here and fix schema first? 
            // No, I'll implement logic assuming it's optional, and then fix schema.

            onChange([...selectedVenues, { ...newVenue, status: 'unverified' }]); // Add badge logic later
            setShowAddLocation(false);
        } catch (err) {
            console.error('Failed to create venue', err);
            // Ideally show error toast
        } finally {
            setIsCreating(false);
        }
    };

    const handleRemoveVenue = (venueId: string) => {
        onChange(selectedVenues.filter(v => v.id !== venueId));
    };

    return (
        <div className="space-y-3">
            {/* Search Input */}
            <div>
                <VenueTypeahead
                    value={null}
                    onChange={handleAddVenue}
                    placeholder="Search for an existing venue..."
                    disabled={disabled}
                    onFocus={onFocus}
                />
            </div>

            {/* Toggle New Location */}
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Can't find the venue?</span>
                <button
                    type="button"
                    onClick={() => setShowAddLocation(!showAddLocation)}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                    {showAddLocation ? 'Cancel' : '+ Add New Location'}
                </button>
            </div>

            {/* Google Places Add */}
            {showAddLocation && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 animate-fadeIn">
                    <label className="block text-xs font-medium text-gray-700 mb-2">Search Google Maps</label>
                    <GooglePlacesAutocomplete
                        placeholder="Search for a location on Google..."
                        onPlaceSelect={handleCreateVenue}
                        required={false}
                    />
                    {isCreating && <p className="text-xs text-emerald-600 mt-2">Creating venue...</p>}
                </div>
            )}


            {/* Selected List */}
            {selectedVenues.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {selectedVenues.map((venue) => (
                        <div key={venue.id} className="flex items-center justify-between p-3">
                            <div className="flex-1 min-w-0 mr-4">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900 truncate">{venue.name}</p>
                                    {(venue as any).status === 'unverified' && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                            New
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 truncate">{venue.address}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemoveVenue(venue.id)}
                                disabled={disabled}
                                className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                                aria-label="Remove venue"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {selectedVenues.length === 0 && (
                <p className="text-xs text-gray-500 italic">No additional venues selected.</p>
            )}
        </div>
    );
}
