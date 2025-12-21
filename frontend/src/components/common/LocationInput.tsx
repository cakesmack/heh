import { useState, useEffect, useRef } from 'react';

interface LocationInputProps {
    onSelect: (location: {
        latitude: number;
        longitude: number;
        placeName: string;
    }) => void;
    placeholder?: string;
    className?: string;
    initialValue?: string;
    onKeyDown?: (e: React.KeyboardEvent) => void;
}

interface Suggestion {
    id: string;
    place_name: string;
    center: [number, number]; // [lng, lat]
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoiY21hY2tkZXYiLCJhIjoiY21peW80Z3JzMGcxcDNmcG12Y3I0OGZmNyJ9.vOpaT8dR6gE8vpmiRAI2Bw';

// Scottish Highlands bounding box
const HIGHLANDS_BOUNDS = {
    minLat: 56.4,
    maxLat: 58.8,
    minLng: -7.5,
    maxLng: -3.0,
};

export function LocationInput({ onSelect, placeholder = 'Town or Postcode', className = '', initialValue = '', onKeyDown }: LocationInputProps) {
    const [query, setQuery] = useState(initialValue);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close suggestions when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length < 3) {
                setSuggestions([]);
                return;
            }

            setLoading(true);
            try {
                // Bounding box for Scottish Highlands region
                const highlandsBbox = `${HIGHLANDS_BOUNDS.minLng},${HIGHLANDS_BOUNDS.minLat},${HIGHLANDS_BOUNDS.maxLng},${HIGHLANDS_BOUNDS.maxLat}`;

                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=gb&bbox=${highlandsBbox}&types=poi,address,place,postcode&limit=10`
                );
                const data = await response.json();

                // Filter results to ensure they're within the Highlands bounding box
                const filteredFeatures = (data.features || []).filter((feature: Suggestion) => {
                    const [lng, lat] = feature.center;
                    return (
                        lat >= HIGHLANDS_BOUNDS.minLat &&
                        lat <= HIGHLANDS_BOUNDS.maxLat &&
                        lng >= HIGHLANDS_BOUNDS.minLng &&
                        lng <= HIGHLANDS_BOUNDS.maxLng
                    );
                });

                setSuggestions(filteredFeatures.slice(0, 6));
                setShowSuggestions(true);
            } catch (error) {
                console.error('Geocoding error:', error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (suggestion: Suggestion) => {
        setQuery(suggestion.place_name);
        setShowSuggestions(false);
        onSelect({
            latitude: suggestion.center[1],
            longitude: suggestion.center[0],
            placeName: suggestion.place_name,
        });
    };

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    onFocus={() => {
                        if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                    placeholder={placeholder}
                />
                {loading && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {suggestions.map((suggestion) => (
                        <li
                            key={suggestion.id}
                            onClick={() => handleSelect(suggestion)}
                            className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-emerald-50 text-gray-900"
                        >
                            <div className="flex items-center">
                                <span className="font-normal block truncate">
                                    {suggestion.place_name}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {showSuggestions && suggestions.length === 0 && query.length >= 3 && !loading && (
                <div className="absolute z-50 mt-1 w-full bg-white shadow-lg rounded-md py-2 px-3 text-sm text-gray-500 ring-1 ring-black ring-opacity-5">
                    No locations found in the Highlands for this search.
                </div>
            )}
        </div>
    );
}
