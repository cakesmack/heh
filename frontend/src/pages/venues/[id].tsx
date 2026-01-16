/**
 * Venue Detail Page
 * Show venue details with events and promotions
 */

import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { VenueResponse, EventResponse, PromotionResponse, VenueStaffResponse } from '@/types';
import ReportModal from '@/components/common/ReportModal';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { EventCard } from '@/components/events/EventCard';
import { PromotionCard } from '@/components/promotions/PromotionCard';
import { FollowButton } from '@/components/common/FollowButton';
import SocialLinks from '@/components/common/SocialLinks';
import RichText from '@/components/ui/RichText';

// Dynamic import for GoogleMiniMap to avoid SSR issues
const GoogleMiniMap = dynamic(() => import('@/components/maps/GoogleMiniMap'), { ssr: false });

export default function VenueDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [venue, setVenue] = useState<VenueResponse | null>(null);
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [promotions, setPromotions] = useState<PromotionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();
  const { trackVenueView } = useAnalytics();
  const [staff, setStaff] = useState<VenueStaffResponse[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'promotions' | 'about' | 'staff'>('events');

  // Pagination State
  const [eventsTotal, setEventsTotal] = useState(0);
  const [isLoadingMoreEvents, setIsLoadingMoreEvents] = useState(false);

  const isOwner = currentUser && (venue?.owner_id === currentUser.id || currentUser.is_admin);

  useEffect(() => {
    if (isOwner && id) {
      fetchStaff();
    }
  }, [isOwner, id]);

  const fetchStaff = async () => {
    setIsStaffLoading(true);
    try {
      const staffData = await api.venues.listStaff(id as string);
      setStaff(staffData);
    } catch (err) {
      console.error('Error fetching staff:', err);
    } finally {
      setIsStaffLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffEmail) return;
    setIsAddingStaff(true);
    try {
      await api.venues.addStaff(id as string, { user_email: newStaffEmail, role: 'staff' });
      setNewStaffEmail('');
      fetchStaff();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add staff');
    } finally {
      setIsAddingStaff(false);
    }
  };

  const handleRemoveStaff = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      await api.venues.removeStaff(id as string, userId);
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

  useEffect(() => {
    if (!id) return;

    const fetchVenueData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch venue details
        const venueData = await api.venues.get(id as string);
        setVenue(venueData);

        // Fetch events at this venue
        try {
          const eventsData = await api.events.list({ venue_id: id as string, limit: 12, skip: 0 });
          setEvents(eventsData.events);
          setEventsTotal(eventsData.total || 0);
        } catch (err) {
          console.error('Error fetching events:', err);
        }

        // Fetch promotions at this venue
        try {
          const promotionsData = await api.promotions.listActive(id as string);
          setPromotions(promotionsData.promotions);
        } catch (err) {
          console.error('Error fetching promotions:', err);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load venue');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVenueData();
  }, [id]);

  const handleLoadMoreEvents = async () => {
    if (!id || isLoadingMoreEvents) return;
    setIsLoadingMoreEvents(true);
    try {
      const skip = events.length;
      const res = await api.events.list({ venue_id: id as string, skip, limit: 12 });

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
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Spinner size="lg" />
          <p className="text-gray-600 mt-4">Loading venue...</p>
        </div>
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Venue Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This venue does not exist.'}</p>
          <Link href="/venues" className="text-emerald-600 hover:text-emerald-700">
            &larr; Back to Venues
          </Link>
        </div>
      </div>
    );
  }

  const pageTitle = `${venue.name} | Highland Events Hub`;
  const pageDescription = venue.description
    ? (venue.description.length > 160 ? `${venue.description.substring(0, 157)}...` : venue.description)
    : `Discover events and promotions at ${venue.name} in ${venue.address}.`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://highlandeventshub.com/venues/${venue.id}`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        {venue.image_url && <meta property="og:image" content={venue.image_url} />}

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={`https://highlandeventshub.com/venues/${venue.id}`} />
        <meta property="twitter:title" content={pageTitle} />
        <meta property="twitter:description" content={pageDescription} />
        {venue.image_url && <meta property="twitter:image" content={venue.image_url} />}
      </Head>
      {/* Cinematic Hero */}
      <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
        {/* Blurred Background */}
        <div className="absolute inset-0">
          {venue.image_url ? (
            <img
              src={venue.image_url}
              alt=""
              className="w-full h-full object-cover blur-2xl scale-110 opacity-60"
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
              <img
                src={venue.image_url}
                alt={venue.name}
                className="w-full h-full object-cover object-top"
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

            <div className="flex items-center gap-4">
              <FollowButton targetId={venue.id} targetType="venue" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Content Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tabs */}
            <div className="flex items-center gap-8 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('events')}
                className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'events' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
              >
                Events ({events.length})
              </button>
              {/* HIDDEN FOR ALPHA - Promotions feature not ready */}
              {false && (
                <button
                  onClick={() => setActiveTab('promotions')}
                  className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'promotions' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                >
                  Promotions ({promotions.length})
                </button>
              )}
              <button
                onClick={() => setActiveTab('about')}
                className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'about' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
              >
                About
              </button>
              {isOwner && (
                <button
                  onClick={() => setActiveTab('staff')}
                  className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'staff' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                >
                  Staff
                </button>
              )}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
              {activeTab === 'events' && (
                <div className="space-y-6">
                  {events.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {events.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                      <p className="text-gray-500">No upcoming events scheduled.</p>
                    </div>
                  )}

                  {/* Load More Button */}
                  {events.length < eventsTotal && (
                    <div className="py-8 flex justify-center">
                      <Button
                        variant="outline"
                        onClick={handleLoadMoreEvents}
                        isLoading={isLoadingMoreEvents}
                      >
                        Load More Events
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* HIDDEN FOR ALPHA - Promotions feature not ready */}
              {false && activeTab === 'promotions' && (
                <div className="space-y-6">
                  {promotions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {promotions.map((promotion) => (
                        <PromotionCard key={promotion.id} promotion={promotion} />
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                      <p className="text-gray-500">No active promotions at this time.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'about' && (
                <div className="space-y-8">
                  <Card>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">About {venue.name}</h2>
                    {venue.description ? (
                      <RichText content={venue.description} className="text-gray-700 leading-relaxed" />
                    ) : (
                      <p className="text-gray-500 italic">No description available.</p>
                    )}
                  </Card>

                  {/* Amenities */}
                  <Card>
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Amenities & Features</h2>
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
                </div>
              )}

              {activeTab === 'staff' && isOwner && (
                <div className="space-y-6">
                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Manage Staff</h3>
                    <form onSubmit={handleAddStaff} className="flex gap-2 mb-6">
                      <input
                        type="email"
                        value={newStaffEmail}
                        onChange={(e) => setNewStaffEmail(e.target.value)}
                        placeholder="Staff member email"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      />
                      <Button type="submit" isLoading={isAddingStaff} variant="primary">
                        Add Staff
                      </Button>
                    </form>

                    {isStaffLoading ? (
                      <div className="flex justify-center py-8">
                        <Spinner />
                      </div>
                    ) : staff.length > 0 ? (
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {staff.map((s) => (
                              <tr key={s.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">{s.user_username || 'User'}</div>
                                  <div className="text-sm text-gray-500">{s.user_email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <Badge variant="info">{s.role}</Badge>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => handleRemoveStaff(s.user_id)}
                                    className="text-red-600 hover:text-red-900"
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
                      <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-500">No staff members added yet.</p>
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-8">
            {/* Map Card */}
            <Card className="overflow-hidden p-0">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Location</h3>
                <p className="text-sm text-gray-500">{venue.address}</p>
              </div>
              {venue.latitude && venue.longitude && (
                <GoogleMiniMap
                  latitude={venue.latitude}
                  longitude={venue.longitude}
                  height="300px"
                  zoom={15}
                  interactive={true}
                />
              )}
              <div className="p-4 bg-gray-50">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  Get Directions
                </a>
              </div>
            </Card>

            {/* Contact Card */}
            <Card>
              <h3 className="font-bold text-gray-900 mb-4">Contact Info</h3>
              <div className="space-y-4 text-sm">
                {venue.phone && (
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    <a href={`tel:${venue.phone}`} className="text-gray-600 hover:text-blue-600">{venue.phone}</a>
                  </div>
                )}
                {venue.email && (
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <a href={`mailto:${venue.email}`} className="text-gray-600 hover:text-blue-600">{venue.email}</a>
                  </div>
                )}
                {venue.website && (
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                    <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Visit Website</a>
                  </div>
                )}
              </div>

              {/* Social Media Links */}
              <SocialLinks
                facebook={venue.social_facebook}
                instagram={venue.social_instagram}
                x={venue.social_x}
                linkedin={venue.social_linkedin}
                tiktok={venue.social_tiktok}
                website={venue.website_url}
                className="mt-4 pt-4 border-t border-gray-100"
              />
            </Card>

            {/* Opening Hours Card */}
            {venue.opening_hours && (
              <Card>
                <h3 className="font-bold text-gray-900 mb-4">Opening Hours</h3>
                <RichText content={venue.opening_hours} className="text-sm text-gray-600" />
              </Card>
            )}

            {/* Claim Card */}
            <div className="p-6 bg-stone-900 rounded-2xl text-white">
              <h3 className="font-bold mb-2">Is this your venue?</h3>
              <p className="text-sm text-stone-400 mb-4">Claim this listing to manage events, promotions, and more.</p>
              <button
                onClick={async () => {
                  const reason = prompt("Why do you want to claim this venue?");
                  if (!reason) return;
                  try {
                    await api.venueClaims.create(venue.id, reason);
                    alert("Claim submitted successfully!");
                  } catch (err) {
                    alert("Failed to submit claim.");
                  }
                }}
                className="w-full py-2 bg-white text-stone-950 rounded-lg text-sm font-bold hover:bg-stone-200 transition-colors"
              >
                Claim Venue
              </button>
            </div>
          </div>
        </div>
      </div>
      {venue && (
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="venue"
          targetId={venue.id}
          targetName={venue.name}
        />
      )}
    </div>
  );
}

function AmenityItem({ icon, label, active }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${active ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-400 grayscale'}`}>
      <div className={active ? 'text-blue-600' : 'text-gray-400'}>
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
      {!active && <span className="ml-auto text-[10px] uppercase tracking-wider font-bold opacity-50">No</span>}
    </div>
  );
}
