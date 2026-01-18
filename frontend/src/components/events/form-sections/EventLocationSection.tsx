
import React from 'react';
import Link from 'next/link';
import { UnifiedVenueSelect } from '@/components/venues/UnifiedVenueSelect';
import MultiVenueSelector from '@/components/venues/MultiVenueSelector';
import FormSection from '../FormSection';
import { VenueResponse } from '@/types';

interface EventLocationSectionProps {
    locationTab: 'main' | 'multi';
    setLocationTab: (tab: 'main' | 'multi') => void;
    // Legacy props kept for compatibility (can be removed from parent later)
    locationMode: 'venue' | 'custom';
    setLocationMode: (mode: 'venue' | 'custom') => void;
    formData: any;
    handleVenueChange: (venueId: string, venue: VenueResponse | null) => void;
    handlePlaceSelect: (place: google.maps.places.PlaceResult) => void;
    handleLocationChange: (lat: number, lng: number) => void;
    participatingVenues: VenueResponse[];
    setParticipatingVenues: (venues: VenueResponse[]) => void;
    isLocationValid: boolean;
}

export default function EventLocationSection({
    locationTab,
    setLocationTab,
    formData,
    handleVenueChange,
    participatingVenues,
    setParticipatingVenues,
}: EventLocationSectionProps) {
    return (
        <FormSection
            title="Location"
            description="Where is this happening?"
            tipTitle="Unified Search"
            tipContent={
                <p>
                    Search for an existing venue OR type a new place name to add it automatically from Google Maps.
                </p>
            }
        >
            {/* Main Tabs: Main Location vs Multi-Venue */}
            <div className="flex border-b border-gray-200 mb-4">
                <button
                    type="button"
                    onClick={() => setLocationTab('main')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${locationTab === 'main'
                        ? 'border-emerald-600 text-emerald-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    📍 Main Location
                </button>
                <button
                    type="button"
                    onClick={() => setLocationTab('multi')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${locationTab === 'multi'
                        ? 'border-emerald-600 text-emerald-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    🎪 Multi-Venue Event
                </button>
            </div>

            {/* Tab Content */}
            {locationTab === 'main' ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Venue or Location</label>
                        <UnifiedVenueSelect
                            value={formData.venue_id}
                            onChange={(id, venue) => {
                                handleVenueChange(id, venue);
                                // Ensure we clear legacy fields if they exist in parent handling, 
                                // but here we just pass the venue change.
                            }}
                            placeholder="Search for a venue or add from Google Maps..."
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            Can't find it on Google Maps? <Link href="/venues" target="_blank" className="text-emerald-600 hover:underline">Create a Venue manually.</Link>
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                        For festivals, pub crawls, or multi-venue events. Add all participating venues below.
                    </p>
                    <MultiVenueSelector
                        selectedVenues={participatingVenues}
                        onChange={setParticipatingVenues}
                    />
                    {participatingVenues.length === 0 && (
                        <p className="text-xs text-amber-600">Please add at least one participating venue.</p>
                    )}
                </div>
            )}
        </FormSection>
    );
}
