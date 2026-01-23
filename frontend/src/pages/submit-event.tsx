
/**
 * Submit Event Page
 * Form to submit new events using a section-based layout
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api, apiFetch } from '@/lib/api';
import { VenueResponse, Category, Organizer, ShowtimeCreate } from '@/types';
import { Button } from '@/components/common/Button';
import { isHIERegion, isPointInHighlands } from '@/utils/validation/hie-check';

// Sections
import EventMediaSection from '@/components/events/form-sections/EventMediaSection';
import EventBasicDetails from '@/components/events/form-sections/EventBasicDetails';
import EventLocationSection from '@/components/events/form-sections/EventLocationSection';
import EventScheduleSection from '@/components/events/form-sections/EventScheduleSection';
import EventTicketingSection from '@/components/events/form-sections/EventTicketingSection';

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
    organizer_profile_id: '',
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
  });

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeCreate[]>([]);
  const [isMultiSession, setIsMultiSession] = useState(false);
  const [noEndTime, setNoEndTime] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<{ type: 'published' | 'pending' | 'duplicate'; eventId: string } | null>(null);
  const [isLocationValid, setIsLocationValid] = useState(true);

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
          setOrganizers(response.organizers || []);
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
    setIsLoading(true);

    try {
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
        organizer_profile_id: formData.organizer_profile_id || undefined,
        is_recurring: formData.is_recurring,
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
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (newEvent.status === 'published') {
        setSuccessMessage({ type: 'published', eventId: newEvent.id });
        setTimeout(() => router.push(`/events/${newEvent.id}`), 2000);
      } else if (newEvent.status === 'pending_moderation') {
        setSuccessMessage({ type: 'duplicate', eventId: newEvent.id });
        setTimeout(() => router.push('/events'), 4000);
      } else {
        setSuccessMessage({ type: 'pending', eventId: newEvent.id });
        setTimeout(() => router.push('/events'), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit event.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Sign In Required</h1>
          <p className="text-gray-600 mb-6">Please sign in to submit an event.</p>
          <Link href="/login" className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Submit an Event</h1>
          <p className="text-lg text-gray-600">Share your event with the Highland Events Hub community and reach thousands of locals and visitors.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Status Messages */}
          <div className="max-w-3xl mb-8">
            {successMessage?.type === 'published' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-6">
                <p className="text-emerald-800 font-medium">Event published! Redirecting...</p>
              </div>
            )}
            {successMessage?.type === 'pending' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
                <p className="text-amber-800 font-medium">Event submitted for review.</p>
              </div>
            )}
            {successMessage?.type === 'duplicate' && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg mb-6">
                <p className="text-orange-800 font-bold">Event submitted for review.</p>
                <p className="text-orange-700 text-sm mt-1">
                  Our system detected a similar event. We'll verify it shortly.
                </p>
              </div>
            )}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm mb-6">
                {error}
              </div>
            )}
          </div>

          <div className="space-y-6">
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
            />

            <EventTicketingSection
              formData={formData}
              handleChange={handleChange}
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
  );
}
