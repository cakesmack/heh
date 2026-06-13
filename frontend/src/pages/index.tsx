/**
 * Home Page
 * Landing page with featured events and quick links
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useEvents } from '@/hooks/useEvents';
import { useAuth } from '@/hooks/useAuth';
import HeroSection from '@/components/home/HeroSection';
import CategoryGrid from '@/components/categories/CategoryGrid';
import FeaturedVenues from '@/components/home/FeaturedVenues';
import SearchResultsDrawer from '@/components/home/SearchResultsDrawer';
import RecommendedEvents from '@/components/home/RecommendedEvents';
import PopularEvents from '@/components/home/PopularEvents';
import PopularLocations from '@/components/PopularLocations';
import CuratedCollections from '@/components/home/CuratedCollections';
import SpotlightEvents from '@/components/home/SpotlightEvents';
import HappeningNextEvents from '@/components/home/HappeningNextEvents';
import LocalPartners from '@/components/home/LocalPartners';
import { eventsAPI } from '@/lib/api';
import { EventResponse } from '@/types';
import { getDateRangeFromFilter } from '@/lib/dateUtils';
import { optimizeImage } from '@/utils/imageOptimizer';

// Site constants
const SITE_URL = 'https://www.highlandeventshub.co.uk';
const DEFAULT_OG_IMAGE = 'https://www.highlandeventshub.co.uk/images/og-preview.jpg?v=3';

interface HomePageProps {
  meta?: any; // Passed to _app.tsx
}

// Client-side only - no getServerSideProps
export default function HomePage() {
  const { user } = useAuth();

  // Rows 1 & 2 State
  const [spotlightEvents, setSpotlightEvents] = useState<EventResponse[]>([]);
  const [happeningNextEvents, setHappeningNextEvents] = useState<EventResponse[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);

  useEffect(() => {
    const fetchHomeEvents = async () => {
      try {
        const [spotlightRes, upcomingRes] = await Promise.all([
          eventsAPI.list({ featured_only: true, limit: 4 }),
          eventsAPI.list({ limit: 14, include_past: false, sort_by: 'date', max_duration_days: 3 })
        ]);

        const spotlight = spotlightRes.events || [];
        setSpotlightEvents(spotlight);

        // Exclude spotlight events from happening next
        const spotlightIds = new Set(spotlight.map(e => e.id));
        const spotlightParentIds = new Set(spotlight.map(e => e.parent_event_id).filter(Boolean));

        const filteredUpcoming = (upcomingRes.events || [])
          .filter(e => !spotlightIds.has(e.id) && (!e.parent_event_id || !spotlightParentIds.has(e.parent_event_id)))
          .slice(0, 10);

        setHappeningNextEvents(filteredUpcoming);
      } catch (err) {
        console.error('Failed to fetch home page rows:', err);
      } finally {
        setLoadingRows(false);
      }
    };

    fetchHomeEvents();
  }, []);

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchSort, setSearchSort] = useState('date_asc');
  const SEARCH_ITEMS_PER_PAGE = 8;
  const [activeFilters, setActiveFilters] = useState<{
    q?: string;
    location?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    category?: string;
  }>({});

  // Search Events
  const {
    events: searchResults,
    total: totalSearchResults,
    isLoading: isSearchLoading,
    fetchEvents: fetchSearchEvents
  } = useEvents({
    filters: {
      limit: SEARCH_ITEMS_PER_PAGE,
      skip: 0
    },
    limit: SEARCH_ITEMS_PER_PAGE, // Ensure API uses the exact same limit as UI
    autoFetch: false,
  });

  // Handle Search
  const handleSearch = async (filters: {
    q?: string;
    location?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    category?: string;
    latitude?: number;
    longitude?: number;
    radius?: string;
  }) => {
    // Check if all filters are empty (Clear was pressed)
    const hasActiveFilters = filters.q || filters.location || filters.date ||
      filters.category || filters.latitude;

    if (!hasActiveFilters) {
      // Close search drawer and reset state when filters are cleared
      setActiveFilters({});
      setIsSearchOpen(false);
      return;
    }

    setActiveFilters(filters);
    setSearchPage(1);
    setIsSearchOpen(true);

    const dateRange = filters.date === 'custom'
      ? getDateRangeFromFilter('custom', filters.dateFrom, filters.dateTo)
      : {};

    const searchFilters: any = {
      limit: SEARCH_ITEMS_PER_PAGE,
      skip: 0,
      sort_by: searchSort,
      ...filters,
      ...dateRange,
    };

    // Remove raw date params for custom, but KEEP 'date' for presets so api.ts can map it to time_range
    if (filters.date === 'custom') {
      delete searchFilters.date;
      delete searchFilters.dateFrom;
      delete searchFilters.dateTo;
    } else {
      delete searchFilters.dateFrom;
      delete searchFilters.dateTo;
    }

    // Fetch results first
    await fetchSearchEvents(searchFilters);

    // Track after state updates with accurate result count
    // Use setTimeout to ensure state has updated
    setTimeout(() => {
      import('@/lib/analytics').then(({ analytics }) => {
        // Determine search type: location-based or keyword-based
        const searchType = filters.location && !filters.q
          ? 'location'
          : filters.q && !filters.location
            ? 'keyword'
            : 'mixed';

        analytics.track('search_query', {
          term: filters.q || filters.location || '',
          type: searchType,
          source: 'home_hero',
          result_count: totalSearchResults,
          query: filters.q,
          location: filters.location,
          category: filters.category,
          date: filters.date
        });
      });
    }, 100);
  };

  // Handle Search Sort Change
  const handleSortChange = async (newSort: string) => {
    setSearchSort(newSort);

    const dateRange = activeFilters.date === 'custom'
      ? getDateRangeFromFilter('custom', activeFilters.dateFrom, activeFilters.dateTo)
      : {};

    // Trigger search with new sort
    const searchFilters: any = {
      limit: SEARCH_ITEMS_PER_PAGE,
      skip: (searchPage - 1) * SEARCH_ITEMS_PER_PAGE,
      sort_by: newSort,
      ...activeFilters,
      ...dateRange,
    };

    if (activeFilters.date === 'custom') {
      delete searchFilters.date;
      delete searchFilters.dateFrom;
      delete searchFilters.dateTo;
    } else {
      delete searchFilters.dateFrom;
      delete searchFilters.dateTo;
    }

    await fetchSearchEvents(searchFilters);
  };

  // Handle Search Pagination
  const handleSearchPageChange = async (newPage: number) => {
    setSearchPage(newPage);
    const skip = (newPage - 1) * SEARCH_ITEMS_PER_PAGE;

    const dateRange = activeFilters.date === 'custom'
      ? getDateRangeFromFilter('custom', activeFilters.dateFrom, activeFilters.dateTo)
      : {};

    const searchFilters: any = {
      limit: SEARCH_ITEMS_PER_PAGE,
      skip,
      sort_by: searchSort,
      ...activeFilters,
      ...dateRange,
    };

    if (activeFilters.date === 'custom') {
      delete searchFilters.date;
      delete searchFilters.dateFrom;
      delete searchFilters.dateTo;
    } else {
      delete searchFilters.dateFrom;
      delete searchFilters.dateTo;
    }

    await fetchSearchEvents(searchFilters);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Highland Events Hub - Discover Events in the Highlands</title>
        <meta name="description" content="Discover the best events, gigs, markets and festivals across the Scottish Highlands." />
        <meta property="og:title" content="Highland Events Hub - Discover Events in the Highlands" />
        <meta property="og:description" content="Discover the best events, gigs, markets and festivals across the Scottish Highlands." />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:type" content="website" />
      </Head>

      {/* Hero Section with Search */}
      <HeroSection onSearch={handleSearch} isSearchLoading={isSearchLoading} />

      {/* Categories Section */}
      <div id="categories">
        <CategoryGrid />
      </div>

      {/* Popular Locations Grid */}
      <PopularLocations />


      <SearchResultsDrawer
        isOpen={isSearchOpen}
        isLoading={isSearchLoading}
        results={searchResults}
        total={totalSearchResults}
        page={searchPage}
        itemsPerPage={SEARCH_ITEMS_PER_PAGE} // Pass the single source of truth
        onClose={() => setIsSearchOpen(false)}
        onPageChange={handleSearchPageChange}
        searchParams={activeFilters}
        sort={searchSort}
        onSortChange={handleSortChange}
      />


      {/* Row 2 - Happening Next */}
      <HappeningNextEvents events={happeningNextEvents} isLoading={loadingRows} />

      {/* Row 1 - Spotlight */}
      <SpotlightEvents events={spotlightEvents} isLoading={loadingRows} />

      {/* Row 3 - Popular Events */}
      <PopularEvents />

      <RecommendedEvents />

      {/* Row 4 - Curated Collections */}
      <CuratedCollections />

      {/* Row 5 - Top Venues */}
      <FeaturedVenues />

      {/* Local Partners B2B Real Estate */}
      {false && <LocalPartners />}

      {/* CTA Section - Guests Only */}
      {!user && (
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-emerald-900">
            <div className="absolute inset-0 bg-[url('/images/pattern.svg')] opacity-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-900 to-emerald-800" />
          </div>
          <div className="relative max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
              Ready to Explore?
            </h2>
            <p className="text-xl text-emerald-100 mb-10 font-light">
              Join thousands of others discovering the best of Highland culture.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="px-8 py-4 bg-white text-emerald-900 rounded-xl font-bold hover:bg-emerald-50 transition-all transform hover:-translate-y-1 shadow-lg"
              >
                Create Free Account
              </Link>
              <Link
                href="/submit-event"
                className="px-8 py-4 bg-emerald-800 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all transform hover:-translate-y-1 shadow-lg border border-emerald-700"
              >
                Submit an Event
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Organizer CTA Banner */}
      <section className="relative py-28 px-4 text-center overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${optimizeImage('dd6cb0f1-b4ca-403c-fb75-d31c4ae4e000', 'hero')})`,
          }}
        />
        {/* Green Overlay */}
        <div className="absolute inset-0 bg-emerald-700/90" />

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Fill Your Venue. Find Your Crowd.
          </h2>
          <p className="text-emerald-100 mb-10 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Stop hoping the Facebook algorithm works. List your event on the Highlands' dedicated discovery platform and get seen by people actively looking for things to do.
          </p>
          <a
            href="/submit-event"
            className="inline-block bg-white text-emerald-700 font-bold py-4 px-10 rounded-full hover:bg-emerald-50 transition-colors shadow-xl text-lg"
          >
            List an Event for Free
          </a>
        </div>
      </section>
    </div>
  );
}
