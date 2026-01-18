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
    const [isCreating, setIsCreating] = useState(false);
    const [creationKey, setCreationKey] = useState(0); // Used to reset the input

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
                status: 'UNVERIFIED'
            };

            // Note: We need to handle the category_id issue. 
            // I'll update the schema in a separate tool call immediately after this.

            const newVenue: any = await api.venues.create(venueData as any);
            // API might reject due to missing category_id.
            // I will pause creation here and fix schema first? 
            // No, I'll implement logic assuming it's optional, and then fix schema.

            onChange([...selectedVenues, { ...newVenue, status: 'UNVERIFIED' }]); // Add badge logic later
            // Don't close the form, just reset the input so they can add another
            setCreationKey(prev => prev + 1);
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
        <div className="space-y-6">
            {/* Section 1: Search Existing */}
            <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                    Option 1: Search Existing Venues
                </label>
                <p className="text-xs text-gray-500 mb-3">
                    Search our database for venues already listed on Highland Events Hub.
                </p>
                <VenueTypeahead
                    value={null}
                    onChange={handleAddVenue}
                    placeholder="Type to search existing venues..."
                    disabled={disabled}
                    onFocus={onFocus}
                />
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center">
                    <span className="bg-white px-2 text-sm text-gray-500">OR</span>
                </div>
            </div>

            {/* Section 2: Add New from Google */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-800 mb-1">
                    Option 2: Add New Venue from Google Maps
                </label>
                <p className="text-xs text-gray-500 mb-3">
                    Can't find it above? Search Google Maps to add a new location automatically.
                </p>
                <GooglePlacesAutocomplete
                    key={creationKey}
                    placeholder="Search Google Maps to add..."
                    onPlaceSelect={handleCreateVenue}
                    required={false}
                />
                {isCreating && <p className="text-xs text-emerald-600 mt-2">Creating venue...</p>}
            </div>

            {/* Selected List */}
            {selectedVenues.length > 0 && (
                <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Venues</h4>
                    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                        {selectedVenues.map((venue) => (
                            <div key={venue.id} className="flex items-center justify-between p-3">
                                <div className="flex-1 min-w-0 mr-4">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-gray-900 truncate">{venue.name}</p>
                                        {(venue as any).status === 'UNVERIFIED' && (
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
                </div>
            )}

            {selectedVenues.length === 0 && (
                <p className="text-xs text-gray-500 italic">No additional venues selected.</p>
            )}
        </div>
    );
}
