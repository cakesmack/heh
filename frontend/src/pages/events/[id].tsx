/**
 * Event Detail Page
 * Show event details with check-in functionality
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import OptimizedImage from '@/components/ui/OptimizedImage';
import dynamic from 'next/dynamic';
import { GetServerSideProps } from 'next';
import { Button, cn } from '@/components/ui/button';
import { Heart, HeartOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Spinner } from '@/components/common/Spinner';
import { optimizeImage } from '@/utils/imageOptimizer';

import SocialShare from '@/components/common/SocialShare';
import { BookmarkButton } from '@/components/events/BookmarkButton';
import { AttendingButton } from '@/components/events/AttendingButton';
import ClaimEventModal from '@/components/events/ClaimEventModal';
import ReportModal from '@/components/common/ReportModal';
import SimilarEvents from '@/components/events/SimilarEvents';
import AccommodationAds from '@/components/events/AccommodationAds';
import AgeRestrictionBadge from '@/components/events/AgeRestrictionBadge';
import AddToCalendar from '@/components/events/AddToCalendar';
import RichText from '@/components/ui/RichText';
import { OrganizerBadge } from '@/components/events/OrganizerBadge';
import { api, apiFetch, locationsAPI } from '@/lib/api';
import type { EventResponse } from '@/types';
import SidebarPerformances from '@/components/events/SidebarPerformances';
import SmallEventCard from '@/components/events/SmallEventCard';

// Dynamic import for GoogleMiniMap to avoid SSR issues
const GoogleMiniMap = dynamic(() => import('@/components/maps/GoogleMiniMap'), { ssr: false });



interface EventDetailPageProps {
  initialEvent?: EventResponse | null;
  serverError?: string;
  baseUrl?: string;
}

export function generateEventJsonLd(event: EventResponse | null, canonicalUrl: string, ogImageUrl: string) {
  if (!event) return null;

  const name = event.title?.trim();
  const rawStartDate = event.date_start;
  const venueLocationName = (
    event.venue?.name ||
    event.venue_name ||
    event.location_name ||
    ''
  ).trim();

  // Guardrail: suppress if missing mandatory name, startDate, or location name
  if (!name || !rawStartDate || !venueLocationName) {
    return null;
  }

  // Parse startDate safely
  let startDateIso: string;
  try {
    const startDateObj = new Date(rawStartDate);
    if (isNaN(startDateObj.getTime())) return null;
    startDateIso = startDateObj.toISOString();
  } catch {
    return null;
  }

  // Calculate endDate or default to startDate + 2 hours
  let endDateIso: string;
  if (event.date_end) {
    try {
      const endDateObj = new Date(event.date_end);
      if (!isNaN(endDateObj.getTime())) {
        endDateIso = endDateObj.toISOString();
      } else {
        const fallbackEnd = new Date(new Date(rawStartDate).getTime() + 2 * 60 * 60 * 1000);
        endDateIso = fallbackEnd.toISOString();
      }
    } catch {
      const fallbackEnd = new Date(new Date(rawStartDate).getTime() + 2 * 60 * 60 * 1000);
      endDateIso = fallbackEnd.toISOString();
    }
  } else {
    const fallbackEnd = new Date(new Date(rawStartDate).getTime() + 2 * 60 * 60 * 1000);
    endDateIso = fallbackEnd.toISOString();
  }

  // Description handling
  const cleanDescription = event.description
    ? event.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim()
    : `${name} at ${venueLocationName}`;

  // Image handling
  const imageList: string[] = [];
  if (event.image_url) {
    imageList.push(event.image_url);
  }
  if (ogImageUrl && !imageList.includes(ogImageUrl)) {
    imageList.push(ogImageUrl);
  }

  // Location & PostalAddress handling
  const cityLocality = (
    event.venue?.city ||
    (event.address_full ? event.address_full.split(',').slice(-2, -1)[0]?.trim() : '') ||
    event.location_name ||
    'Highlands'
  );

  const postalCode = event.venue?.postcode || event.postcode || '';
  const streetAddress = event.venue?.address || event.address_full || event.location_name || venueLocationName;

  const lat = event.venue?.latitude ?? event.latitude;
  const lng = event.venue?.longitude ?? event.longitude;

  // Price & Offer handling
  const priceVal = event.min_price !== undefined && event.min_price !== null
    ? Number(event.min_price)
    : Number(event.price || 0);

  const offerUrl = event.ticket_url || event.website_url || canonicalUrl;

  const jsonLdObject: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": name,
    "startDate": startDateIso,
    "endDate": endDateIso,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "description": cleanDescription,
    "image": imageList.length > 0 ? imageList : [ogImageUrl],
    "location": {
      "@type": "Place",
      "name": venueLocationName,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": streetAddress,
        "addressLocality": cityLocality,
        "addressRegion": "Highlands",
        ...(postalCode ? { "postalCode": postalCode } : {}),
        "addressCountry": "GB"
      },
      ...((lat !== undefined && lat !== null && lng !== undefined && lng !== null) ? {
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": lat,
          "longitude": lng
        }
      } : {})
    },
    "offers": {
      "@type": "Offer",
      "url": offerUrl,
      "price": priceVal,
      "priceCurrency": "GBP",
      "availability": "https://schema.org/InStock",
      ...(event.created_at ? { "validFrom": new Date(event.created_at).toISOString() } : {})
    }
  };

  const organizerName = event.organizer_profile?.name || (event as any).organizer_name;
  if (organizerName) {
    jsonLdObject.organizer = {
      "@type": "Organization",
      "name": organizerName,
      "url": canonicalUrl
    };
    jsonLdObject.performer = {
      "@type": "PerformingGroup",
      "name": organizerName
    };
  }

  return jsonLdObject;
}

export function buildSeoTitle(event: EventResponse, city: string): string {
  if (event.seo_title?.trim()) {
    const customTitle = event.seo_title.trim();
    return customTitle.length <= 60 ? customTitle : customTitle.substring(0, 57) + '...';
  }

  const eventName = (event.title || 'Event').trim();
  const rawVenueName = event.venue?.name || event.venue_name;
  
  // Suffix: "| [Venue Name]" or fallback "| [City/Town]"
  const suffixLocation = rawVenueName?.trim() || city?.trim() || 'Highlands';
  const suffix = ` | ${suffixLocation}`;
  const templateMiddle = " Tickets, Dates & Info";
  
  const fullTitle = `${eventName}${templateMiddle}${suffix}`;
  if (fullTitle.length <= 60) {
    return fullTitle;
  }

  // Account for templateMiddle, suffix, and '...' (3 chars)
  const availableLengthForName = 60 - templateMiddle.length - suffix.length - 3;
  let result: string;
  if (availableLengthForName >= 5) {
    let truncatedName = eventName.substring(0, availableLengthForName);
    const lastSpace = truncatedName.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncatedName = truncatedName.substring(0, lastSpace);
    }
    result = `${truncatedName}...${templateMiddle}${suffix}`;
  } else {
    result = fullTitle;
  }

  return result.length <= 60 ? result : result.substring(0, 57) + '...';
}

export function buildSeoDescription(event: EventResponse, city: string): string {
  if (event.seo_description?.trim()) {
    const customDesc = event.seo_description.trim();
    return customDesc.length <= 160 ? customDesc : customDesc.substring(0, 157) + '...';
  }

  const eventName = (event.title || 'this event').trim();
  const rawVenueName = event.venue?.name || event.venue_name;
  const targetCity = event.venue?.city || city || 'the Highlands';

  let prefix: string;
  let suffix: string;

  if (rawVenueName?.trim()) {
    prefix = "Get dates, times, and event information for ";
    suffix = ` at ${rawVenueName.trim()} in ${targetCity}. Check the full schedule and plan your visit.`;
  } else {
    prefix = "Get dates, times, and event information for ";
    suffix = ` in ${targetCity}. Check the full schedule and plan your visit.`;
  }

  const rawDesc = `${prefix}${eventName}${suffix}`;
  if (rawDesc.length <= 160) {
    return rawDesc;
  }

  // Account for prefix, suffix, and '...' (3 chars)
  const availableLengthForName = 160 - prefix.length - suffix.length - 3;
  let result: string;
  if (availableLengthForName >= 5) {
    let truncatedName = eventName.substring(0, availableLengthForName);
    const lastSpace = truncatedName.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncatedName = truncatedName.substring(0, lastSpace);
    }
    result = `${prefix}${truncatedName}...${suffix}`;
  } else {
    result = rawDesc;
  }

  return result.length <= 160 ? result : result.substring(0, 157) + '...';
}

export default function EventDetailPage({ initialEvent, serverError, baseUrl }: EventDetailPageProps) {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, user } = useAuth();
  const { trackEventView, trackTicketClick, trackWebsiteClick } = useAnalytics();

  const [event, setEvent] = useState<EventResponse | null>(initialEvent || null);
  const [loading, setLoading] = useState(!initialEvent);
  const [error, setError] = useState<string | null>(serverError || null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [accommodationAds, setAccommodationAds] = useState<any[]>([]);
  const [resolvedLocationId, setResolvedLocationId] = useState<number | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const venue = event?.venue;

  const isPastEvent = event
    ? new Date(event.date_end || event.date_start) < new Date()
    : false;

  const [upcomingEvents, setUpcomingEvents] = useState<EventResponse[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  useEffect(() => {
    if (!event || !isPastEvent) return;

    const fetchUpcoming = async () => {
      setLoadingUpcoming(true);
      try {
        const response = await api.events.list({
          limit: 4,
          date_from: new Date().toISOString(),
          sort_by: 'date_asc',
          exclude_event_ids: [event.id]
        });
        setUpcomingEvents(response.events || []);
      } catch (err) {
        console.error('Failed to fetch upcoming events:', err);
      } finally {
        setLoadingUpcoming(false);
      }
    };

    fetchUpcoming();
  }, [event, isPastEvent]);

  // Filter out past performances and sort chronologically
  const now = new Date();
  const upcomingPerformances = (event?.showtimes || [])
    .filter((st: any) => {
      const timeToCompare = st.end_time ? new Date(st.end_time) : new Date(st.start_time);
      return timeToCompare > now;
    })
    .sort((a: any, b: any) => {
      const aTime = new Date(a.start_time).getTime();
      const bTime = new Date(b.start_time).getTime();
      return aTime - bTime;
    });

  // Fetch locations once on mount
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const data = await locationsAPI.list();
        setLocations(data);
      } catch (err) {
        console.error("Failed to load locations list:", err);
      }
    };
    fetchLocations();
  }, []);

  // Fetch Event Data (Client-Side Fallback)
  useEffect(() => {
    // Only fetch if we don't have an event and we have an ID
    if (event || !router.isReady || !id) return;

    const fetchEvent = async () => {
      setLoading(true);
      try {
        const eventId = String(id);
        const data = await api.events.get(eventId);
        setEvent(data);
      } catch (err: any) {
        console.error('Error fetching event:', err);
        setError(err.message || 'Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [router.isReady, id, event]);

  // Match event venue to location_id
  useEffect(() => {
    if (!venue || !venue.address) {
      return;
    }
    if (!locations || locations.length === 0) {
      return;
    }

    try {
      const safeAddress = venue?.address?.toLowerCase() || "";
      const matchedLoc = locations.find((loc: any) => 
        safeAddress.includes(loc.name?.toLowerCase() || "")
      );

      if (matchedLoc) {
        setResolvedLocationId(matchedLoc.id);
      }
    } catch (error) {
      console.error("Failed to resolve ad location:", error);
    }
  }, [venue, locations]);

  // Load accommodation ads matching the resolved location_id
  useEffect(() => {
    if (resolvedLocationId === null) return;

    const loadAds = async () => {
      try {
        const ads = await apiFetch<any[]>(`/api/ads/accommodation/location/${resolvedLocationId}`);
        setAccommodationAds(ads);
      } catch (err) {
        console.error('Failed to load accommodation ads:', err);
      }
    };

    loadAds();
  }, [resolvedLocationId]);

  // Track event view with session debouncing
  useEffect(() => {
    if (event?.id) {
      const storageKey = `viewed_event_${event.id}`;
      // Check if this specific event has been viewed in this browser session
      if (!sessionStorage.getItem(storageKey)) {
        trackEventView(event.id);
        // Mark as viewed for the remainder of the session
        sessionStorage.setItem(storageKey, 'true');
      }
    }
  }, [event?.id, trackEventView]);

  // Handle client-side refetch (e.g. after check-in or login)
  const refetch = async () => {
    if (!event?.id) return;
    try {
      const updatedEvent = await api.events.get(event.id);
      setEvent(updatedEvent);
    } catch (err) {
      console.error('Failed to refresh event data:', err);
    }
  };

  // Refetch when authentication state is confirmed to catch up with SSR-omitted auth data
  useEffect(() => {
    const hydrator = async () => {
      if (isAuthenticated && event?.id) {
        // Only refetch if the current state shows not attending (likely SSR default)
        if (!event.is_attending) {
          await refetch();
        }
      }
    };
    hydrator();
  }, [isAuthenticated, event?.id, event?.is_attending]);

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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Event Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This event does not exist.'}</p>
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

  const hasEditRights = user && (
    user.is_admin ||
    user.id === event.organizer_id ||
    (event.venue_owner_id && user.id === event.venue_owner_id) ||
    (event.organizer_profile_id && user.organizer_profiles?.some(p => p.id === event.organizer_profile_id))
  );
  
  // SANITIZATION HELPERS for Social Sharing
  const stripHtml = (html: string) => {
    if (!html) return '';
    // Remove HTML tags
    let text = html.replace(/<[^>]*>?/gm, ' ');
    // Decode common HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'");
    // Collapse multiple whitespaces
    return text.replace(/\s+/g, ' ').trim();
  };

  const truncate = (text: string, length: number) => {
    if (!text) return '';
    if (text.length <= length) return text;
    const lastSpace = text.lastIndexOf(' ', length);
    return text.substring(0, lastSpace > 0 ? lastSpace : length) + '...'; // Truncate at word boundary
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

  // Extract city from address for localized SEO templates
  const city = event.address_full
    ? (event.address_full.split(',').slice(-2, -1)[0]?.trim() || 'Highlands')
    : (event.location_name || 'Highlands');

  // SEO Title & Description Generator according to specific character limits & format rules
  const pageTitle = buildSeoTitle(event, city);
  const pageDescription = buildSeoDescription(event, city);

  const siteUrl = baseUrl || 'https://www.highlandeventshub.co.uk';

  // Use optimized URL for OG image if it's a Cloudflare ID
  // Prefer backend-provided thumbnail_url for WhatsApp compatibility
  const optimizedOgUrl = event.thumbnail_url || (event.image_url ? optimizeImage(event.image_url, 1200) : null);
  
  const ogImageUrl = optimizedOgUrl
    ? (optimizedOgUrl.startsWith('http') ? optimizedOgUrl : `${siteUrl}/${optimizedOgUrl.startsWith('/') ? optimizedOgUrl.substring(1) : optimizedOgUrl}`)
    : `${siteUrl}/images/og-default.jpg`;
  const canonicalUrl = `${siteUrl}/events/${event.slug || event.id}`;

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
        {(() => {
          const eventJsonLd = generateEventJsonLd(event, canonicalUrl, ogImageUrl);
          if (!eventJsonLd) return null;
          return (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(eventJsonLd)
              }}
            />
          );
        })()}
      </Head>

      {/* ═══ Dark Hero Section ═══ */}
      <div className="relative overflow-hidden bg-[#171717]">
        {/* Full-Width Blurred Background Image Layer */}
        {event.image_url && (
          <div
            className="absolute inset-0 z-0"
            style={{
              backgroundImage: `url(${optimizeImage(event.image_url, 'hero')})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(30px)',
              transform: 'scale(1.1)',
            }}
          />
        )}
        
        {/* Horizontal Gradient Overlay */}
        <div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(23, 23, 23, 0.5) 0%, #171717 65%, #171717 100%)'
          }}
        />

        {/* Content Wrapper (Must be relative to sit above background) */}
        <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
          {/* Back Button */}
          <Link href="/events" className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white mb-6 transition-colors">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Events
          </Link>

          {/* Two-Column Grid: Image (40%) | Content (60%) */}
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-24 lg:items-start">
            {/* ─── Left Column: Event Poster Image ─── */}
            <div className="w-full lg:w-[40%] flex-shrink-0">
              <div
                className="relative overflow-hidden rounded-lg"
                onClick={() => event.image_url && setImageLightboxOpen(true)}
              >
                {/* Foreground Layer (The Image) */}
                {event.image_url ? (
                  <img
                    src={optimizeImage(event.image_url, 'hero')}
                    alt={`${event.title} at ${venueName}`}
                    className="w-full h-auto cursor-pointer block relative z-10"
                  />
                ) : (
                  <div className="w-full aspect-[4/5] bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center relative z-10">
                    <span className="text-7xl">🎉</span>
                  </div>
                )}
                {/* Featured Badge */}
                {event.featured && (
                  <div className="absolute top-4 left-4 z-20">
                    <div className="px-3 py-1 bg-amber-400 text-amber-950 text-xs font-bold uppercase tracking-widest rounded-full shadow-lg flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Featured
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Right Column: Title, Logistics, Conversion Box ─── */}
            <div className="w-full lg:w-[60%] flex flex-col">
              {/* H1 Title */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight break-words">
                {event.title}
              </h1>

              {/* Organizer Info (Moved up) */}
              {event.organizer_profile && (
                <div className="flex items-center gap-2 mt-4">
                  {event.organizer_profile.logo_url ? (
                    <img 
                      src={optimizeImage(event.organizer_profile.logo_url, 'thumb')} 
                      alt={event.organizer_profile.name} 
                      className="w-6 h-6 rounded-full object-cover bg-slate-700 flex-shrink-0" 
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <span className="text-sm text-slate-400">
                    Organised by{' '}
                    <Link href={`/groups/${event.organizer_profile.slug}`} className="font-semibold text-white hover:underline transition-colors">
                      {event.organizer_profile.name}
                    </Link>
                  </span>
                </div>
              )}

              {/* Logistics: Date, Time, Venue (Inline Row) */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-300">
                {/* Date + Time */}
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {(() => {
                    const rawDates = [
                      { start: event.date_start, end: event.date_end },
                      ...(event.showtimes || []).map(st => ({ start: st.start_time, end: st.end_time }))
                    ];
                    // Deduplicate by start date string
                    const uniqueDatesMap = new Map();
                    rawDates.forEach(d => {
                      if (!uniqueDatesMap.has(d.start)) {
                        uniqueDatesMap.set(d.start, d);
                      }
                    });
                    const uniqueDates = Array.from(uniqueDatesMap.values());
                    
                    if (uniqueDates.length > 1) {
                      return (
                        <div className="relative flex items-center">
                          <select
                            className="appearance-none bg-transparent border-none text-white font-medium focus:ring-0 cursor-pointer pr-8 py-0 m-0"
                            style={{ outline: 'none', boxShadow: 'none' }}
                            defaultValue=""
                          >
                            <option value="" disabled hidden className="bg-[#171717] text-white">
                              Multiple Dates / Times
                            </option>
                            {uniqueDates.map((d, i) => (
                              <option key={i} value={d.start} className="bg-[#171717] text-white">
                                {formatDate(d.start)} • {event.is_all_day ? 'All Day' : `${formatTime(d.start)} – ${formatTime(d.end)}`}
                              </option>
                            ))}
                          </select>
                          <svg className="w-5 h-5 text-emerald-400 absolute right-1 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      );
                    }
                    
                    return (
                      <>
                        <span className="font-medium text-white">{formatDate(event.date_start)}</span>
                        <span>{event.is_all_day ? 'All Day' : `${formatTime(event.date_start)} – ${formatTime(event.date_end)}`}</span>
                      </>
                    );
                  })()}
                </div>

                <span className="text-slate-600 hidden sm:inline">•</span>

                {/* Venue */}
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {event.venue_id ? (
                    <Link
                      href={`/venues/${event.venue_id}`}
                      className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
                    >
                      {event.venue_name || event.location_name}
                    </Link>
                  ) : (
                    <span className="font-medium text-white">{event.venue_name || event.location_name}</span>
                  )}
                </div>
              </div>

              {/* ─── Conversion Stack ─── */}
              <div className="mt-8 sm:mt-10 flex flex-col gap-3">
                {/* Price */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Price:</span>
                  <span className="text-lg font-bold text-white">
                    {event.price_display || (event.price && event.price > 0 ? `£${event.price.toFixed(2)}` : 'Free Entry')}
                  </span>
                </div>

                {/* Primary CTA */}
                {!isPastEvent && (
                  <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-3">
                    {event.ticket_url && (
                      <a
                        href={event.ticket_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackTicketClick(event.id)}
                        className="flex items-center justify-center sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-sm font-bold rounded-lg transition-all shadow-md shadow-emerald-500/20"
                      >
                        Book Now
                      </a>
                    )}

                    {event.website_url && (
                      <a
                        href={event.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackWebsiteClick(event.id)}
                        className="flex items-center justify-center sm:w-auto px-6 py-2.5 border border-slate-500 hover:border-slate-300 text-slate-300 hover:text-white text-sm font-bold rounded-lg transition-all bg-transparent"
                      >
                        Visit Website
                      </a>
                    )}
                  </div>
                )}

                {isPastEvent && (
                  <p className="text-sm text-red-400 font-semibold mt-1">This event has ended.</p>
                )}
              </div>

              {/* ─── Owner/Admin Tools Cluster (muted, below CTA) ─── */}
              {hasEditRights && (
                <div className="mt-6 sm:mt-8 p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <Link
                      href={`/events/${event.id}/edit`}
                      className="text-xs font-medium text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Edit Event
                    </Link>

                    <a
                      href={`/social/${event.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
                    >
                      <span className="text-sm">🎨</span>
                      Generate Poster
                    </a>

                    <button
                      onClick={() => {
                        if (!isAuthenticated) {
                          router.push(`/login?returnUrl=${encodeURIComponent(router.asPath)}`);
                          return;
                        }
                        router.push(`/events/${event.id}/promote`);
                      }}
                      className="text-xs font-bold text-amber-900 bg-amber-400 hover:bg-amber-300 transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      Promote
                    </button>

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
                        className="text-xs font-medium text-orange-400/80 hover:text-orange-300 transition-colors inline-flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                        Stop Series
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
                      className="text-xs font-medium text-red-400/80 hover:text-red-300 transition-colors inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>

                  {/* Admin Stats */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <span title="Views" className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {event.view_count || 0}
                    </span>
                    <span title="Going" className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {event.attending_count || 0}
                    </span>
                    <span title="Saves" className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      {event.save_count || 0}
                    </span>
                  </div>
                </div>
              )}

              {/* ─── Quiet Utilities Row (Share + Save) ─── */}
              <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3">
                <SocialShare
                  url={typeof window !== 'undefined' ? window.location.href : ''}
                  title={event.title}
                  description={event.description}
                  variant="white"
                  showLabel={false}
                  size="md"
                />

                <BookmarkButton
                  eventId={event.id}
                  initialBookmarked={event.is_bookmarked}
                  showLabel={false}
                  size="md"
                  className="border border-slate-600 text-slate-400 hover:bg-white/5 hover:border-slate-400 hover:text-white"
                  onToggle={(isBookmarked, count) => {
                    setEvent(prev => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        is_bookmarked: isBookmarked,
                        save_count: count !== undefined 
                          ? count 
                          : (isBookmarked 
                              ? (prev.save_count || 0) + 1 
                              : Math.max(0, (prev.save_count || 0) - 1))
                      };
                    });
                  }}
                />

                <AddToCalendar 
                  event={event} 
                  showLabel={false}
                  buttonClassName="flex items-center justify-center w-10 h-10 rounded-full border border-slate-600 text-slate-400 hover:bg-white/5 hover:border-slate-400 hover:text-white transition-colors"
                />

                {/* Claim Event (for non-owners) */}
                {isAuthenticated && user && !hasEditRights && (
                  <button
                    onClick={() => setClaimModalOpen(true)}
                    className="text-xs font-medium text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5 ml-auto"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Claim Event
                  </button>
                )}
              </div>
              
              {/* More Info Anchor */}
              <div className="mt-8 sm:mt-10 border-t border-white/10 pt-6 flex justify-center lg:justify-start">
                <a href="#about-event" className="text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5">
                  More Info & Map ↓
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Past Event Banner */}
      {isPastEvent && (
        <div className="bg-red-50/50 border-b border-red-100 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-red-50 border border-red-200/60 rounded-2xl p-6 mb-8 text-center shadow-sm">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 mb-3">
                ⚠️ Event Ended
              </span>
              <h2 className="text-xl md:text-2xl font-bold text-red-950">
                This event ended on {formatDate(event.date_end || event.date_start)}.
              </h2>
            </div>
            
            {loadingUpcoming ? (
              <div className="animate-pulse flex space-x-4 h-48 items-center justify-center">
                <Spinner size="md" />
              </div>
            ) : upcomingEvents.length > 0 ? (
              <div>
                <h3 className="text-lg font-bold text-stone-900 mb-6 uppercase tracking-wider text-center md:text-left">
                  Missed this? Check out these upcoming events
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  {upcomingEvents.map((evt) => (
                    <SmallEventCard key={evt.id} event={evt} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Main Content - Wider Container */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-start" id="about-event">
          {/* Flat Editorial Container (No white box / no card borders) */}
          <div className="md:col-span-8 space-y-4 pb-2 max-w-3xl">
              {/* Front-Loaded Context: Category Badges, Age Restriction & Event Tags */}
              {((event.category || event.age_restriction || (event.tags && event.tags.length > 0))) && (
                <div className="flex flex-wrap items-center gap-2 mb-2">
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
                  {event.tags && event.tags.map((tag: any) => (
                    <Link key={tag.id} href={`/events?tag=${encodeURIComponent(tag.name)}`}>
                      <span
                        className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full hover:bg-purple-200 transition-colors cursor-pointer"
                      >
                        #{tag.name}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              <h2 className="text-2xl font-bold text-gray-900">About this event</h2>

              {event.description && (
                <div className="space-y-3">
                  <RichText
                    content={showFullDescription || event.description.length <= 400
                      ? event.description
                      : `${event.description.slice(0, 400)}...`}
                    className="text-gray-700 text-base leading-relaxed break-words w-full max-w-full overflow-hidden"
                  />
                  {event.description.length > 400 && (
                    <button
                      onClick={() => setShowFullDescription(!showFullDescription)}
                      className="text-emerald-600 hover:text-emerald-700 font-semibold text-sm inline-flex items-center gap-1"
                    >
                      {showFullDescription ? 'Show Less' : 'Show More'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Event Location Card */}
            <div className="md:col-span-4">
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
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 mb-2 group-hover:scale-105 transition-transform relative">
                            {pv.image_url ? (
                              <OptimizedImage
                                src={pv.image_url}
                                variant="thumb"
                                alt={pv.name}
                                fill
                                className="object-cover"
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
          </div>
        <AccommodationAds ads={accommodationAds} />

        {/* Divider above recommendations */}
        {!isPastEvent && (
          <div className="border-t border-gray-200 mt-12 pt-12">
            <SimilarEvents eventId={event.id} />
          </div>
        )}
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

      <ClaimEventModal
        isOpen={claimModalOpen}
        onClose={() => setClaimModalOpen(false)}
        eventId={event.id}
        eventTitle={event.title}
      />

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
            <OptimizedImage
              src={event.image_url}
              variant="hero"
              alt={event.title}
              width={1200}
              height={800}
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

export const getServerSideProps: GetServerSideProps<EventDetailPageProps> = async (context) => {
  const { id } = context.params as { id: string };

  try {
    // Determine API URL (Server-side)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8003';

    // Fetch Event Data directly to ensure SSR speed and isolation
    const res = await fetch(`${apiUrl}/api/events/${id}`);

    if (res.status === 404 || !res.ok) {
      return { notFound: true };
    }

    const event: EventResponse = await res.json();
    if (!event) {
      return { notFound: true };
    }

    const baseUrl = 'https://highlandeventshub.co.uk';

    // --- 301 Redirect Enforcer ---
    // If accessed via UUID or outdated slug and a canonical slug exists, 
    // immediately execute a permanent 301 redirect to the clean slug path.
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id) || /^[0-9a-fA-F]{32}$/.test(id);
    if ((isUuid || id !== event.slug) && event.slug) {
      // Preserve query parameters (UTM, ticket, etc.) through the redirect
      const queryString = context.resolvedUrl.includes('?')
        ? context.resolvedUrl.substring(context.resolvedUrl.indexOf('?'))
        : '';
      return {
        redirect: {
          destination: `/events/${event.slug}${queryString}`,
          permanent: true,
        },
      };
    }

    // Construct rich text description safely
    const description = event.description
      ? event.description.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...'
      : `Join us for ${event.title} at ${event.venue_name || event.location_name || 'Highland Events Hub'}`;

    const optimizedOgUrl = event.image_url ? optimizeImage(event.image_url, 'og') : null;
    const ogImage = optimizedOgUrl
      ? (optimizedOgUrl.startsWith('http') ? optimizedOgUrl : `${baseUrl}/${optimizedOgUrl.startsWith('/') ? optimizedOgUrl.substring(1) : optimizedOgUrl}`)
      : `${baseUrl}/images/og-default.jpg`;

    return {
      props: {
        initialEvent: event,
        baseUrl,
        // Pass metadata to _app.tsx for immediate SEO
        meta: {
          title: event.seo_title || `${event.title} at ${event.venue_name || event.location_name || 'Highlands'} | Tickets, Dates & Info | Highland Events Hub`,
          description: event.seo_description || description,
          url: `${baseUrl}/events/${event.slug || event.id}`,
          image: ogImage,
          type: 'event',
        }
      },
    };
  } catch (error) {
    console.error('SSR Error fetching event:', error);
    return { notFound: true };
  }
};
