/**
 * Event Detail Page
 * Show event details with check-in functionality
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { GetServerSideProps } from 'next';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Spinner } from '@/components/common/Spinner';

import ShareButtons from '@/components/events/ShareButtons';
import { BookmarkButton } from '@/components/events/BookmarkButton';
import ReportModal from '@/components/common/ReportModal';
import SimilarEvents from '@/components/events/SimilarEvents';
import AgeRestrictionBadge from '@/components/events/AgeRestrictionBadge';
import AddToCalendar from '@/components/events/AddToCalendar';
import RichText from '@/components/ui/RichText';
import { OrganizerBadge } from '@/components/events/OrganizerBadge';
import { api } from '@/lib/api';
import type { EventResponse } from '@/types';

// Dynamic import for GoogleMiniMap to avoid SSR issues
const GoogleMiniMap = dynamic(() => import('@/components/maps/GoogleMiniMap'), { ssr: false });

// Dynamic import for AccommodationMap (Stay22) - heavy iframe, lazy loaded
const AccommodationMap = dynamic(() => import('@/components/events/AccommodationMap'), { ssr: false });

interface EventDetailPageProps {
  initialEvent: EventResponse | null;
  error?: string;
}

export default function EventDetailPage({ initialEvent, error: serverError }: EventDetailPageProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { trackEventView, trackTicketClick } = useAnalytics();

  const [event, setEvent] = useState<EventResponse | null>(initialEvent);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Only for client-side refetches
  const [bookmarkCount, setBookmarkCount] = useState<number>(0);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Fetch bookmark count for social proof
  useEffect(() => {
    if (event?.id) {
      api.bookmarks.getCount(event.id)
        .then(res => setBookmarkCount(res.count))
        .catch(() => setBookmarkCount(0));
    }
  }, [event?.id]);

  // Track event view
  useEffect(() => {
    if (event?.id) {
      trackEventView(event.id);
    }
  }, [event?.id, trackEventView]);

  // Handle client-side refetch (e.g. after check-in)
  const refetch = async () => {
    if (!event?.id) return;
    try {
      // Background update
      const updatedEvent = await api.events.get(event.id);
      setEvent(updatedEvent);
    } catch (err) {
      console.error('Failed to refresh event data', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Loading state (fallback for router navigation if needed, though SSR handles initial load)
  if (router.isFallback) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (serverError || !event) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Event Not Found</h1>
          <p className="text-gray-600 mb-6">{serverError || 'This event does not exist.'}</p>
          <Link href="/events" className="text-emerald-600 hover:text-emerald-700">
            ← Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const isEventHappening = () => {
    const now = new Date();
    const start = new Date(event.date_start);
    const end = new Date(event.date_end);
    return now >= start && now <= end;
  };

  // Format date for OG description
  const eventDate = new Date(event.date_start);
  const formattedOgDate = eventDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  // Build rich description for social sharing
  const venueName = event.venue_name || event.location_name || 'the Highlands';
  const pageDescription = `Join us at ${venueName} on ${formattedOgDate}. ${event.description ? event.description.substring(0, 100) : 'Discover this amazing event in the Scottish Highlands!'}`;

  // SEO: Dynamic Title (Title | Venue | Date | Site Name)
  const pageTitle = `${event.title} at ${venueName} | ${formattedOgDate} | Highland Events Hub`;
  const siteUrl = 'https://www.highlandeventshub.co.uk';
  const ogImageUrl = event.image_url
    ? (event.image_url.startsWith('http') ? event.image_url : `${siteUrl}${event.image_url}`)
    : `${siteUrl}/images/og-default.jpg`;
  const canonicalUrl = `${siteUrl}/events/${event.id}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} key="description" />
        <link rel="canonical" href={canonicalUrl} key="canonical" />

        {/* Open Graph / Facebook / WhatsApp */}
        <meta property="og:type" content="event" key="og-type" />
        <meta property="og:url" content={canonicalUrl} key="og-url" />
        <meta property="og:title" content={event.title} key="og-title" />
        <meta property="og:description" content={pageDescription} key="og-description" />
        <meta property="og:image" content={ogImageUrl} key="og-image" />
        <meta property="og:image:width" content="1200" key="og-image-width" />
        <meta property="og:image:height" content="630" key="og-image-height" />
        <meta property="og:site_name" content="Highland Events Hub" key="og-site-name" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" key="twitter-card" />
        <meta name="twitter:site" content="@HighlandEvents" key="twitter-site" />
        <meta name="twitter:title" content={pageTitle} key="twitter-title" />
        <meta name="twitter:description" content={pageDescription} key="twitter-description" />
        <meta name="twitter:image" content={ogImageUrl} key="twitter-image" />

        {/* JSON-LD Structured Data for Google Events Pack */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Event",
              "name": event.title,
              "startDate": event.date_start,
              "endDate": event.date_end,
              "eventStatus": "https://schema.org/EventScheduled",
              "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
              "location": {
                "@type": "Place",
                "name": venueName,
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": event.location_name || venueName,
                  "addressRegion": "Highlands",
                  "addressCountry": "UK"
                },
                "geo": (event.latitude && event.longitude) ? {
                  "@type": "GeoCoordinates",
                  "latitude": event.latitude,
                  "longitude": event.longitude
                } : undefined
              },
              "image": [ogImageUrl],
              "description": event.description ? event.description.replace(/<[^>]*>?/gm, '') : pageDescription,
              "offers": {
                "@type": "Offer",
                "url": event.ticket_url || canonicalUrl,
                "price": event.price || 0,
                "priceCurrency": "GBP",
                "availability": "https://schema.org/InStock",
                "validFrom": event.created_at
              },
              "organizer": {
                "@type": "Organization",
                "name": event.organizer_profile?.name || "Highland Events Hub",
                "url": siteUrl
              }
            })
          }}
        />
      </Head>

      {/* Cinematic Hero */}
      <div className="relative h-[60vh] min-h-[500px] overflow-hidden">
        {/* Blurred Background */}
        <div className="absolute inset-0">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt=""
              className="w-full h-full object-cover blur-2xl scale-110 opacity-60"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-stone-800 to-stone-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />
        </div>

        {/* Sharp Centered Image - Now Full Container Width */}
        <div className="absolute inset-0 flex items-center justify-center px-4 pt-24">
          <div
            className={`relative w-full max-w-7xl aspect-[4/3] md:aspect-[21/9] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 ${event.image_url ? 'cursor-pointer group' : ''}`}
            onClick={() => event.image_url && setImageLightboxOpen(true)}
          >
            {event.image_url ? (
              <>
                <img
                  src={event.image_url}
                  alt={`${event.title} at ${venueName}`}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors duration-300">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/10 backdrop-blur-md rounded-full p-4 border border-white/20">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-stone-800 to-stone-700 flex items-center justify-center">
                <span className="text-8xl">🎉</span>
              </div>
            )}

            {/* Featured Badge */}
            {event.featured && (
              <div className="absolute top-6 left-6">
                <div className="px-4 py-1.5 bg-amber-400 text-amber-950 text-xs font-bold uppercase tracking-widest rounded-full shadow-lg flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Featured
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back Button */}
        <Link href="/events" className="absolute top-8 left-8 inline-flex items-center text-sm font-medium text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 transition-all z-20">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Events
        </Link>


      </div>

      {/* Info Ribbon */}
      <div className="sticky top-0 z-30 bg-stone-950/80 backdrop-blur-xl border-y border-white/5 text-white py-6 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white break-words mb-2">{event.title}</h1>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-stone-400 text-sm">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium text-stone-200">{formatDate(event.date_start)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <span className="text-stone-200">{event.venue_name || event.location_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 9a2 2 0 10-4 0v5a2 2 0 01-2 2h6m-6-4h4m8 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-bold text-emerald-400">
                    {event.price_display || (event.price && event.price > 0 ? `£${event.price.toFixed(2)}` : 'Free Entry')}
                  </span>
                </div>

                {/* Views & Going Stats */}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="text-stone-400">{event.view_count || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-stone-400">{event.save_count || 0}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
              {/* Get Tickets Button Logic */}
              {event.ticket_url ? (
                <a
                  href={event.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackTicketClick(event.id)}
                  className="flex-1 md:flex-none px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-full transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/20 text-center"
                >
                  Get Tickets
                </a>
              ) : (event.showtimes && event.showtimes.length > 0) ? (
                <button
                  onClick={() => {
                    const mobileSidebar = document.getElementById('mobile-dates-sidebar');
                    const desktopSidebar = document.getElementById('dates-sidebar');
                    const sidebar = (mobileSidebar && mobileSidebar.offsetParent !== null) ? mobileSidebar : desktopSidebar;
                    if (sidebar) {
                      sidebar.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      sidebar.classList.add('ring-4', 'ring-emerald-500', 'ring-opacity-50', 'scale-[1.02]');
                      setTimeout(() => {
                        sidebar.classList.remove('ring-4', 'ring-emerald-500', 'ring-opacity-50', 'scale-[1.02]');
                      }, 1000);
                    }
                  }}
                  className="flex-1 md:flex-none px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-full transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/20 text-center"
                >
                  Get Tickets
                </button>
              ) : null}

              {/* Visit Website Button */}
              {event.website_url && (
                <a
                  href={event.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 md:flex-none px-6 py-3 border-2 border-stone-400 hover:border-stone-200 text-stone-200 hover:text-white font-semibold rounded-full transition-all transform hover:scale-105 text-center"
                >
                  Visit Website
                </a>
              )}

              <BookmarkButton
                eventId={event.id}
                showLabel={true}
                className="flex-1 md:flex-none transform hover:scale-105 shadow-lg"
                onToggle={(isBookmarked) => {
                  setEvent(prev => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      save_count: isBookmarked
                        ? (prev.save_count || 0) + 1
                        : Math.max(0, (prev.save_count || 0) - 1)
                    };
                  });
                  setBookmarkCount(prev => isBookmarked ? prev + 1 : Math.max(0, prev - 1));
                }}
              />

            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Wider Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile: Organizer Badge */}
        <div className="lg:hidden mb-6">
          {event.organizer_profile && (
            <OrganizerBadge organizer={event.organizer_profile} />
          )}
        </div>

        {/* Mobile: Sidebar content appears first */}
        <div id="mobile-dates-sidebar" className="lg:hidden mb-8 space-y-6 transition-all duration-1000">
          {/* Mobile Date/Time Card */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {event.showtimes && event.showtimes.length > 0 ? 'Dates + Times' : 'When'}
            </h3>
            <div className="space-y-4">
              {/* Show showtimes table if available */}
              {event.showtimes && event.showtimes.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {event.showtimes.map((st: any, index: number) => {
                    const stDate = new Date(st.start_time);
                    const stEndDate = st.end_time ? new Date(st.end_time) : null;
                    return (
                      <div key={st.id || index} className="flex items-center justify-between py-3 first:pt-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">
                              {stDate.toLocaleDateString('en-GB', { weekday: 'short' })}
                            </span>
                            <span className="text-lg font-bold text-emerald-900 leading-none">
                              {stDate.getDate()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {stDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </p>
                            <p className="text-xs text-gray-500">
                              {stDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              {stEndDate && ` - ${stEndDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                            </p>
                            {st.notes && (
                              <p className="text-xs text-amber-600 font-medium mt-0.5">{st.notes}</p>
                            )}
                          </div>
                        </div>
                        <a
                          href={st.ticket_url || event.ticket_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackTicketClick(event.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-full ${st.ticket_url || event.ticket_url
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                          Buy Tickets
                        </a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Standard single date display */
                <div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">
                        {new Date(event.date_start).toLocaleDateString('en-GB', { month: 'short' })}
                      </span>
                      <span className="text-lg font-bold text-emerald-900 leading-none">
                        {new Date(event.date_start).getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{formatDate(event.date_start)}</p>
                      <p className="text-sm text-gray-500">
                        {event.is_all_day ? 'All Day' : `${formatTime(event.date_start)} - ${formatTime(event.date_end)}`}
                      </p>
                    </div>
                  </div>
                  {event.ticket_url && (
                    <div className="mt-4">
                      <a
                        href={event.ticket_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackTicketClick(event.id)}
                        className="w-full block px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-center transition-colors"
                      >
                        Get Tickets
                      </a>
                    </div>
                  )}
                </div>
              )}
              <AddToCalendar event={event} className="w-full" />

              {/* Recurring indicator for mobile */}
              {event.is_recurring && (
                <div className="p-3 bg-purple-50 rounded-lg flex items-start gap-2">
                  <svg className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <p className="text-xs text-purple-800">This event repeats weekly. Check the calendar for more dates.</p>
                </div>
              )}
            </div>
          </Card>

          {/* Sponsor Card (Mobile) */}
          <Card className="mt-4 border-amber-200 bg-amber-50/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                {user && (event.organizer_id === user.id || user.is_admin) ? "Promote Event" : "Sponsor Event"}
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wide">
                Featured
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              {user && (event.organizer_id === user.id || user.is_admin)
                ? "Boost visibility by featuring this event on the homepage."
                : "Support this event by featuring it on the homepage."}
            </p>
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  router.push(`/login?returnUrl=${encodeURIComponent(router.asPath)}`);
                  return;
                }
                router.push(`/events/${event.id}/promote`);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 rounded-lg font-medium transition-colors shadow-sm text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              {user && (event.organizer_id === user.id || user.is_admin) ? "Promote Now" : "Sponsor Event"}
            </button>
          </Card>
        </div>

        {/* Desktop: 70/30 Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
          {/* Event Details - 70% (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <Card>
              {(event.category || event.age_restriction) && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {event.category && (
                    <Link href={`/category/${event.category.slug}`}>
                      <Badge variant="info" size="sm" className="hover:opacity-80 transition-opacity cursor-pointer">
                        {event.category.name}
                      </Badge>
                    </Link>
                  )}
                  {event.age_restriction && (
                    <Link href={`/events?age_restriction=${encodeURIComponent(event.age_restriction)}`}>
                      <AgeRestrictionBadge
                        value={event.age_restriction}
                        size="md"
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    </Link>
                  )}
                </div>
              )}

              <h2 className="text-2xl font-bold text-gray-900 mb-4">About this event</h2>

              {event.description && (
                <div className="space-y-2">
                  <RichText
                    content={showFullDescription || event.description.length <= 400
                      ? event.description
                      : `${event.description.slice(0, 400)}...`}
                    className="text-gray-700 leading-relaxed break-words w-full max-w-full overflow-hidden"
                  />
                  {event.description.length > 400 && (
                    <button
                      onClick={() => setShowFullDescription(!showFullDescription)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                    >
                      {showFullDescription ? 'Show Less' : 'Show More'}
                    </button>
                  )}
                </div>
              )}

              {/* Tags */}
              {event.tags && event.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4">
                  {event.tags.map((tag: any) => (
                    <Link key={tag.id} href={`/events?tag=${encodeURIComponent(tag.name)}`}>
                      <span
                        className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full hover:bg-purple-200 transition-colors cursor-pointer"
                      >
                        #{tag.name}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Share Buttons */}
              <div className="pt-4 border-t border-gray-100 mt-4">
                <ShareButtons
                  url={typeof window !== 'undefined' ? window.location.href : ''}
                  title={event.title}
                  description={event.description}
                />
              </div>
            </Card>

            {/* Event Location Card */}
            <Card>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {/* Show custom location name for headless events, otherwise "Location" */}
                {!event.venue_id && event.location_name
                  ? event.location_name
                  : 'Location'}
              </h2>
              <div className="space-y-4">
                {/* Primary Venue (if exists) */}
                {event.venue_name && event.venue_id && (
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{event.venue_name}</p>
                      <Link href={`/venues/${event.venue_id}`} className="text-sm text-emerald-600 hover:underline">
                        View venue details
                      </Link>
                    </div>
                  </div>
                )}

                {/* Participating Venues */}
                {event.participating_venues && event.participating_venues.length > 0 && (
                  <div className={event.venue_id ? "mt-4 pt-4 border-t border-gray-100" : ""}>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      {event.participating_venues.length} Participating Venue{event.participating_venues.length !== 1 ? 's' : ''}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {event.participating_venues.map(pv => (
                        <Link
                          key={pv.id}
                          href={`/venues/${pv.id}`}
                          className="flex flex-col items-center p-3 rounded-xl bg-gray-50 hover:bg-emerald-50 border border-gray-100 hover:border-emerald-200 transition-all group hover:shadow-md"
                        >
                          {/* Venue Thumbnail */}
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 mb-2 group-hover:scale-105 transition-transform">
                            {pv.image_url ? (
                              <img
                                src={pv.image_url}
                                alt={pv.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                                <span className="text-white font-bold text-lg">
                                  {pv.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Venue Name */}
                          <span className="text-xs text-center text-gray-700 group-hover:text-emerald-700 font-medium line-clamp-2">
                            {pv.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Map: Show all venue markers */}
                {(() => {
                  // Build markers array from participating venues
                  const markers = (event.participating_venues || [])
                    .filter(v => v.latitude && v.longitude)
                    .map(v => ({ lat: v.latitude!, lng: v.longitude!, title: v.name }));

                  // Get coordinates for directions link
                  const dirLat = markers.length > 0 ? markers[0].lat : event.latitude;
                  const dirLng = markers.length > 0 ? markers[0].lng : event.longitude;
                  const directionUrl = dirLat && dirLng
                    ? `https://www.google.com/maps/dir/?api=1&destination=${dirLat},${dirLng}`
                    : null;

                  // If we have participating venues with coordinates, show multi-marker map
                  if (markers.length > 0) {
                    return (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-xl overflow-hidden border border-gray-100">
                          <GoogleMiniMap
                            markers={markers}
                            height="280px"
                            interactive={true}
                          />
                        </div>
                        {directionUrl && (
                          <a
                            href={directionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            Get Directions
                          </a>
                        )}
                      </div>
                    );
                  }

                  // Fallback: single location from event coords
                  if (event.latitude && event.longitude) {
                    return (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-xl overflow-hidden border border-gray-100">
                          <GoogleMiniMap
                            latitude={event.latitude}
                            longitude={event.longitude}
                            height="250px"
                            zoom={14}
                            interactive={true}
                          />
                        </div>
                        {directionUrl && (
                          <a
                            href={directionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            Get Directions
                          </a>
                        )}
                      </div>
                    );
                  }

                  return null;
                })()}
              </div>
            </Card>
          </div>

          {/* Sticky Sidebar - 30% (3 cols) - Hidden on Mobile (shown above) */}
          <div className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24 space-y-6">

              {/* Desktop: Organizer Badge */}
              {event.organizer_profile && (
                <Card className="border-l-4 border-l-emerald-500">
                  <OrganizerBadge organizer={event.organizer_profile} />
                </Card>
              )}

              {/* Admin Tools (Visible to any Admin) */}
              {user && user.is_admin && (
                <Card className="border-l-4 border-l-purple-500 bg-purple-50">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Admin Tools</h3>
                  <div className="space-y-2">
                    <a
                      href={`/social/${event.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors"
                    >
                      <span className="text-xl">🎨</span>
                      Generate Poster
                    </a>
                  </div>
                </Card>
              )}

              {/* Time & Date Sidebar Card */}
              <div id="dates-sidebar" className="transition-all duration-1000">
                <Card>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {event.showtimes && event.showtimes.length > 0 ? 'Dates + Times' : 'When'}
                  </h3>
                  <div className="space-y-4">
                    {/* Show showtimes table if available */}
                    {event.showtimes && event.showtimes.length > 0 ? (
                      <div className="divide-y divide-gray-100">
                        {event.showtimes.map((st: any, index: number) => {
                          const stDate = new Date(st.start_time);
                          const stEndDate = st.end_time ? new Date(st.end_time) : null;
                          return (
                            <div key={st.id || index} className="flex items-center justify-between py-3 first:pt-0">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex flex-col items-center justify-center flex-shrink-0">
                                  <span className="text-[10px] font-bold text-emerald-600 uppercase">
                                    {stDate.toLocaleDateString('en-GB', { weekday: 'short' })}
                                  </span>
                                  <span className="text-lg font-bold text-emerald-900 leading-none">
                                    {stDate.getDate()}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {stDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {stDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                    {stEndDate && ` - ${stEndDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                                  </p>
                                  {st.notes && (
                                    <p className="text-xs text-amber-600 font-medium mt-0.5">{st.notes}</p>
                                  )}
                                </div>
                              </div>
                              <a
                                href={st.ticket_url || event.ticket_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => trackTicketClick(event.id)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-full ${st.ticket_url || event.ticket_url
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  }`}
                              >
                                Buy Tickets
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Standard single date display */
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase">
                            {new Date(event.date_start).toLocaleDateString('en-GB', { month: 'short' })}
                          </span>
                          <span className="text-lg font-bold text-emerald-900 leading-none">
                            {new Date(event.date_start).getDate()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{formatDate(event.date_start)}</p>
                          <p className="text-sm text-gray-500">
                            {event.is_all_day ? 'All Day' : `${formatTime(event.date_start)} - ${formatTime(event.date_end)}`}
                          </p>
                        </div>
                      </div>
                    )}

                    <AddToCalendar event={event} className="w-full" />

                    {event.is_recurring && (
                      <div className="p-3 bg-emerald-50 rounded-lg flex items-start gap-2">
                        <svg className="w-4 h-4 text-emerald-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <p className="text-xs text-emerald-800">This event repeats weekly. Check the calendar for more dates.</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Sponsor Card (Desktop) - Visible to everyone */}
              <Card className="border-amber-200 bg-amber-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {user && (event.organizer_id === user.id || user.is_admin) ? "Promote Event" : "Sponsor Event"}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wide">
                    Featured
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-4">
                  {user && (event.organizer_id === user.id || user.is_admin)
                    ? "Boost visibility by featuring this event on the homepage."
                    : "Support this event by featuring it on the homepage."}
                </p>
                <button
                  onClick={() => {
                    if (!isAuthenticated) {
                      router.push(`/login?returnTo=${encodeURIComponent(router.asPath)}`);
                      return;
                    }
                    router.push(`/events/${event.id}/promote`);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 rounded-lg font-medium transition-colors shadow-sm text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  {user && (event.organizer_id === user.id || user.is_admin) ? "Promote Now" : "Sponsor Event"}
                </button>
              </Card>



              {/* Claim Event Card - for users who don't own the event */}
              {isAuthenticated && user && event.organizer_id !== user.id && !user.is_admin && (
                <Card className="mt-4 border-purple-200 bg-purple-50/50">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Is this your event?</h3>
                  <p className="text-xs text-gray-600 mb-3">Claim this event to manage it, update details, and track analytics.</p>
                  <button
                    onClick={async () => {
                      const reason = prompt("Why do you want to claim this event?");
                      if (!reason) return;
                      try {
                        await api.eventClaims.create(event.id, reason);
                        alert("Claim submitted! An admin will review your request.");
                      } catch (err: any) {
                        alert(err.message || "Failed to submit claim.");
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg font-medium transition-colors text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Claim Event
                  </button>
                </Card>
              )}

              {/* Owner Actions */}
              {user && (event.organizer_id === user.id || user.is_admin) && (
                <Card className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Manage Event</h3>
                  <div className="space-y-2">
                    {/* Owner Actions */}
                    {user && (event.organizer_id === user.id || user.is_admin) && (
                      <Link
                        href={`/events/${event.id}/edit`}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit Event
                      </Link>
                    )}




                    {event.is_recurring && (
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to stop this recurring series? All future instances will be deleted.')) {
                            try {
                              const { api } = await import('@/lib/api');
                              await api.events.stopRecurrence(event.id);
                              alert('Recurring series stopped. Future instances have been removed.');
                              refetch();
                            } catch (err) {
                              alert('Failed to stop series. Please try again.');
                            }
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg font-medium transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                        Stop Recurring Series
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        const isRecurring = event.is_recurring || event.parent_event_id;
                        const message = isRecurring
                          ? 'Are you sure you want to delete this event? This will also delete ALL child instances in this recurring series. This action cannot be undone.'
                          : 'Are you sure you want to delete this event? This action cannot be undone.';

                        if (confirm(message)) {
                          try {
                            const { api } = await import('@/lib/api');
                            await api.events.delete(event.id);
                            alert('Event deleted successfully.');
                            window.location.href = '/events';
                          } catch (err) {
                            alert('Failed to delete event. Please try again.');
                          }
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-medium transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Event
                    </button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* AccommodationMap - Full Width, Before SimilarEvents */}
        {event.latitude && event.longitude && (
          <div className="mt-12">
            <AccommodationMap
              latitude={event.latitude}
              longitude={event.longitude}
              eventName={event.title}
              startDate={event.date_start}
              endDate={event.date_end}
            />
          </div>
        )}

        <SimilarEvents eventId={event.id} />
      </div>

      {
        event && (
          <ReportModal
            isOpen={reportModalOpen}
            onClose={() => setReportModalOpen(false)}
            targetType="event"
            targetId={event.id}
            targetName={event.title}
          />
        )
      }

      {/* Image Lightbox Modal */}
      {
        imageLightboxOpen && event?.image_url && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setImageLightboxOpen(false)}
          >
            {/* Close button */}
            <button
              onClick={() => setImageLightboxOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Full Image */}
            <img
              src={event.image_url}
              alt={event.title}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Caption */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm">
              Click anywhere to close
            </div>
          </div>
        )
      }
    </div >
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params || {};

  if (!id || typeof id !== 'string') {
    return { notFound: true };
  }

  try {
    // Import API dynamically to avoid build-time issues if any
    const { api } = await import('@/lib/api');
    const event = await api.events.get(id);

    if (!event) {
      return { notFound: true };
    }

    // --- SEO Metadata Calculation (Server-Side) ---
    const siteUrl = 'https://www.highlandeventshub.co.uk';
    const canonicalUrl = `${siteUrl}/events/${event.id}`;

    // Ensure absolute image URL
    let ogImageUrl = 'https://res.cloudinary.com/dakq1xwn1/image/upload/w_1200,h_630,c_fill,q_auto/v1767454232/highland_events/events/lhxbivhjsqpwn1hsbz5x.jpg'; // fallback
    if (event.image_url) {
      ogImageUrl = event.image_url.startsWith('http')
        ? event.image_url
        : `${siteUrl}${event.image_url}`;
    }

    // Format date for description
    const eventDate = new Date(event.date_start);
    const formattedDate = eventDate.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });

    // Build description
    const venueName = event.venue_name || event.location_name || 'the Highlands';

    // Strip HTML tags for clean metadata
    const cleanDescription = event.description
      ? event.description.replace(/<[^>]*>?/gm, '')
      : 'Discover this amazing event in the Scottish Highlands!';

    // Truncate to keep the full meta description under roughly 160 chars + prefix
    const baseDesc = cleanDescription.substring(0, 150);
    const description = `Join us at ${venueName} on ${formattedDate}. ${baseDesc}...`;

    const pageTitle = `${event.title} | Highland Events Hub`;

    return {
      props: {
        initialEvent: event,
        // Pass meta prop to _app.tsx
        meta: {
          title: pageTitle,
          description: description,
          url: canonicalUrl,
          image: ogImageUrl,
          type: 'event',
        }
      },
    };
  } catch (err: any) {
    console.error('Error fetching event for SSR:', err);
    return {
      props: {
        initialEvent: null,
        error: err.message || 'Failed to load event',
      },
    };
  }
};
