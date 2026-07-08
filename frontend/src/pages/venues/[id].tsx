/**
 * Venue Detail Page
 * Show venue details with events and promotions
 */

import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import Head from 'next/head';
import OptimizedImage from '@/components/ui/OptimizedImage';
import dynamic from 'next/dynamic';
import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { VenueResponse, EventResponse, VenueStaffResponse } from '@/types';
import { optimizeImage } from '@/utils/imageOptimizer';
import ReportModal from '@/components/common/ReportModal';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button, cn } from '@/components/ui/button';
import { Heart, HeartOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Spinner } from '@/components/common/Spinner';
import { EventCard } from '@/components/events/EventCard';

import { FollowButton } from '@/components/common/FollowButton';
import RichText from '@/components/ui/RichText';
import { EditVenueModal } from '@/components/venues/EditVenueModal';
import SocialShare from '@/components/common/SocialShare';

// Icons
const GlobeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth={2} />
  </svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Dynamic import for GoogleMiniMap to avoid SSR issues
const GoogleMiniMap = dynamic(() => import('@/components/maps/GoogleMiniMap'), { ssr: false });

interface VenueDetailPageProps {
  initialVenue?: VenueResponse;
}

export default function VenueDetailPage({ initialVenue }: VenueDetailPageProps) {
  const router = useRouter();
  const { id } = router.query;
  const [venue, setVenue] = useState<VenueResponse | null>(initialVenue || null);
  const [events, setEvents] = useState<EventResponse[]>([]);

  const [isLoading, setIsLoading] = useState(!initialVenue);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser, refreshUser } = useAuth();
  const { trackVenueView } = useAnalytics();
  const [staff, setStaff] = useState<VenueStaffResponse[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Pagination State
  const [eventsTotal, setEventsTotal] = useState(0);
  const [isLoadingMoreEvents, setIsLoadingMoreEvents] = useState(false);

  // Check if current user is the owner or admin
  // We use venue.owner_id directly from the response
  const isOwner = currentUser && venue && (venue.owner_id === currentUser.id || currentUser.is_admin);

  const fetchVenueDetails = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await api.venues.get(id as string);
      setVenue(data);

      // Fetch initial events
      const eventsData = await api.events.list({
        venue_id: data.id,
        limit: 12,
        sort_by: 'date_start',

        // Show all events (including drafts) to owner? 
        // For now, let's keep it standard. Owners can see drafts in admin panel if needed, 
        // or we can add logic here later.

      });
      setEvents(eventsData.events);
      setEventsTotal(eventsData.total || 0);



    } catch (err) {
      console.error('Error fetching venue:', err);
      setError('Venue not found or error loading details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (router.isReady && id) {
      fetchVenueDetails();
    }
  }, [router.isReady, id, fetchVenueDetails]);

  // Fetch staff only if owner
  useEffect(() => {
    if (isOwner && venue?.id) {
      fetchStaff();
    }
  }, [isOwner, venue?.id]);

  const fetchStaff = async () => {
    if (!venue?.id) return;
    setIsStaffLoading(true);
    try {
      const staffData = await api.venues.listStaff(venue.id);
      setStaff(staffData);
    } catch (err) {
      console.error('Error fetching staff:', err);
    } finally {
      setIsStaffLoading(false);
    }
  };

  const handleUpdateVenue = () => {
    // Refresh details after edit
    fetchVenueDetails();
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail || !venue?.id) return;
    setIsAddingStaff(true);
    try {
      await api.venues.addStaff(venue.id, { user_email: newStaffEmail, role: 'staff' });
      setNewStaffEmail('');
      fetchStaff();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add staff');
    } finally {
      setIsAddingStaff(false);
    }
  };

  const handleRemoveStaff = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?') || !venue?.id) return;
    try {
      await api.venues.removeStaff(venue.id, userId);
      fetchStaff();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove staff');
    }
  };

  useEffect(() => {
    if (venue?.id) {
      trackVenueView(venue.id);
    }
  }, [venue?.id, trackVenueView]);

  const handleLoadMoreEvents = async () => {
    if (!venue?.id || isLoadingMoreEvents) return;
    setIsLoadingMoreEvents(true);
    try {
      const skip = events.length;
      const res = await api.events.list({ venue_id: venue.id, skip, limit: 12 });

      if (res.events?.length > 0) {
        setEvents(prev => [...prev, ...res.events]);
      }
    } catch (err) {
      console.error('Error loading more events:', err);
    } finally {
      setIsLoadingMoreEvents(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-12 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="min-h-screen pt-24 pb-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Venue Not Found</h1>
        <p className="text-gray-600 mb-6">{error || "The venue you're looking for doesn't exist."}</p>
        <Link href="/locations">
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg active:scale-95">
            Browse Locations
          </button>
        </Link>
      </div>
    );
  }

  // Extract city from address for localized SEO templates
  const city = venue.address
    ? (venue.address.split(',').slice(-2, -1)[0]?.trim() || venue.address.split(',').pop()?.trim() || 'Highlands')
    : 'Highlands';

  const townOrCity = venue.city || city || 'the Highlands';

  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.highlandeventshub.co.uk';

  // SEO: Priority → manual override → directory intent template
  const pageTitle = venue.seo_title
    || `${venue.name} Contact Details, Location & Venue Hire | ${townOrCity}`;

  const pageDescription = venue.seo_description
    || `Find contact details, address, photographs, and booking information for ${venue.name} in ${townOrCity}. View the complete Highland venue directory.`;

  const canonicalUrl = `${siteUrl}/venues/${venue.slug || venue.id}`;
  const venueImageUrl = venue.image_url ? optimizeImage(venue.image_url, 1200) : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} key="description" />
        <link rel="canonical" href={canonicalUrl} key="canonical" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" key="og-type" />
        <meta property="og:url" content={canonicalUrl} key="og-url" />
        <meta property="og:title" content={pageTitle} key="og-title" />
        <meta property="og:description" content={pageDescription} key="og-description" />
        {venueImageUrl && <meta property="og:image" content={venueImageUrl} key="og-image" />}

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" key="twitter-card" />
        <meta name="twitter:url" content={canonicalUrl} key="twitter-url" />
        <meta name="twitter:title" content={pageTitle} key="twitter-title" />
        <meta name="twitter:description" content={pageDescription} key="twitter-description" />
        {venueImageUrl && <meta name="twitter:image" content={venueImageUrl} key="twitter-image" />}

        {/* JSON-LD Structured Data for Venue */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Place",
              "name": venue.name,
              ...(venue.description ? {
                "description": venue.description.replace(/<[^>]*>?/gm, '').substring(0, 300)
              } : {}),
              ...(venueImageUrl ? { "image": venueImageUrl } : {}),
              "address": {
                "@type": "PostalAddress",
                "streetAddress": venue.address_full || venue.address,
                "addressLocality": city,
                "addressRegion": "Highland",
                "postalCode": venue.postcode || "",
                "addressCountry": "GB"
              },
              ...((venue.latitude && venue.longitude) ? {
                "geo": {
                  "@type": "GeoCoordinates",
                  "latitude": venue.latitude,
                  "longitude": venue.longitude
                }
              } : {}),
              ...(venue.phone ? { "telephone": venue.phone } : {}),
              ...(venue.website ? { "url": venue.website } : {}),
            })
          }}
        />
      </Head>

      {/* Cinematic Hero */}
      <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
        {/* Blurred Background */}
        <div className="absolute inset-0">
          {venue.image_url ? (
            <OptimizedImage
              src={venue.image_url}
              variant="thumb"
              alt=""
              fill
              className="object-cover blur-2xl scale-110 opacity-60"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-800 to-blue-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />
        </div>

        {/* Sharp Centered Image */}
        <div className="absolute inset-0 flex items-center justify-center px-4 pt-24">
          <div className="relative w-full max-w-3xl aspect-[16/9] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10">
            {venue.image_url ? (
              <OptimizedImage
                src={venue.image_url}
                variant="hero"
                alt={venue.name}
                fill
                sizes="(max-width: 768px) 100vw, 800px"
                className="object-cover object-top"
                priority
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                <span className="text-8xl font-bold text-white/20">{venue.name.charAt(0)}</span>
              </div>
            )}

            {/* Featured Badge */}
            {venue.category && (
              <div className="absolute top-6 left-6">
                <div className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold uppercase tracking-widest rounded-full shadow-lg">
                  {venue.category.name}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back Button */}
        <Link href="/venues" className="absolute top-8 left-8 inline-flex items-center text-sm font-medium text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 transition-all z-20">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Venues
        </Link>

        {/* Report Button */}
        <button
          onClick={() => setReportModalOpen(true)}
          className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/10 hover:bg-red-500/20 backdrop-blur-md border border-white/10 text-white/70 hover:text-red-400 flex items-center justify-center transition-all z-20"
          title="Report Venue"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </button>
      </div>

      {/* Info Ribbon */}
      <div className="sticky top-0 z-30 bg-stone-950/80 backdrop-blur-xl border-y border-white/5 text-white py-6 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white truncate mb-2">{venue.name}</h1>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-stone-400 text-sm">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <span className="text-stone-200">{venue.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-stone-200">{venue.category?.name || 'Venue'}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center md:justify-end gap-4 flex-wrap">
              <SocialShare
                url={typeof window !== 'undefined' ? window.location.href : ''}
                title={venue.name}
                description={venue.description}
                variant="white"
              />
              <FollowButton targetId={venue.id} targetType="venue" className="rounded-full" />
              {isOwner && (
                <button
                  onClick={() => setEditModalOpen(true)}
                  className="bg-stone-800 border border-white/10 hover:bg-stone-700 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center whitespace-nowrap shrink-0"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit Details
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
          {/* Content Area - 70% */}
          <div className="lg:col-span-7 space-y-8">
            {/* Title & Description Block */}
            <div className="space-y-4">
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">{venue.name}</h1>
              {venue.description ? (
                <Card>
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-widest mb-6 flex items-center">
                    Venue Info
                  </h2>
                  <RichText content={venue.description} className="text-gray-600 text-lg leading-relaxed relative z-10" />
                </Card>
              ) : (
                <Card>
                  <p className="text-gray-400 italic bg-gray-50 rounded-lg p-6 border border-dashed border-gray-200">No description available for this venue.</p>
                </Card>
              )}
            </div>

            {/* About / History Section */}
            {venue.about_history && venue.about_history.trim() !== '' && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>About {venue.name}</span>
                </h2>
                <RichText content={venue.about_history} className="text-gray-600 leading-relaxed text-base" />
                <div className="pt-4 border-t border-gray-100 mt-6 flex flex-wrap items-center gap-6 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">Address:</span>
                    <span>{venue.address_full || venue.formatted_address || venue.address}</span>
                  </div>
                  {venue.city && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">Location:</span>
                      <span>{venue.city}</span>
                    </div>
                  )}
                  {venue.postcode && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">Postcode:</span>
                      <span>{venue.postcode}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Amenities Section */}
            <Card>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Amenities & Features</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {venue.is_dog_friendly && (
                  <AmenityItem
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5c1.5-1 3.5-.5 4.5 1s.5 3.5-1 4.5c-1.5 1-2 3-2 5 0 1-.5 2.5-1.5 3.5m0-14c-1.5-1-3.5-.5-4.5 1s-.5 3.5 1 4.5c1.5 1 2 3 2 5 0 1 .5 2.5 1.5 3.5m0-14v1m0 13v-1" /></svg>}
                    label="Dog Friendly"
                    active={true}
                  />
                )}
                {venue.has_wheelchair_access && (
                  <AmenityItem
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="4" r="2" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0l-4 8m4-8h4l2 8m-6-8h-4" /></svg>}
                    label="Wheelchair Access"
                    active={true}
                  />
                )}
                {venue.has_parking && (
                  <AmenityItem
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h3a2 2 0 010 4H9V9z" /></svg>}
                    label="Parking Available"
                    active={true}
                  />
                )}
                {venue.serves_food && (
                  <AmenityItem
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
                    label="Serves Food"
                    active={true}
                  />
                )}
              </div>
              {!venue.is_dog_friendly && !venue.has_wheelchair_access && !venue.has_parking && !venue.serves_food && (
                <p className="text-gray-500 italic text-sm">No amenities listed for this venue.</p>
              )}
              {venue.amenities_notes && (
                <div className="mt-6 p-4 bg-gray-50 rounded-xl text-sm text-gray-600 italic">
                  &ldquo;{venue.amenities_notes}&rdquo;
                </div>
              )}
            </Card>

            {/* Upcoming Events Section */}
            {events.length > 0 && (
              <div className="pt-8 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <div>
                    <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Upcoming Events</h2>
                    <p className="text-gray-500 text-sm font-medium">Discover what's happening soon at {venue.name}</p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Total Events</span>
                    <span className="bg-gray-900 text-white font-black px-3 py-1.5 rounded-full">{eventsTotal} Results</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {events.map((event) => (
                    <div key={event.id} className="group">
                      <EventCard event={event} canManage={!!isOwner} />
                    </div>
                  ))}
                </div>

                {/* Load More Button */}
                {events.length < eventsTotal && (
                  <div className="mt-12 flex justify-center">
                    <button
                      onClick={handleLoadMoreEvents}
                      disabled={isLoadingMoreEvents}
                      className="px-8 py-3.5 border-2 border-gray-200 text-gray-700 font-black rounded-full hover:bg-gray-50 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-sm"
                    >
                      {isLoadingMoreEvents && <Spinner size="sm" />}
                      Load More Results
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Staff Section (if owner) */}
            {isOwner && (
              <Card>
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Manage Staff</h3>
                </div>

                <form onSubmit={handleAddStaff} className="flex gap-2 mb-8">
                  <div className="flex-1 relative">
                    <input
                      type="email"
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      placeholder="Enter staff email address..."
                      className="w-full pl-4 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isAddingStaff}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-full transition-all active:scale-95 flex items-center justify-center shadow-lg"
                  >
                    {isAddingStaff ? <Spinner size="sm" /> : 'Add Team Member'}
                  </button>
                </form>

                {isStaffLoading ? (
                  <div className="flex justify-center py-12">
                    <Spinner />
                  </div>
                ) : staff.length > 0 ? (
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">User</th>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Role</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {staff.map((s) => (
                          <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-gray-900">{s.user_username || 'User'}</div>
                              <div className="text-xs text-gray-500">{s.user_email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-600 uppercase tracking-widest border border-blue-100">
                                {s.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => handleRemoveStaff(s.user_id)}
                                className="text-red-500 hover:text-red-700 font-bold text-xs uppercase tracking-widest"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-500 font-medium">No team members added yet.</p>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Sidebar - 30% (Sticky) */}
          <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-24 self-start">
            {/* Contact Card (first for immediate visibility) */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-widest mb-6">Connect</h3>
              <div className="space-y-5 text-sm">
                {(venue.phone || venue.email) && (
                  <div className="space-y-4">
                    {venue.phone && (
                      <div className="pb-4 border-b border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Phone</p>
                        <a href={`tel:${venue.phone}`} className="text-emerald-600 hover:text-emerald-700 font-bold transition-all text-base">
                          {venue.phone}
                        </a>
                      </div>
                    )}
                    {venue.email && (
                      <div className="pb-4 border-b border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Email</p>
                        <a href={`mailto:${venue.email}`} className="text-emerald-600 hover:text-emerald-700 font-bold transition-all truncate block text-base">
                          {venue.email}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Socials & Website</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {venue.website && (
                      <a
                        href={venue.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all hover:text-emerald-600 hover:border-emerald-200"
                        title="Website"
                      >
                        <GlobeIcon className="w-5 h-5" />
                      </a>
                    )}
                    {(venue.facebook_url || venue.social_facebook) && (
                      <a
                        href={venue.facebook_url || venue.social_facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all hover:text-blue-600 hover:border-blue-200"
                        title="Facebook"
                      >
                        <FacebookIcon className="w-5 h-5" />
                      </a>
                    )}
                    {(venue.instagram_url || venue.social_instagram) && (
                      <a
                        href={venue.instagram_url || venue.social_instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all hover:text-pink-600 hover:border-pink-200"
                        title="Instagram"
                      >
                        <InstagramIcon className="w-5 h-5" />
                      </a>
                    )}
                    {venue.social_x && (
                      <a
                        href={venue.social_x}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all hover:text-stone-900 hover:border-stone-300"
                        title="X (Twitter)"
                      >
                        <TwitterIcon className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Map Card */}
            <Card className="overflow-hidden p-0">
              <div className="p-6 border-b border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 uppercase">Location</p>
                <h3 className="text-sm font-bold text-gray-900 leading-snug">{venue.address}</h3>
              </div>
              {venue.latitude && venue.longitude && (
                <div className="h-[300px] w-full bg-gray-100">
                  <GoogleMiniMap
                    latitude={venue.latitude}
                    longitude={venue.longitude}
                    height="300px"
                    zoom={15}
                    interactive={true}
                  />
                </div>
              )}
              <div className="p-4 bg-gray-50">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                >
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  Get Directions
                </a>
              </div>
            </Card>

            {/* Opening Hours Card */}
            {venue.opening_hours && (
              <Card>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Opening Hours</p>
                <RichText content={venue.opening_hours} className="text-sm font-medium text-gray-600 leading-relaxed" />
              </Card>
            )}

            {/* Claim Card */}
            {!isOwner && (
              <div className="p-8 bg-stone-900 rounded-3xl text-white shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-lg">Is this your venue?</h3>
                </div>
                <p className="text-sm text-stone-400 mb-6 leading-relaxed">Claim this listing to manage events, promotions, and verify your details.</p>
                <button
                  onClick={async () => {
                    const reason = prompt("Why do you want to claim this venue?");
                    if (!reason) return;
                    try {
                      await api.venueClaims.create(venue.id, reason);
                      alert("Claim submitted successfully!");
                      refreshUser();
                    } catch (err) {
                      alert("Failed to submit claim.");
                    }
                  }}
                  className="w-full py-3 bg-white text-stone-950 rounded-xl text-sm font-black hover:bg-stone-200 transition-all active:scale-[0.98]"
                >
                  Claim Venue
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {venue && (
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="venue"
          targetId={venue.id}
          targetName={venue.name}
        />
      )}

      {/* Edit Modal */}
      {venue && isOwner && (
        <EditVenueModal
          venueId={venue.id}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={handleUpdateVenue}
        />
      )}
    </div>
  );
}

// Helper Component for Amenity Item
function AmenityItem({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${active ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
      <div className={active ? 'text-emerald-600' : 'text-gray-400'}>
        {icon}
      </div>
      <span className="font-medium text-sm">{label}</span>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<VenueDetailPageProps> = async (context) => {
  const { id } = context.params as { id: string };

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8003';
    const res = await fetch(`${apiUrl}/api/venues/${id}`);

    if (res.status === 404) {
      return { notFound: true };
    }

    if (!res.ok) {
      // Let client-side handle errors
      return { props: {} };
    }

    const venue: VenueResponse = await res.json();

    // --- 301 Redirect Enforcer ---
    // If accessed via UUID (or outdated slug) and a canonical slug exists,
    // permanently redirect to the slug URL to kill UUID exposure.
    if (venue.slug && id !== venue.slug) {
      // Preserve query parameters (UTM, etc.) through the redirect
      const queryString = context.resolvedUrl.includes('?')
        ? context.resolvedUrl.substring(context.resolvedUrl.indexOf('?'))
        : '';
      return {
        redirect: {
          destination: `/venues/${venue.slug}${queryString}`,
          permanent: true,
        },
      };
    }

    return {
      props: {
        initialVenue: venue,
      },
    };
  } catch (error) {
    console.error('SSR Error fetching venue:', error);
    return { props: {} };
  }
};
