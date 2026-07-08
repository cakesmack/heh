/**
 * Venues Page
 * Browse venues across the Highlands
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useVenues } from '@/hooks/useVenues';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useAuth } from '@/hooks/useAuth';
import { VenueDiscoveryCard } from '@/components/venues/VenueDiscoveryCard';
import { Spinner } from '@/components/common/Spinner';
import { MobileDirectoryNav } from '@/components/common/MobileDirectoryNav';

export default function VenuesPage() {
  const { coordinates } = useGeolocation();
  const { isAuthenticated } = useAuth();

  // Local search term (updates on every keystroke for responsive UI)
  const [searchTerm, setSearchTerm] = useState('');
  // Debounced value that actually triggers the API call
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { venues, total, isLoading, error, fetchVenues } = useVenues({
    filters: { exclude_status: 'UNVERIFIED' },
    autoFetch: false,
  });

  // Track whether we've done the initial load
  const hasFetchedRef = useRef(false);

  // --- Debounce: propagate searchTerm → debouncedSearch after 400ms idle ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // --- Stabilize coordinates to primitive values ---
  const lat = coordinates?.latitude ?? null;
  const lng = coordinates?.longitude ?? null;

  // --- Single fetch effect: fires on debounced search or coordinate changes ---
  useEffect(() => {
    const filters: Record<string, any> = {
      exclude_status: 'UNVERIFIED',
    };

    if (lat !== null && lng !== null) {
      filters.latitude = lat;
      filters.longitude = lng;
      filters.radius_km = 100;
    }

    if (debouncedSearch.trim()) {
      filters.search = debouncedSearch.trim();
    }

    fetchVenues(filters);
    hasFetchedRef.current = true;
  }, [debouncedSearch, lat, lng, fetchVenues]);

  const pageTitle = "Event Venues, Halls & Theatres in the Highlands";
  const pageDescription = "Browse the complete directory of event venues, community halls, pubs, and theatres across Inverness and the Scottish Highlands. See what is happening near you.";

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
      </Head>
      <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <MobileDirectoryNav />
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Venues</h1>
              <p className="text-gray-600">
                Explore pubs, restaurants, museums, and more across the Scottish Highlands
              </p>
            </div>
            {isAuthenticated && (
              <Link
                href="/venues/new"
                className="inline-flex items-center justify-center sm:justify-start gap-2 px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Venue
              </Link>
            )}
          </div>

          {/* Search Input */}
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
              placeholder="Search venues by name or town..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {!isLoading && !error && (
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              {venues.length} venue{venues.length !== 1 ? 's' : ''} found
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="py-12">
            <Spinner size="lg" />
            <p className="text-center text-gray-600 mt-4">Loading venues...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="py-12 text-center">
            <div className="text-red-600 mb-2">
              <svg
                className="w-12 h-12 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-lg font-medium">Error loading venues</p>
              <p className="text-sm text-gray-600 mt-2">{error}</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && venues.length === 0 && (
          <div className="py-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900">No venues found</p>
            <p className="text-sm text-gray-600 mt-2">
              {searchTerm ? 'Try adjusting your search terms.' : 'Check back later for new venues in your area.'}
            </p>
          </div>
        )}

        {/* Venues Grid */}
        {!isLoading && !error && venues.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {venues.map((venue) => (
              <VenueDiscoveryCard key={venue.id} venue={venue} />
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
