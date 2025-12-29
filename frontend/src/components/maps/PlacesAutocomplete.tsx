/**
 * PlacesAutocomplete Component
 * Google Places address autocomplete for venue/event forms.
 * Uses @vis.gl/react-google-maps library.
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface PlaceResult {
  address: string;
  postcode: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

interface PlacesAutocompleteProps {
  onSelect: (place: PlaceResult) => void;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function PlacesAutocomplete({
  onSelect,
  defaultValue = '',
  placeholder = 'Search for an address...',
  disabled = false,
}: PlacesAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load the Places library
  const placesLib = useMapsLibrary('places');

  // Initialize services when library is loaded
  useEffect(() => {
    if (!placesLib) return;

    autocompleteServiceRef.current = new placesLib.AutocompleteService();
    // PlacesService requires a DOM element or map instance
    const dummyDiv = document.createElement('div');
    placesServiceRef.current = new placesLib.PlacesService(dummyDiv);
  }, [placesLib]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for suggestions
  const searchPlaces = useCallback((query: string) => {
    if (!autocompleteServiceRef.current || query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: query,
        componentRestrictions: { country: 'gb' },
        // Note: 'address' cannot be mixed with other types, using 'establishment' for venues
        types: ['establishment'],
      },
      (predictions, status) => {
        setIsLoading(false);

        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions);
          setIsOpen(predictions.length > 0);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          setSuggestions([]);
          setIsOpen(false);
        } else {
          setError('Failed to search addresses');
          setSuggestions([]);
          setIsOpen(false);
        }
      }
    );
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value.length === 0) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      searchPlaces(value);
    }, 300);
  };

  // Handle suggestion selection
  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesServiceRef.current) return;

    setInputValue(prediction.description);
    setIsOpen(false);
    setIsLoading(true);

    // Get place details for coordinates
    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'address_components', 'formatted_address'],
      },
      (place, status) => {
        setIsLoading(false);

        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          // Extract postcode from address components
          let postcode = '';
          if (place.address_components) {
            const postcodeComponent = place.address_components.find(
              (c) => c.types.includes('postal_code')
            );
            if (postcodeComponent) {
              postcode = postcodeComponent.long_name;
            }
          }

          onSelect({
            address: place.formatted_address || prediction.description,
            postcode,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
            placeId: prediction.place_id,
          });
        } else {
          setError('Failed to get place details');
        }
      }
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled || !placesLib}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          autoComplete="off"
        />

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        {isOpen && suggestions.length > 0 && (
          <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.place_id}
                onClick={() => handleSelect(suggestion)}
                className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 border-b last:border-b-0 border-gray-100"
              >
                <span className="font-medium">{suggestion.structured_formatting.main_text}</span>
                <span className="text-gray-500 ml-1">
                  {suggestion.structured_formatting.secondary_text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!placesLib && (
        <p className="text-xs text-amber-600">Loading Google Places...</p>
      )}

      <p className="text-xs text-gray-500">
        Powered by Google Places
      </p>
    </div>
  );
}
