
/**
 * Submit Event Page
 * Form to submit new events using a section-based layout
 */

'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api, apiFetch } from '@/lib/api';
import { AuthGuard } from '@/components/common/AuthGuard';
import { VenueResponse, Category, Organizer, ShowtimeCreate, Tag, EventCreate } from '@/types';
import { Button } from '@/components/common/Button';
import { isHIERegion, isPointInHighlands } from '@/utils/validation/hie-check';

// Sections
import EventMediaSection from '@/components/events/form-sections/EventMediaSection';
import EventBasicDetails from '@/components/events/form-sections/EventBasicDetails';
import EventLocationSection from '@/components/events/form-sections/EventLocationSection';
import EventScheduleSection from '@/components/events/form-sections/EventScheduleSection';
import EventTicketingSection from '@/components/events/form-sections/EventTicketingSection';
import OrganizerSelector from '@/components/events/OrganizerSelector';

export default function SubmitEventPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [participatingVenues, setParticipatingVenues] = useState<VenueResponse[]>([]);

  const [locationTab, setLocationTab] = useState<'main' | 'multi'>('main');
  const [locationMode, setLocationMode] = useState<'venue' | 'custom'>('venue');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    venue_id: '',
    location_name: '',
    latitude: 57.4778, // Default to Inverness
    longitude: -4.2247,
    date_start: '',
    date_end: '',
    price: '0',
    image_url: '',
    ticket_url: '',
    website_url: '',
    age_restriction: '',
    organizer_profile_id: '', // Will be synched with selectedOrganizer
    is_recurring: false,
    is_all_day: false,
    frequency: 'WEEKLY',
    recurrence_end_date: '',
    ends_on: 'never',
    weekdays: [] as number[],  // 0=Mon, 1=Tue, ... 6=Sun
    postcode: '',
    address: '',
    // Map Display Override
    map_display_lat: null as number | null,
    map_display_lng: null as number | null,
    map_display_label: '',
    recurrence_rule: '',
  });

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeCreate[]>([]);
  const [isMultiSession, setIsMultiSession] = useState(false);
  const [noEndTime, setNoEndTime] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLocationValid, setIsLocationValid] = useState(true);

  // Post-submit modal state
  const [showPostSubmitModal, setShowPostSubmitModal] = useState(false);
  const [newEventUrl, setNewEventUrl] = useState('');
  const [eventStatus, setEventStatus] = useState<'published' | 'pending' | 'pending_moderation'>('pending');
  const [newEventId, setNewEventId] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  // Organizer Selection State
  // null = not selected (validation error if submitting)
  // '' = Myself
  // 'id' = Group ID
  const [selectedOrganizer, setSelectedOrganizer] = useState<string | null>(null);
  const [organizerError, setOrganizerError] = useState<string | undefined>(undefined);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await api.categories.list();
        setCategories(data.categories || []);
        if (data.categories && data.categories.length > 0) {
          setFormData(prev => ({ ...prev, category_id: data.categories[0].id }));
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    const fetchOrganizers = async () => {
      if (user) {
        try {
          const response = await apiFetch<any>(`/api/organizers?user_id=${user.id}`);
          const orgs = response.organizers || [];
          setOrganizers(orgs);

          // Logic: Default to 'Myself' ONLY if they have 0 groups.
          // Otherwise force selection.
          if (orgs.length === 0) {
            setSelectedOrganizer('');
          } else {
            setSelectedOrganizer(null);
          }
        } catch (err) {
          console.error('Error fetching organizers:', err);
        }
      }
    };

    fetchCategories();
    if (user) fetchOrganizers();
  }, [user]);

  // Handle URL parameters
  useEffect(() => {
    if (router.isReady && router.query.organizer_profile_id) {
      const profileId = router.query.organizer_profile_id as string;
      setFormData(prev => ({ ...prev, organizer_profile_id: profileId }));
    }
  }, [router.isReady, router.query]);

  const handleVenueChange = (venueId: string, venue: VenueResponse | null) => {
    setFormData(prev => ({ ...prev, venue_id: venueId }));
  };

  const handlePlaceSelect = (place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      let postcode = '';
      if (place.address_components) {
        const postcodeComponent = place.address_components.find(
          comp => comp.types.includes('postal_code')
        );
        postcode = postcodeComponent?.long_name || '';
      }

      const isValid = postcode
        ? isHIERegion(postcode)
        : isPointInHighlands(lat, lng);
      setIsLocationValid(isValid);

      setFormData(prev => ({
        ...prev,
        location_name: place.name || place.formatted_address || '',
        latitude: lat,
        longitude: lng,
        postcode: postcode,
      }));
    }
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const handleMapDisplayChange = (updates: { map_display_lat?: number; map_display_lng?: number; map_display_label?: string }) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const handleImageUpload = (urls: { url: string; thumbnail_url: string; medium_url: string }) => {
    setFormData(prev => ({ ...prev, image_url: urls.url }));
  };

  const handleImageRemove = () => {
    setFormData(prev => ({ ...prev, image_url: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setOrganizerError(undefined);
    setIsLoading(true);

    try {
      // Validation: Organizer
      if (selectedOrganizer === null) {
        setOrganizerError("Please select who is hosting this event.");
        // Scroll to top
        const element = document.getElementById('organizer-selector');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        throw new Error("Please select an organizer.");
      }

      if (locationTab === 'main') {
        if (locationMode === 'venue' && !formData.venue_id) throw new Error('Please select a venue');
        if (locationMode === 'custom') {
          if (!formData.location_name) throw new Error('Please enter a location name');
          if (!isLocationValid) throw new Error('Events must be located within the Scottish Highlands.');
        }
      } else {
        if (participatingVenues.length === 0) throw new Error('Please add at least one participating venue');
      }
      if (!formData.category_id) throw new Error('Please select a category');
      if (new Date(formData.date_end) <= new Date(formData.date_start) && !noEndTime) throw new Error('End date must be after start date');

      let calculatedDateStart = formData.date_start;
      let calculatedDateEnd = formData.date_end;
      let showtimesPayload: ShowtimeCreate[] | undefined = undefined;

      if (isMultiSession && showtimes.length > 0) {
        const startTimes = showtimes.map(st => new Date(st.start_time).getTime());
        const endTimes = showtimes.map(st => st.end_time ? new Date(st.end_time).getTime() : new Date(st.start_time).getTime());
        calculatedDateStart = new Date(Math.min(...startTimes)).toISOString();
        calculatedDateEnd = new Date(Math.max(...endTimes)).toISOString();
        showtimesPayload = showtimes;
      } else if (isMultiSession && showtimes.length === 0) {
        throw new Error('Please add at least one showtime');
      } else {
        showtimesPayload = undefined;
        calculatedDateStart = new Date(formData.date_start).toISOString();
        if (noEndTime) {
          const startDate = new Date(formData.date_start);
          calculatedDateEnd = new Date(startDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
        } else {
          calculatedDateEnd = new Date(formData.date_end).toISOString();
        }
      }

      const eventData = {
        title: formData.title,
        description: formData.description || undefined,
        category_id: formData.category_id,
        venue_id: (locationTab === 'main' && locationMode === 'venue') ? (formData.venue_id || null) : null,
        location_name: (locationTab === 'main' && locationMode === 'custom') ? formData.location_name : null,
        latitude: (locationTab === 'main' && locationMode === 'custom') ? formData.latitude : null,
        longitude: (locationTab === 'main' && locationMode === 'custom') ? formData.longitude : null,
        date_start: calculatedDateStart,
        date_end: calculatedDateEnd,
        price: formData.price,
        image_url: formData.image_url || undefined,
        ticket_url: formData.ticket_url || undefined,
        website_url: formData.website_url || undefined,
        is_all_day: formData.is_all_day,
        age_restriction: formData.age_restriction || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        organizer_profile_id: selectedOrganizer || undefined, // Use explicit selection
        is_recurring: formData.is_recurring,
        recurrence_rule: (formData.is_recurring && formData.frequency === 'CUSTOM') ? formData.recurrence_rule : undefined,
        frequency: formData.is_recurring ? formData.frequency : undefined,
        recurrence_end_date: (formData.is_recurring && formData.ends_on === 'date') ? new Date(formData.recurrence_end_date).toISOString() : undefined,
        weekdays: formData.is_recurring && formData.weekdays.length > 0 ? formData.weekdays : undefined,
        participating_venue_ids: participatingVenues.length > 0 ? participatingVenues.map(v => v.id) : undefined,
        showtimes: showtimesPayload,
        // Map Display
        map_display_lat: formData.map_display_lat,
        map_display_lng: formData.map_display_lng,
        map_display_label: formData.map_display_label || undefined,
      };

      const newEvent = await api.events.create(eventData);

      // Build absolute public URL for sharing
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const publicUrl = `${origin}/events/${newEvent.id}`;

      setNewEventId(newEvent.id);
      setNewEventUrl(publicUrl);
      setEventStatus(newEvent.status === 'published' ? 'published' : newEvent.status === 'pending_moderation' ? 'pending_moderation' : 'pending');
      setShowPostSubmitModal(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      if (err.status === 422 && err.detail) {
        // Handle Pydantic validation errors
        const newFieldErrors: Record<string, string> = {};
        let generalError = "Please correct the highlighted errors below.";

        err.detail.forEach((error: any) => {
          const field = error.loc[error.loc.length - 1];
          let msg = error.msg;

          // Humanize common error messages
          if (error.type === 'string_too_long') {
            const max = error.ctx?.limit_value || (field === 'description' ? 20000 : 255);
            msg = `This ${field} is too long (Max ${max.toLocaleString()} characters).`;
          } else if (error.type === 'value_error.missing' || error.type === 'missing') {
            msg = "This field is required.";
          }

          newFieldErrors[field] = msg;
        });

        setFieldErrors(newFieldErrors);
        setError(generalError);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to submit event.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Submit an Event</h1>
            <p className="text-lg text-gray-600">Share your event with the Highland Events Hub community and reach thousands of locals and visitors.</p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Error Messages */}
            <div className="max-w-3xl mb-8">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm mb-6">
                  {error}
                </div>
              )}
            </div>

            <div className="space-y-6">

              < OrganizerSelector
                user={user}
                organizers={organizers}
                selectedId={selectedOrganizer || ''} // Pass '' if null to avoid controlled/uncontrolled warning, though component handles it? actually component expects string.
                onChange={(id) => {
                  setSelectedOrganizer(id);
                  setOrganizerError(undefined);
                }}
                error={organizerError}
              />

              <EventMediaSection
                imageUrl={formData.image_url}
                onUpload={handleImageUpload}
                onRemove={handleImageRemove}
              />

              <EventBasicDetails
                formData={formData}
                handleChange={handleChange}
                setFormData={setFormData}
                categories={categories}
                organizers={organizers}
                userEmail={user?.email}
                selectedTags={selectedTags}
                setSelectedTags={setSelectedTags}
                fieldErrors={fieldErrors}
              />

              <EventLocationSection
                locationTab={locationTab}
                setLocationTab={setLocationTab}
                locationMode={locationMode}
                setLocationMode={setLocationMode}
                formData={formData}
                handleVenueChange={handleVenueChange}
                handlePlaceSelect={handlePlaceSelect}
                handleLocationChange={handleLocationChange}
                participatingVenues={participatingVenues}
                setParticipatingVenues={setParticipatingVenues}
                isLocationValid={isLocationValid}
                onMapDisplayChange={handleMapDisplayChange}
                fieldErrors={fieldErrors}
              />

              <EventScheduleSection
                formData={formData}
                setFormData={setFormData}
                handleChange={handleChange}
                isMultiSession={isMultiSession}
                setIsMultiSession={setIsMultiSession}
                showtimes={showtimes}
                setShowtimes={setShowtimes}
                noEndTime={noEndTime}
                setNoEndTime={setNoEndTime}
                isAllDay={formData.is_all_day}
                setIsAllDay={(val) => setFormData(prev => ({ ...prev, is_all_day: val }))}
                fieldErrors={fieldErrors}
              />

              <EventTicketingSection
                formData={formData}
                handleChange={handleChange}
                setFormData={setFormData}
                fieldErrors={fieldErrors}
              />
            </div>

            <div className="flex justify-end pt-8 gap-4 border-t border-gray-200 mt-8">
              <Link href="/events" className="px-6 py-3 text-gray-600 hover:text-emerald-600 font-medium">Cancel</Link>
              <Button type="submit" variant="primary" size="lg" disabled={isLoading} className="min-w-[150px]">
                {isLoading ? 'Submitting...' : 'Submit Event'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Post-Submit Modal */}
      {showPostSubmitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowPostSubmitModal(false);
            router.push(eventStatus === 'published' ? `/events/${newEventId}` : '/account');
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {eventStatus === 'published' ? (
              /* ===== Branch A: Live / Approved ===== */
              <>
                <div className="w-16 h-16 mx-auto mb-5 bg-emerald-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Your event is live on the map.</h2>
                <p className="text-gray-600 mb-8">
                  Now, get it in front of your audience.
                </p>

                {/* Share Action — Web Share API with clipboard fallback */}
                <div className="mb-6">
                  <button
                    onClick={async () => {
                      try {
                        if (navigator.share) {
                          await navigator.share({ title: 'Check out my event!', url: newEventUrl });
                        } else {
                          await navigator.clipboard.writeText(newEventUrl);
                          setShareCopied(true);
                          setTimeout(() => setShareCopied(false), 2500);
                        }
                      } catch (err: any) {
                        // User cancelled share or API unavailable — fall back to clipboard
                        if (err?.name !== 'AbortError') {
                          await navigator.clipboard.writeText(newEventUrl);
                          setShareCopied(true);
                          setTimeout(() => setShareCopied(false), 2500);
                        }
                      }
                    }}
                    className={`w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-medium transition-all duration-200 ${shareCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                  >
                    {shareCopied ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Link Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        Share Event
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => {
                    setShowPostSubmitModal(false);
                    router.push(`/events/${newEventId}`);
                  }}
                  className="text-sm text-gray-500 hover:text-emerald-600 transition-colors"
                >
                  Skip and view my event page &rarr;
                </button>
              </>
            ) : (
              /* ===== Branch B: Pending ===== */
              <>
                <div className="w-16 h-16 mx-auto mb-5 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Event submitted for review.</h2>
                <p className="text-gray-600 mb-8">
                  Your event is currently pending approval by our moderation team to ensure quality. You will receive an email the moment it goes live on the map.
                </p>

                <button
                  onClick={() => {
                    setShowPostSubmitModal(false);
                    router.push('/account');
                  }}
                  className="w-full px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
                >
                  Got it, take me to my dashboard
                </button>
              </>
            )}
          </div>
        </div>
      )}

    </AuthGuard>
  );
}
