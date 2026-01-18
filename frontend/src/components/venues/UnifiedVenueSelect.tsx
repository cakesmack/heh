import { useState, useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { VenueResponse, VenueCreate, VenueStatus } from '@/types';
import { api } from '@/lib/api';

interface UnifiedVenueSelectProps {
    value: string | null;
    onChange: (venueId: string, venue: VenueResponse | null) => void;
    onFocus?: () => void;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
}

interface GooglePrediction {
    place_id: string;
    description: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
}

export function UnifiedVenueSelect({
    value,
    onChange,
    onFocus,
    placeholder = 'Search for a venue or place...',
    disabled = false,
    error,
}: UnifiedVenueSelectProps) {
    const [query, setQuery] = useState('');
    const [internalResults, setInternalResults] = useState<VenueResponse[]>([]);
    const [googleResults, setGoogleResults] = useState<GooglePrediction[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false); // For silent create
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedVenue, setSelectedVenue] = useState<VenueResponse | null>(null);

    const placesLib = useMapsLibrary('places');
    const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
    const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // Invisible div for PlacesService
    const placesServiceDivRef = useRef<HTMLDivElement>(null);

    // Initialize Google Services
    useEffect(() => {
        if (!placesLib) return;
        setAutocompleteService(new placesLib.AutocompleteService());
        if (placesServiceDivRef.current) {
            setPlacesService(new placesLib.PlacesService(placesServiceDivRef.current));
        }
    }, [placesLib]);

    // Fetch venue details if value is set but no selectedVenue (Initial Load)
    useEffect(() => {
        if (value && !selectedVenue) {
            api.venues.get(value).then(venue => {
                setSelectedVenue(venue);
                setQuery(venue.name);
            }).catch(() => {
                setSelectedVenue(null);
                setQuery('');
            });
        } else if (!value && selectedVenue) {
            // External clear
            setSelectedVenue(null);
            setQuery('');
        }
    }, [value]); // Dependent only on value changes

    // Search Logic
    useEffect(() => {
        if (query.length < 2) {
            setInternalResults([]);
            setGoogleResults([]);
            return;
        }

        // Don't search if query matches selected venue name exactly (user just clicked)
        if (selectedVenue && query === selectedVenue.name) {
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            setIsLoading(true);

            // 1. Internal Search
            const internalPromise = api.venues.search(query).then(res => res.venues).catch(() => []);

            // 2. Google Search
            const googlePromise = new Promise<GooglePrediction[]>((resolve) => {
                if (!autocompleteService) {
                    resolve([]);
                    return;
                };
                autocompleteService.getPlacePredictions({
                    input: query,
                    componentRestrictions: { country: 'gb' },
                    types: ['establishment', 'geocode'] // Broad search
                }, (predictions, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                        // Map to our local interface to avoid type issues with google namespace
                        const mapped = predictions.map(p => ({
                            place_id: p.place_id,
                            description: p.description,
                            structured_formatting: p.structured_formatting
                        }));
                        resolve(mapped);
                    } else {
                        resolve([]);
                    }
                });
            });

            Promise.all([internalPromise, googlePromise]).then(([internal, google]) => {
                setInternalResults(internal);
                setGoogleResults(google);
                setIsLoading(false);
                setShowDropdown(true); // Ensure dropdown shows with new results
            });

        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, autocompleteService, selectedVenue]);

    // Outside Click Handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        setShowDropdown(true);
        if (selectedVenue) {
            setSelectedVenue(null);
            onChange('', null);
        }
    };

    const handleSelectInternal = (venue: VenueResponse) => {
        setSelectedVenue(venue);
        setQuery(venue.name);
        setShowDropdown(false);
        onChange(venue.id, venue);
    };

    const handleSelectGoogle = (prediction: GooglePrediction) => {
        if (!placesService) return;

        setIsCreating(true);
        setShowDropdown(false);
        setQuery(prediction.structured_formatting.main_text); // Optimistic update

        placesService.getDetails({
            placeId: prediction.place_id,
            // Request address_components to get postcode
            fields: ['name', 'formatted_address', 'geometry', 'website', 'formatted_phone_number', 'address_components']
        }, async (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place && place.name && place.geometry?.location) {
                try {
                    // Extract Postcode
                    let postcode = '';
                    if (place.address_components) {
                        const pcComponent = place.address_components.find(c => c.types.includes('postal_code'));
                        if (pcComponent) postcode = pcComponent.long_name;
                    }

                    // Construct Payload
                    const payload: VenueCreate = {
                        name: place.name,
                        address: place.formatted_address || prediction.description,
                        latitude: place.geometry.location.lat(),
                        longitude: place.geometry.location.lng(),
                        status: 'UNVERIFIED',
                        website: place.website || undefined,
                        phone: place.formatted_phone_number || undefined,
                        postcode: postcode || undefined, // Send if found
                        category_id: 'other', // Default fallback
                    } as any;

                    // Fetch categories to get a valid ID (fallback to first available if 'other' not found)
                    const categories = await api.venues.listCategories();
                    const otherCat = categories.find(c => c.slug === 'other') || categories[0];
                    if (otherCat) payload.category_id = otherCat.id;

                    const newVenue = await api.venues.create(payload);

                    setSelectedVenue(newVenue);
                    setQuery(newVenue.name);
                    onChange(newVenue.id, newVenue);

                } catch (err) {
                    console.error("Failed to create unified venue:", err);
                    // error handling?
                } finally {
                    setIsCreating(false);
                }
            } else {
                setIsCreating(false);
                console.error("Google Place Details failed");
            }
        });
    };

    const handleClear = () => {
        setSelectedVenue(null);
        setQuery('');
        setInternalResults([]);
        setGoogleResults([]);
        onChange('', null);
    };

    return (
        <div ref={containerRef} className="relative">
            <div ref={placesServiceDivRef} className="hidden"></div>
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => {
                        setShowDropdown(true);
                        if (onFocus) onFocus();
                    }}
                    placeholder={placeholder}
                    disabled={disabled || isCreating}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${error ? 'border-red-300' : 'border-gray-300'
                        } ${disabled || isCreating ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />

                {/* Loading Spinner for Search or Create */}
                {(isLoading || isCreating) && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* Clear Button */}
                {selectedVenue && !disabled && !isLoading && !isCreating && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Clear selection"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Error message */}
            {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
            )}

            {/* Selected Venue Display (Optional: could duplicate the input content but helpful for verification) */}
            {selectedVenue && (
                <div className="mt-2 p-2 bg-emerald-50 rounded-lg text-sm border border-emerald-100 flex justify-between items-center">
                    <div>
                        <p className="font-medium text-emerald-800">{selectedVenue.name} {selectedVenue.status === 'UNVERIFIED' && <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded ml-1">UNVERIFIED</span>}</p>
                        <p className="text-emerald-600 truncate max-w-[300px]">{selectedVenue.address}</p>
                    </div>
                    <div className="text-emerald-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                </div>
            )}

            {/* Dropdown Results */}
            {showDropdown && (internalResults.length > 0 || googleResults.length > 0) && !selectedVenue && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-y-auto">

                    {/* Internal Results Group */}
                    {internalResults.length > 0 && (
                        <div className="py-2">
                            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Registered Venues</h3>
                            {internalResults.map(venue => (
                                <button
                                    key={venue.id}
                                    onClick={() => handleSelectInternal(venue)}
                                    className="w-full px-4 py-2 text-left hover:bg-emerald-50 flex items-start space-x-2 transition-colors"
                                >
                                    <span className="mt-1 text-emerald-500 shrink-0">
                                        {/* Icon: Building/Check */}
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    </span>
                                    <div>
                                        <p className="font-medium text-gray-900">{venue.name}</p>
                                        <p className="text-xs text-gray-500">{venue.address}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Separator if both exist */}
                    {internalResults.length > 0 && googleResults.length > 0 && <div className="border-t border-gray-100 my-1"></div>}

                    {/* Google Results Group */}
                    {googleResults.length > 0 && (
                        <div className="py-2 bg-gray-50/50">
                            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center">
                                <span>Add from Google Maps</span>
                                <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" className="h-4 ml-auto opacity-70" />
                            </h3>
                            {googleResults.map(prediction => (
                                <button
                                    key={prediction.place_id}
                                    onClick={() => handleSelectGoogle(prediction)}
                                    className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-start space-x-2 transition-colors group"
                                >
                                    <span className="mt-1 text-gray-400 group-hover:text-blue-500 shrink-0">
                                        {/* Icon: Map Pin */}
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </span>
                                    <div>
                                        <p className="font-medium text-gray-900">{prediction.structured_formatting.main_text}</p>
                                        <p className="text-xs text-gray-500">{prediction.structured_formatting.secondary_text}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* No Results (Only verify if query is long enough and loading finished) */}
            {showDropdown && query.length >= 2 && internalResults.length === 0 && googleResults.length === 0 && !isLoading && !selectedVenue && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                    No registered venues or Google locations found.
                </div>
            )}

        </div>
    );
}
