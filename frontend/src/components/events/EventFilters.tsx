/**
 * EventFilters Component
 * Filter controls for event listing with categories, tags, and distance
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Category, Tag } from '@/types';
import { api } from '@/lib/api';
import { Button } from '@/components/common/Button';
import { LocationInput } from '@/components/common/LocationInput';

interface EventFiltersProps {
  onFilterChange: (filters: {
    category_id?: string;
    category_ids?: string[];
    category?: string;
    tag_names?: string[];
    tag?: string;
    q?: string;

    price_max?: number;
    featured_only?: boolean;
    latitude?: number;
    longitude?: number;
    radius_km?: number;
    location?: string;
    date_from?: string;
    date_to?: string;
  }) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  initialFilters?: {
    category?: string;
    tag?: string;
    q?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    date_from?: string;
    date_to?: string;
  };
}

export function EventFilters({ onFilterChange, userLocation, initialFilters }: EventFiltersProps) {
  // Categories from API
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [priceMax, setPriceMax] = useState<string>('');
  const [featuredOnly, setFeaturedOnly] = useState(false);

  // Location state
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    placeName: string;
  } | null>(null);

  // Date range state
  const [dateFrom, setDateFrom] = useState<string>(initialFilters?.date_from || '');
  const [dateTo, setDateTo] = useState<string>(initialFilters?.date_to || '');

  // Tag filter state
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.categories.list();
        setCategories(response.categories || []);

        // Apply initial category filter from URL
        if (initialFilters?.category) {
          const matchingCat = response.categories?.find(
            (c: Category) => c.slug === initialFilters.category || c.id === initialFilters.category
          );
          if (matchingCat) {
            setSelectedCategories([matchingCat.id]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [initialFilters?.category]);

  // Apply initial tag filter from URL
  useEffect(() => {
    if (initialFilters?.tag && !selectedTags.includes(initialFilters.tag)) {
      setSelectedTags([initialFilters.tag]);
    }
  }, [initialFilters?.tag]);

  // Apply initial location from URL
  useEffect(() => {
    if (initialFilters?.location && initialFilters?.latitude && initialFilters?.longitude) {
      setSelectedLocation({
        placeName: initialFilters.location,
        latitude: initialFilters.latitude,
        longitude: initialFilters.longitude
      });
    }
  }, [initialFilters?.location, initialFilters?.latitude, initialFilters?.longitude]);

  // Fetch tag suggestions on input change
  useEffect(() => {
    if (tagInput.length < 2) {
      setTagSuggestions([]);
      return;
    }

    if (tagDebounceRef.current) clearTimeout(tagDebounceRef.current);
    tagDebounceRef.current = setTimeout(async () => {
      try {
        const response = await api.tags.list(tagInput, 10);
        setTagSuggestions(response.tags.filter(t => !selectedTags.includes(t.name)));
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      }
    }, 300);

    return () => {
      if (tagDebounceRef.current) clearTimeout(tagDebounceRef.current);
    };
  }, [tagInput, selectedTags]);

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleAddTag = (tagName: string) => {
    const normalized = tagName.toLowerCase().trim().replace(/\s+/g, '-');
    if (normalized && !selectedTags.includes(normalized)) {
      setSelectedTags(prev => [...prev, normalized]);
    }
    setTagInput('');
    setTagSuggestions([]);
  };

  const handleRemoveTag = (tagName: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tagName));
  };

  const handleApplyFilters = () => {
    const filters: any = {};

    if (selectedCategories.length === 1) {
      // Find category slug for URL-friendly filtering
      const cat = categories.find(c => c.id === selectedCategories[0]);
      if (cat?.slug) {
        filters.category = cat.slug;
      } else {
        filters.category_id = selectedCategories[0];
      }
    } else if (selectedCategories.length > 1) {
      filters.category_ids = selectedCategories;
    }

    if (selectedTags.length === 1) {
      filters.tag = selectedTags[0];
    } else if (selectedTags.length > 0) {
      filters.tag_names = selectedTags;
    }

    if (priceMax) filters.price_max = parseFloat(priceMax);
    if (featuredOnly) filters.featured_only = true;

    // Location filter
    if (selectedLocation) {
      filters.latitude = selectedLocation.latitude;
      filters.longitude = selectedLocation.longitude;
      filters.radius_km = 32; // Fixed 20 miles (approx 32km)
      filters.location = selectedLocation.placeName;
    }

    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;

    onFilterChange(filters);
  };

  const handleClearFilters = () => {
    setSelectedCategories([]);
    setSelectedTags([]);
    setPriceMax('');
    setFeaturedOnly(false);
    setTagInput('');
    setSelectedLocation(null);
    setDateFrom('');
    setDateTo('');
    onFilterChange({});
  };

  const activeFilterCount =
    selectedCategories.length +
    selectedTags.length +
    (priceMax ? 1 : 0) +
    (featuredOnly ? 1 : 0) +
    (selectedLocation ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        {activeFilterCount > 0 && (
          <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full">
            {activeFilterCount} active
          </span>
        )}
      </div>

      {/* Category Filter - Multi-select chips */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Categories
        </label>
        {loadingCategories ? (
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 w-20 bg-gray-200 animate-pulse rounded-full" />
            ))}
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryToggle(cat.id)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${selectedCategories.includes(cat.id)
                  ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-emerald-400'
                  }`}
              >
                {cat.name}
                {cat.event_count !== undefined && cat.event_count > 0 && (
                  <span className="ml-1 text-xs text-gray-500">({cat.event_count})</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tag Filter */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tags
        </label>

        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedTags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-purple-600"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Tag Input */}
        <input
          type="text"
          value={tagInput}
          onChange={(e) => {
            setTagInput(e.target.value);
            setShowTagSuggestions(true);
          }}
          onFocus={() => setShowTagSuggestions(true)}
          onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && tagInput.trim()) {
              e.preventDefault();
              handleAddTag(tagInput);
            }
          }}
          placeholder="Search tags..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
        />

        {/* Tag Suggestions Dropdown */}
        {showTagSuggestions && tagSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {tagSuggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleAddTag(tag.name)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 flex justify-between items-center text-sm"
              >
                <span>{tag.name}</span>
                <span className="text-gray-400 text-xs">{tag.usage_count} uses</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Location Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Location
        </label>
        <LocationInput
          onSelect={setSelectedLocation}
          initialValue={initialFilters?.location || ''}
          placeholder="Town or Postcode"
        />
        {selectedLocation && (
          <p className="text-xs text-gray-500 mt-1">
            Searching within 20 miles of {selectedLocation.placeName}
          </p>
        )}
      </div>

      {/* Date Range Filter */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>
      </div>

      {/* Price Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Max Price (£)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={priceMax}
          onChange={(e) => setPriceMax(e.target.value)}
          placeholder="Any price"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Featured Only */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="featured-only"
          checked={featuredOnly}
          onChange={(e) => setFeaturedOnly(e.target.checked)}
          className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
        />
        <label htmlFor="featured-only" className="ml-2 text-sm text-gray-700">
          Featured events only
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2 pt-2">
        <Button onClick={handleApplyFilters} variant="primary" size="sm" fullWidth>
          Apply Filters
        </Button>
        <Button onClick={handleClearFilters} variant="outline" size="sm" fullWidth>
          Clear
        </Button>
      </div>
    </div>
  );
}
