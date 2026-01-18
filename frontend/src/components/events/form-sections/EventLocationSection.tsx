
import React from 'react';
import Link from 'next/link';
import VenueTypeahead from '@/components/venues/VenueTypeahead';
import GooglePlacesAutocomplete from '@/components/common/GooglePlacesAutocomplete';
import LocationPickerMap from '@/components/maps/LocationPickerMap';
import MultiVenueSelector from '@/components/venues/MultiVenueSelector';
import FormSection from '../FormSection';
import { VenueResponse } from '@/types';

interface EventLocationSectionProps {
    locationTab: 'main' | 'multi';
    setLocationTab: (tab: 'main' | 'multi') => void;
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
    locationMode,
    setLocationMode,
    formData,
    handleVenueChange,
    handlePlaceSelect,
    handleLocationChange,
    participatingVenues,
    setParticipatingVenues,
    isLocationValid
}: EventLocationSectionProps) {
    return (
        <FormSection
            title="Location"
            description="Where is this happening?"
            tipTitle="Finding the Spot"
            tipContent={
                <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Venue:</strong> Search our database. If it's missing, you can add it!</li>
                    <li><strong>Custom:</strong> Use for one-off locations like parks or pop-ups.</li>
                    <li><strong>Multi-Venue:</strong> Great for festivals or trails. Pins will appear at all locations.</li>
                </ul>
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
                    {/* Sub-tabs: Venue vs Custom */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setLocationMode('venue')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${locationMode === 'venue'
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                }`}
                        >
                            Select Venue
                        </button>
                        <button
                            type="button"
                            onClick={() => setLocationMode('custom')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${locationMode === 'custom'
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                }`}
                        >
                            Custom Location
                        </button>
                    </div>

                    {locationMode === 'venue' ? (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Search for a venue</label>
                            <VenueTypeahead
                                value={formData.venue_id}
                                onChange={handleVenueChange}
                                placeholder="e.g. The Ironworks"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                <Link href="/venues" target="_blank" className="text-emerald-600 hover:underline">Can't find it? Add a new venue.</Link>
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Location Name *</label>
                                <GooglePlacesAutocomplete
                                    placeholder="e.g. Belladrum Estate, High Street, etc."
                                    defaultValue={formData.location_name}
                                    onPlaceSelect={handlePlaceSelect}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Pin Location</label>
                                <LocationPickerMap
                                    latitude={formData.latitude}
                                    longitude={formData.longitude}
                                    onLocationChange={handleLocationChange}
                                />
                            </div>

                            {/* Geofencing Warning */}
                            {!isLocationValid && formData.location_name && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-red-800">Location outside the Scottish Highlands</p>
                                        <p className="text-xs text-red-600 mt-1">Events must be located within the Scottish Highlands (IV, HS, KW, ZE, or qualifying PH/PA/AB/KA postcodes).</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
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
