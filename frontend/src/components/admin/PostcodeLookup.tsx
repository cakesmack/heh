/**
 * PostcodeLookup Component
 * Address autocomplete and lookup for admin venue forms.
 * Uses Mapbox Geocoding API via backend.
 */
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

interface PostcodeLookupProps {
  onResult: (result: {
    postcode: string;
    address: string;
    latitude: number;
    longitude: number;
  }) => void;
}

export default function PostcodeLookup({ onResult }: PostcodeLookupProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{
    place_name: string;
    latitude: number;
    longitude: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const results = await api.geocode.search(query);
        setSuggestions(results);
        setIsOpen(results.length > 0);
      } catch (err) {
        console.error('Geocode error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (suggestion: {
    place_name: string;
    latitude: number;
    longitude: number;
  }) => {
    setQuery(suggestion.place_name);
    setIsOpen(false);

    // Simple extraction for now:
    // Mapbox place_name is usually "Address, Town, Postcode, Country"
    // We'll just use the full string for the address field for now to ensure it works.
    // And try to extract postcode.

    const parts = suggestion.place_name.split(',').map(p => p.trim());
    let postcode = '';

    // Try to find a UK postcode pattern
    const postcodeRegex = /([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2})/;

    for (const part of parts) {
      const match = part.match(postcodeRegex);
      if (match) {
        postcode = match[0];
        break;
      }
    }

    // Pass the full place name as the address. 
    // The user can edit it if they want to remove the town/country.
    // This guarantees they see the full result.
    onResult({
      postcode: postcode,
      address: suggestion.place_name,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
  };

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700">
        Address Search (Mapbox)
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length === 0) setIsOpen(false);
          }}
          placeholder="Search address or postcode..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
          <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                onClick={() => handleSelect(suggestion)}
                className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700 border-b last:border-b-0 border-gray-100"
              >
                {suggestion.place_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <p className="text-xs text-gray-500">
        Powered by Mapbox Geocoding
      </p>
    </div>
  );
}
