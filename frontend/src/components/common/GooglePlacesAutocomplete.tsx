'use client';

import { useRef, useEffect, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface GooglePlacesAutocompleteProps {
    onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
    placeholder?: string;
    defaultValue?: string;
    className?: string;
    required?: boolean;
    onFocus?: () => void;
}

export default function GooglePlacesAutocomplete({
    onPlaceSelect,
    placeholder = 'Search for a location...',
    defaultValue = '',
    className = '',
    required = false,
    onFocus
}: GooglePlacesAutocompleteProps) {
    const [inputValue, setInputValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);
    const places = useMapsLibrary('places');
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

    useEffect(() => {
        setInputValue(defaultValue);
    }, [defaultValue]);

    useEffect(() => {
        if (!places || !inputRef.current) return;

        const options = {
            fields: ['geometry', 'name', 'formatted_address'],
            types: ['geocode', 'establishment'],
            componentRestrictions: { country: 'gb' }, // Restrict to UK
        };

        setAutocomplete(new places.Autocomplete(inputRef.current, options));
    }, [places]);

    useEffect(() => {
        if (!autocomplete) return;

        const listener = autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            setInputValue(place.formatted_address || place.name || '');
            onPlaceSelect(place);
        });

        return () => {
            google.maps.event.removeListener(listener);
        };
    }, [autocomplete, onPlaceSelect]);

    return (
        <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className={`block w-full px-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm ${className}`}
            placeholder={placeholder}
            required={required}
            onFocus={onFocus}
        />
    );
}
