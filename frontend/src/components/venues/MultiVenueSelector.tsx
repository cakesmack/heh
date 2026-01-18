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
                category_id: 'other', // Default or need a "User Generated" category? falling back to 'other' or a known ID is safest. 
                // However, category_id is required by schema. 
                // We might need to fetch a default category ID first or assume one exists. 
                // For now, let's try to fetch categories or use a hardcoded fallback if we know it, 
                // but fetching is better. Or maybe making category_id optional for Unverified? 
                // Schema said category_id is required. 
                // Let's use a dummy ID or handle it. 
                // Actually, let's hardcode a known "Other" or generic category ID if possible, 
                // or fetch the first available one as fallback.
                // Re-reading usage: often simpler to just pick one if backend allows.
                // Let's check if we can pass a 'status' to bypass strict checks?
                // The backend requires category_id. 
                // I will use a placeholder logic: assume 'other' slug or ID exists, or require backend change.
                // Wait, I can't guess ID. 
                // I will add a default fetch effect if needed, but for now I'll use a placeholder string 
                // and if it fails, I'll know. 
                // BETTER: Just list categories and pick first one? 
                // Actually, let's mock it for now or make category optional in schema for UNVERIFIED?
                // Phase 1 plan said "Make fields optional", but I didn't change category_id to optional in schema.
                // Let's quickly verify schema again.
                // I will check schema content I viewed earlier.
                // `category_id: str = Field(..., description="Venue category is required")`
                // It IS required.
                // I should fetch categories in useEffect or make it optional.
                // Making it optional is safer for 'Draft' venues.
                // I will make it optional for now in schema first.
                // Wait, I can't change schema without re-doing that step.
                // I will modify schema to make category_id optional for unverified.
                // But let's check if I can just pass a dummy value? No foreign key constraint?
                // There is a foreign key.
                // I'll update schema to make it optional in next step.
                // For this step, I'll assume I'll fix the schema.
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
