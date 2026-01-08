/**
 * Home Page
 * Landing page with featured events and quick links
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useEvents } from '@/hooks/useEvents';
import { useAuth } from '@/hooks/useAuth';
import HeroSection from '@/components/home/HeroSection';
import MagazineGrid from '@/components/home/MagazineGrid';
import CategoryGrid from '@/components/categories/CategoryGrid';
import HomeFeedTabs from '@/components/home/HomeFeedTabs';
import FeaturedVenues from '@/components/home/FeaturedVenues';


import DiscoveryBar from '@/components/home/DiscoveryBar';
import SearchResultsDrawer from '@/components/home/SearchResultsDrawer';
import RecommendedEvents from '@/components/home/RecommendedEvents';
import PopularEvents from '@/components/home/PopularEvents';
import CuratedCollections from '@/components/home/CuratedCollections';
import { getDateRangeFromFilter } from '@/lib/dateUtils';

export default function HomePage() {
  const { coordinates } = useGeolocation();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const EVENTS_PER_PAGE = 9;

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

  // 1. Fetch Hero Events (Top 10 Featured)
  const { events: heroEvents } = useEvents({
    filters: { featured_only: true, limit: 10 },
    autoFetch: true,
  });

  // 2. Fetch Magazine Grid Events (Static Teaser)
  const {
    events: magazineEvents,
    isLoading: isMagazineLoading
  } = useEvents({
    filters: {
      limit: 16, // Carousel (up to 3) + 12 grid items + buffer
      skip: 0
    },
    autoFetch: true, // Auto fetch on mount
  });

  // 3. Search Events
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
  }) => {
    setActiveFilters(filters);
    setSearchPage(1);
    setIsSearchOpen(true);

    const dateRange = getDateRangeFromFilter(filters.date || '', filters.dateFrom, filters.dateTo);

    const searchFilters: any = {
      limit: SEARCH_ITEMS_PER_PAGE,
      skip: 0,
      sort_by: searchSort,
      ...filters,
      ...dateRange,
    };

    // Remove raw date params that aren't needed by API
    if (filters.date) {
      delete searchFilters.date;
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

    const dateRange = getDateRangeFromFilter(
      activeFilters.date || '',
      activeFilters.dateFrom,
      activeFilters.dateTo
    );

    // Trigger search with new sort
    const searchFilters: any = {
      limit: SEARCH_ITEMS_PER_PAGE,
      skip: (searchPage - 1) * SEARCH_ITEMS_PER_PAGE,
      sort_by: newSort,
      ...activeFilters,
      ...dateRange,
    };

    if (activeFilters.date) {
      delete searchFilters.date;
      delete searchFilters.dateFrom;
      delete searchFilters.dateTo;
    }

    await fetchSearchEvents(searchFilters);
  };

  // Handle Search Pagination
  const handleSearchPageChange = async (newPage: number) => {
    setSearchPage(newPage);
    const skip = (newPage - 1) * SEARCH_ITEMS_PER_PAGE;

    const dateRange = getDateRangeFromFilter(
      activeFilters.date || '',
      activeFilters.dateFrom,
      activeFilters.dateTo
    );

    const searchFilters: any = {
      limit: SEARCH_ITEMS_PER_PAGE,
      skip,
      sort_by: searchSort,
      ...activeFilters,
      ...dateRange,
    };

    if (activeFilters.date) {
      delete searchFilters.date;
      delete searchFilters.dateFrom;
      delete searchFilters.dateTo;
    }

    await fetchSearchEvents(searchFilters);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Highland Events Hub - Discover Events in the Highlands</title>
        <meta name="description" content="Find the best events, gigs, and festivals in the Scottish Highlands." />
      </Head>

      {/* Hero Section */}
      <HeroSection />

      {/* Discovery System */}
      <DiscoveryBar onSearch={handleSearch} isLoading={isSearchLoading} />


      <SearchResultsDrawer
        isOpen={isSearchOpen}
        isLoading={isSearchLoading}
        results={searchResults}
        total={totalSearchResults}
        page={searchPage}
        onClose={() => setIsSearchOpen(false)}
        onPageChange={handleSearchPageChange}
        searchParams={activeFilters}
        sort={searchSort}
        onSortChange={handleSortChange}
      />

      {/* Feed Switcher Section */}
      <HomeFeedTabs latestEvents={magazineEvents} user={user} />

      <RecommendedEvents />

      {/* Popular Events Section */}
      <PopularEvents />

      {/* Organizer CTA Banner */}
      <section className="bg-emerald-600 py-12 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Hosting an event in the Highlands?
          </h2>
          <p className="text-emerald-100 mb-8 text-lg">
            List your event for free and reach thousands of locals and visitors.
          </p>
          <a
            href="/submit-event"
            className="inline-block bg-white text-emerald-600 font-bold py-3 px-8 rounded-full hover:bg-emerald-50 transition-colors shadow-lg"
          >
            List it for free today
          </a>
        </div>
      </section>

      {/* Featured Venues Carousel */}
      <FeaturedVenues />

      {/* Categories Section */}
      <div id="categories">
        <CategoryGrid />
      </div>

      {/* Curated Collections */}
      <CuratedCollections />

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
    </div>
  );
}
