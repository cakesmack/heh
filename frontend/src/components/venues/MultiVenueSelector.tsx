
import { useState } from 'react';
import { VenueResponse } from '@/types';
import { UnifiedVenueSelect } from '../venues/UnifiedVenueSelect';

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
    // Key to force reset of the input after adding
    const [inputKey, setInputKey] = useState(0);

    const handleAddVenue = (venueId: string, venue: VenueResponse | null) => {
        if (venue) {
            // Avoid duplicates
            if (!selectedVenues.find(v => v.id === venue.id)) {
                onChange([...selectedVenues, venue]);
            }
            // Reset the input by forcing re-mount
            setInputKey(prev => prev + 1);
        }
    };

    const handleRemoveVenue = (venueId: string) => {
        onChange(selectedVenues.filter(v => v.id !== venueId));
    };

    return (
        <div className="space-y-6">
            {/* Search / Add Section */}
            <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                    Add Participating Venue
                </label>
                <p className="text-xs text-gray-500 mb-3">
                    Search existing venues or type a new place name to add from Google Maps.
                </p>
                <UnifiedVenueSelect
                    key={inputKey}
                    value={null}
                    onChange={handleAddVenue}
                    placeholder="Search for a venue or place..."
                    disabled={disabled}
                    onFocus={onFocus}
                />
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
