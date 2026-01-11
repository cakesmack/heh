/**
 * Home Page
 * Landing page with featured events and quick links
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useEvents } from '@/hooks/useEvents';
import { useAuth } from '@/hooks/useAuth';
import HeroSection from '@/components/home/HeroSection';
import Features from '@/components/home/Features';
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

// Site constants
const SITE_URL = 'https://www.highlandeventshub.co.uk';
const DEFAULT_OG_IMAGE = 'https://res.cloudinary.com/dakq1xwn1/image/upload/v1767454232/highland_events/events/lhxbivhjsqpwn1hsbz5x.jpg';

interface HomePageProps {
  socialImage: string;
}

export default function HomePage({ socialImage }: HomePageProps) {
  const { coordinates } = useGeolocation();
  const { user } = useAuth();

  // Create optimized OG image URL for WhatsApp/Socials
  // Inject Cloudinary transformations if it's a Cloudinary URL
  const optimizedOgImage = socialImage && socialImage.includes('cloudinary') && !socialImage.includes('w_')
    ? socialImage.replace('/upload/', '/upload/w_1200,h_630,c_fill,q_auto/')
    : socialImage;
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
        <link rel="canonical" href={SITE_URL} />

        {/* Open Graph / Facebook / WhatsApp */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:title" content="Highland Events Hub" />
        <meta property="og:description" content="Discover the best events, gigs, markets and festivals across the Scottish Highlands." />
        <meta property="og:image" content={optimizedOgImage} key="og-image" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Highland Events Hub" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@HighlandEvents" />
        <meta name="twitter:title" content="Highland Events Hub" />
        <meta name="twitter:description" content="Discover the best events, gigs, markets and festivals across the Scottish Highlands." />
        <meta name="twitter:image" content={optimizedOgImage} key="twitter-image" />
      </Head>

      {/* Hero Section */}
      <HeroSection />

      {/* Discovery System */}
      <DiscoveryBar onSearch={handleSearch} isLoading={isSearchLoading} />

      {/* Features Section */}
      <Features />

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
      <section className="relative py-28 px-4 text-center overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(https://res.cloudinary.com/dakq1xwn1/image/upload/v1767454232/highland_events/events/lhxbivhjsqpwn1hsbz5x.jpg)',
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

// Server-side fetch for OG image from Hero carousel
export const getServerSideProps: GetServerSideProps<HomePageProps> = async () => {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  try {
    // Parallel fetch: Welcome Slot (Static) + Paid Slots (Dynamic)
    const [manualRes, paidRes] = await Promise.all([
      fetch(`${API_URL}/api/hero?active_only=true`),
      fetch(`${API_URL}/api/featured/active?slot_type=hero_home`)
    ]);

    let heroImage = null;

    // 1. Check Welcome Slide (Static)
    if (manualRes.ok) {
      const slides = await manualRes.json();
      const welcome = slides.find((s: any) => (s.position === 1 || s.type === 'welcome') && s.image_url);
      if (welcome) heroImage = welcome.image_url;
    }

    // 2. If no welcome image, check Paid Hero Slots
    if (!heroImage && paidRes.ok) {
      const paidBookings = await paidRes.json();
      // Need to fetch event details for the first booking to get the image
      if (paidBookings.length > 0) {
        const firstBooking = paidBookings[0];
        try {
          // Fetch event details to get the image
          const eventRes = await fetch(`${API_URL}/api/events/${firstBooking.event_id}`);
          if (eventRes.ok) {
            const event = await eventRes.json();
            if (event.image_url) heroImage = event.image_url;
          }
        } catch (e) {
          console.error('Error fetching event details for OG image:', e);
        }
      }
    }

    if (heroImage) {
      // Ensure absolute URL
      const socialImage = heroImage.startsWith('http')
        ? heroImage
        : `${SITE_URL}${heroImage}`;
      return { props: { socialImage } };
    }

  } catch (error) {
    console.error('Failed to fetch hero slides for OG image:', error);
  }

  // Fallback to specific cloudinary default
  return { props: { socialImage: DEFAULT_OG_IMAGE } };
};
