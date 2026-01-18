/**
 * VenueTypeahead Component
 * Async search typeahead for selecting venues in event forms.
 */
import { useState, useEffect, useRef } from 'react';
import { VenueResponse } from '@/types';
import { api } from '@/lib/api';

interface VenueTypeaheadProps {
  value: string | null;
  onChange: (venueId: string, venue: VenueResponse | null) => void;
  onFocus?: () => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

export function VenueTypeahead({
  value,
  onChange,
  onFocus,
  placeholder = 'Search for a venue...',
  disabled = false,
  error,
}: VenueTypeaheadProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VenueResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<VenueResponse | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch venue details if value is set but no selectedVenue
  useEffect(() => {
    if (value && !selectedVenue) {
      api.venues.get(value).then(venue => {
        setSelectedVenue(venue);
        setQuery(venue.name);
      }).catch(() => {
        // Venue not found, clear selection
        setSelectedVenue(null);
        setQuery('');
      });
    }
  }, [value, selectedVenue]);

  // Search venues on query change
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    // Don't search if we have a selected venue and query matches it
    if (selectedVenue && query === selectedVenue.name) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await api.venues.search(query);
        setResults(response.venues);
      } catch (err) {
        console.error('Failed to search venues:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedVenue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (venue: VenueResponse) => {
    setSelectedVenue(venue);
    setQuery(venue.name);
    setShowDropdown(false);
    setResults([]);
    onChange(venue.id, venue);
  };

  const handleClear = () => {
    setSelectedVenue(null);
    setQuery('');
    setResults([]);
    onChange('', null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setShowDropdown(true);
    if (selectedVenue) {
      setSelectedVenue(null);
      onChange('', null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
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
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${error ? 'border-red-300' : 'border-gray-300'
            } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        />
        {selectedVenue && !disabled && (
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
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Selected venue info */}
      {selectedVenue && (
        <div className="mt-2 p-2 bg-emerald-50 rounded-lg text-sm">
          <p className="font-medium text-emerald-800">{selectedVenue.name}</p>
          <p className="text-emerald-600">{selectedVenue.address}</p>
          {selectedVenue.upcoming_events_count !== undefined && selectedVenue.upcoming_events_count > 0 && (
            <p className="text-xs text-emerald-500 mt-1">
              {selectedVenue.upcoming_events_count} upcoming event{selectedVenue.upcoming_events_count !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && results.length > 0 && !selectedVenue && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((venue) => (
            <button
              key={venue.id}
              type="button"
              onClick={() => handleSelect(venue)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
            >
              <p className="font-medium text-gray-900">{venue.name}</p>
              <p className="text-sm text-gray-500">{venue.address}</p>
              {venue.upcoming_events_count !== undefined && venue.upcoming_events_count > 0 && (
                <p className="text-xs text-emerald-600 mt-1">
                  {venue.upcoming_events_count} upcoming event{venue.upcoming_events_count !== 1 ? 's' : ''}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {showDropdown && query.length >= 0 && results.length === 0 && !isLoading && !selectedVenue && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
          No venues found matching &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}

export default VenueTypeahead;
