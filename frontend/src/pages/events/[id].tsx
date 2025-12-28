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
import { CheckInButton } from '@/components/events/CheckInButton';
import ShareButtons from '@/components/events/ShareButtons';
import { BookmarkButton } from '@/components/events/BookmarkButton';
import ReportModal from '@/components/common/ReportModal';
import SimilarEvents from '@/components/events/SimilarEvents';
import AgeRestrictionBadge from '@/components/events/AgeRestrictionBadge';
import AddToCalendar from '@/components/events/AddToCalendar';
import { api } from '@/lib/api';
import type { EventResponse } from '@/types';

// Dynamic import for MiniMap to avoid SSR issues with mapbox-gl
const MiniMap = dynamic(() => import('@/components/maps/MiniMap'), { ssr: false });

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

  const pageTitle = `${event.title} | Highland Events Hub`;
  const pageDescription = event.description
    ? (event.description.length > 160 ? `${event.description.substring(0, 157)}...` : event.description)
    : `Join us for ${event.title} at ${event.venue_name || event.location_name || 'Inverness'}.`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://highlandeventshub.com/events/${event.id}`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        {event.image_url && <meta property="og:image" content={event.image_url} />}

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={`https://highlandeventshub.com/events/${event.id}`} />
        <meta property="twitter:title" content={pageTitle} />
        <meta property="twitter:description" content={pageDescription} />
        {event.image_url && <meta property="twitter:image" content={event.image_url} />}
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

        {/* Sharp Centered Image */}
        <div className="absolute inset-0 flex items-center justify-center px-4 pb-20">
          <div
            className={`relative w-full max-w-3xl aspect-[16/9] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 ${event.image_url ? 'cursor-pointer group' : ''}`}
            onClick={() => event.image_url && setImageLightboxOpen(true)}
          >
            {event.image_url ? (
              <>
                <img
                  src={event.image_url}
                  alt={event.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
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

        {/* Floating Actions */}
        <div className="absolute top-8 right-8 flex items-center gap-3 z-20">
          <BookmarkButton eventId={event.id} size="lg" className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white" />
          <button
            onClick={() => setReportModalOpen(true)}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-red-500/20 backdrop-blur-md border border-white/10 text-white/70 hover:text-red-400 flex items-center justify-center transition-all"
            title="Report Event"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Info Ribbon */}
      <div className="sticky top-0 z-30 bg-stone-950/80 backdrop-blur-xl border-y border-white/5 text-white py-6 shadow-2xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white truncate mb-2">{event.title}</h1>
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-bold text-emerald-400">
                    {event.price && event.price > 0 ? `£${event.price.toFixed(2)}` : 'Free Entry'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
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
              ) : (
                <div className="flex-1 md:flex-none px-8 py-3 bg-white/5 text-white/50 font-bold rounded-full border border-white/10 text-center cursor-default">
                  No Tickets Needed
                </div>
              )}

              {isAuthenticated && isEventHappening() && (
                <CheckInButton
                  eventId={event.id}
                  eventTitle={event.title}
                  onSuccess={refetch}
                  className="flex-1 md:flex-none px-8 py-3 bg-white text-stone-950 font-bold rounded-full hover:bg-stone-200 transition-all transform hover:scale-105 shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Event Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              {(event.category || event.age_restriction) && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {event.category && (
                    <Badge variant="info" size="sm">
                      {event.category.name}
                    </Badge>
                  )}
                  <AgeRestrictionBadge value={event.age_restriction} size="md" />
                </div>
              )}

              <h2 className="text-2xl font-bold text-gray-900 mb-4">About this event</h2>

              {event.description && (
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {event.description}
                </p>
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
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Location</h2>
              <div className="space-y-4">
                {event.venue_name && (
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{event.venue_name}</p>
                      {event.venue_id && (
                        <Link href={`/venues/${event.venue_id}`} className="text-sm text-emerald-600 hover:underline">
                          View venue details
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {event.latitude && event.longitude && (
                  <div className="mt-4 rounded-xl overflow-hidden border border-gray-100">
                    <MiniMap
                      latitude={event.latitude}
                      longitude={event.longitude}
                      height="250px"
                      zoom={14}
                    />
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Time & Date Sidebar Card */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">When</h3>
              <div className="space-y-4">
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
                    <p className="text-sm text-gray-500">{formatTime(event.date_start)} - {formatTime(event.date_end)}</p>
                  </div>
                </div>

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

            {/* Event Stats Sidebar Card */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Event Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span className="font-medium text-gray-900">{event.category?.name || 'General'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Price</span>
                  <span className="font-medium text-gray-900">
                    {event.price === 0 ? 'Free' : `£${event.price.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Attendance</span>
                  <span className="font-medium text-gray-900">{event.checkin_count || 0} checked in</span>
                </div>
                {isAuthenticated && (
                  <div className="pt-3 mt-3 border-t border-gray-100 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Views</span>
                      <span className="font-medium text-gray-900">{event.view_count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Saves</span>
                      <span className="font-medium text-gray-900">{event.save_count || 0}</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Owner Actions */}
            {user && (event.organizer_id === user.id || user.is_admin) && (
              <Card className="mt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Manage Event</h3>
                <div className="space-y-2">
                  <Link
                    href={`/events/${event.id}/edit`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit Event
                  </Link>

                  <Link
                    href={`/events/${event.id}/promote`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Promote Event
                  </Link>

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

        <SimilarEvents eventId={event.id} />
      </div>

      {event && (
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="event"
          targetId={event.id}
          targetName={event.title}
        />
      )}

      {/* Image Lightbox Modal */}
      {imageLightboxOpen && event?.image_url && (
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
      )}
    </div>
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

    return {
      props: {
        initialEvent: event,
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
