/**
 * Submit Event Page
 * Form to submit new events with category selection, tags, and image upload
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api, apiFetch } from '@/lib/api';
import { VenueResponse, Category, Organizer, ShowtimeCreate } from '@/types';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import TagInput from '@/components/tags/TagInput';
import ImageUpload from '@/components/common/ImageUpload';
import VenueTypeahead from '@/components/venues/VenueTypeahead';
import DateTimePicker from '@/components/common/DateTimePicker';
import { AGE_RESTRICTION_OPTIONS } from '@/lib/ageRestriction';
import { isHIERegion, isPointInHighlands } from '@/utils/validation/hie-check';

import LocationPickerMap from '@/components/maps/LocationPickerMap';
import MultiVenueSelector from '@/components/venues/MultiVenueSelector';
import GooglePlacesAutocomplete from '@/components/common/GooglePlacesAutocomplete';

export default function SubmitEventPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueResponse | null>(null);
  const [participatingVenues, setParticipatingVenues] = useState<VenueResponse[]>([]);

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
    age_restriction: '',
    organizer_profile_id: '',
    is_recurring: false,
    frequency: 'WEEKLY',
    recurrence_end_date: '',
    ends_on: 'never',
    postcode: '',
    address: ''
  });

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeCreate[]>([]);
  const [isMultiSession, setIsMultiSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<{ type: 'published' | 'pending'; eventId: string } | null>(null);
  const [isLocationValid, setIsLocationValid] = useState(true); // Geofencing validation state

  // ... (useEffect for fetching categories/organizers remains same)
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

  const handleVenueChange = (venueId: string, venue: VenueResponse | null) => {
    setSelectedVenue(venue);
    setFormData(prev => ({ ...prev, venue_id: venueId }));
  };

  const handlePlaceSelect = (place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      // Extract postcode from address_components
      let postcode = '';
      if (place.address_components) {
        const postcodeComponent = place.address_components.find(
          comp => comp.types.includes('postal_code')
        );
        postcode = postcodeComponent?.long_name || '';
      }

      // Validate region using hybrid check:
      // 1. If postcode found -> use postcode validation
      // 2. If no postcode (landmarks) -> fall back to coordinate check
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

  // Redirect if not authenticated (same as before)
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
      // Validate required fields
      if (locationMode === 'venue' && !formData.venue_id) {
        throw new Error('Please select a venue');
      }
      if (locationMode === 'custom') {
        if (!formData.location_name) {
          throw new Error('Please enter a location name');
        }
        // Geofencing: block locations outside the Scottish Highlands
        if (!isLocationValid) {
          throw new Error('Events must be located within the Scottish Highlands.');
        }
      }
      if (!formData.category_id) throw new Error('Please select a category');
      if (new Date(formData.date_end) <= new Date(formData.date_start)) throw new Error('End date must be after start date');

      // Calculate dates based on mode
      let calculatedDateStart = formData.date_start;
      let calculatedDateEnd = formData.date_end;
      let showtimesPayload: ShowtimeCreate[] | undefined = undefined;

      if (isMultiSession && showtimes.length > 0) {
        // Multi-session: calculate from showtimes
        const startTimes = showtimes.map(st => new Date(st.start_time).getTime());
        const endTimes = showtimes.map(st => st.end_time ? new Date(st.end_time).getTime() : new Date(st.start_time).getTime());
        calculatedDateStart = new Date(Math.min(...startTimes)).toISOString();
        calculatedDateEnd = new Date(Math.max(...endTimes)).toISOString();
        showtimesPayload = showtimes;
      } else if (isMultiSession && showtimes.length === 0) {
        throw new Error('Please add at least one showtime');
      } else {
        // Single session: use form dates, clear any stale showtimes
        showtimesPayload = undefined; // Public API might expect explicit [] or undefined, sticking to undefined if not used
        calculatedDateStart = new Date(formData.date_start).toISOString();
        calculatedDateEnd = new Date(formData.date_end).toISOString();
      }

      const eventData = {
        title: formData.title,
        description: formData.description || undefined,
        category_id: formData.category_id,
        venue_id: locationMode === 'venue' ? formData.venue_id : undefined,
        location_name: locationMode === 'custom' ? formData.location_name : undefined,
        latitude: locationMode === 'custom' ? formData.latitude : undefined,
        longitude: locationMode === 'custom' ? formData.longitude : undefined,
        date_start: calculatedDateStart,
        date_end: calculatedDateEnd,
        price: parseFloat(formData.price),
        image_url: formData.image_url || undefined,
        ticket_url: formData.ticket_url || undefined,
        age_restriction: formData.age_restriction || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        organizer_profile_id: formData.organizer_profile_id || undefined,
        is_recurring: formData.is_recurring,
        frequency: formData.is_recurring ? formData.frequency : undefined,
        recurrence_end_date: (formData.is_recurring && formData.ends_on === 'date') ? new Date(formData.recurrence_end_date).toISOString() : undefined,
        participating_venue_ids: participatingVenues.length > 0 ? participatingVenues.map(v => v.id) : undefined,
        showtimes: showtimesPayload,
      };

      const newEvent = await api.events.create(eventData);

      // Scroll to top so user sees success message
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (newEvent.status === 'published') {
        setSuccessMessage({ type: 'published', eventId: newEvent.id });
        setTimeout(() => router.push(`/events/${newEvent.id}`), 2000);
      } else {
        setSuccessMessage({ type: 'pending', eventId: newEvent.id });
        setTimeout(() => router.push('/events'), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit event.');
      // Also scroll to top on error so user sees the error message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit an Event</h1>
          <p className="text-gray-600">Share your event with the Highland Events Hub community</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Messages (Success/Error) - Same as before */}
            {successMessage?.type === 'published' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-emerald-800 font-medium">Event published! Redirecting...</p>
              </div>
            )}
            {successMessage?.type === 'pending' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 font-medium">Event submitted for review.</p>
              </div>
            )}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <ImageUpload folder="events" currentImageUrl={formData.image_url} onUpload={handleImageUpload} onRemove={handleImageRemove} />

            {organizers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Post as Organizer</label>
                <select name="organizer_profile_id" value={formData.organizer_profile_id} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Myself ({user?.email})</option>
                  {organizers.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Title *</label>
              <Input name="title" required value={formData.title} onChange={handleChange} placeholder="e.g. Festival" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea name="description" rows={4} value={formData.description} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
              <select name="category_id" required value={formData.category_id} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select a category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <TagInput selectedTags={selectedTags} onChange={setSelectedTags} maxTags={5} />

            {/* LOCATION PICKER */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
              <label className="block text-sm font-medium text-gray-900">Event Location *</label>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  type="button"
                  onClick={() => setLocationMode('venue')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${locationMode === 'venue' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  📍 At a Venue
                </button>
                <button
                  type="button"
                  onClick={() => setLocationMode('custom')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${locationMode === 'custom' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  🗺️ Custom Location
                </button>
              </div>

              {locationMode === 'venue' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Search for a venue</label>
                  <VenueTypeahead value={formData.venue_id} onChange={handleVenueChange} placeholder="e.g. The Ironworks" />
                  <p className="mt-1 text-xs text-gray-500">
                    <Link href="/venues" className="text-emerald-600 hover:underline">Can't find it? Add a new venue.</Link>
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Location Name *</label>
                    <GooglePlacesAutocomplete
                      placeholder="e.g. Belladrum Estate, High Street, etc."
                      defaultValue={formData.location_name}
                      onPlaceSelect={handlePlaceSelect}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Pin Location</label>
                    <LocationPickerMap
                      latitude={formData.latitude}
                      longitude={formData.longitude}
                      onLocationChange={handleLocationChange}
                    />
                  </div>

                  {/* Geofencing Warning */}
                  {!isLocationValid && formData.location_name && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-red-800">Location outside the Scottish Highlands</p>
                        <p className="text-xs text-red-600 mt-1">Events must be located within the Scottish Highlands (IV, HS, KW, ZE, or qualifying PH/PA/AB/KA postcodes).</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PARTICIPATING VENUES */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">Participating Venues (Optional)</label>
              <p className="text-xs text-gray-500 mb-3">For pub crawls, festivals, or multi-venue events.</p>
              <MultiVenueSelector
                selectedVenues={participatingVenues}
                onChange={setParticipatingVenues}
              />
            </div>

            {/* Event Type Toggle */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-900 mb-3">
                Event Type
              </label>
              <div className="flex gap-4">
                <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${!isMultiSession ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input
                    type="radio"
                    name="eventType"
                    checked={!isMultiSession}
                    onChange={() => {
                      setIsMultiSession(false);
                      setShowtimes([]);
                    }}
                    className="text-emerald-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Single Event</span>
                    <p className="text-xs text-gray-500">One start and end time</p>
                  </div>
                </label>
                <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${isMultiSession ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input
                    type="radio"
                    name="eventType"
                    checked={isMultiSession}
                    onChange={() => {
                      // Push current dates to first showtime when switching
                      if (formData.date_start) {
                        setShowtimes([{
                          start_time: new Date(formData.date_start).toISOString(),
                          end_time: formData.date_end ? new Date(formData.date_end).toISOString() : undefined,
                        }]);
                      }
                      setIsMultiSession(true);
                    }}
                    className="text-emerald-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Multiple Showings</span>
                    <p className="text-xs text-gray-500">Theatre, cinema-style</p>
                  </div>
                </label>
              </div>

              {/* Single Event Date Inputs */}
              {!isMultiSession && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                    <DateTimePicker id="date_start" name="date_start" required value={formData.date_start} onChange={(val) => setFormData({ ...formData, date_start: val })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                    <DateTimePicker id="date_end" name="date_end" required value={formData.date_end} onChange={(val) => setFormData({ ...formData, date_end: val })} min={formData.date_start} />
                  </div>
                </div>
              )}

              {/* Multiple Showtimes Manager */}
              {isMultiSession && (
                <div className="mt-4 space-y-3 bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">
                    Add performance times. The event's main dates will be calculated automatically.
                  </p>

                  {showtimes.map((st, index) => {
                    const startValue = st.start_time ? new Date(st.start_time).toISOString().slice(0, 16) : '';
                    const endValue = st.end_time ? new Date(st.end_time).toISOString().slice(0, 16) : '';

                    return (
                      <div key={index} className="flex items-start gap-2 bg-white p-3 rounded border">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Start *</label>
                              <DateTimePicker
                                id={`showtime_start_${index}`}
                                name={`showtime_start_${index}`}
                                value={startValue}
                                onChange={(value) => {
                                  const updated = [...showtimes];
                                  updated[index] = { ...updated[index], start_time: new Date(value).toISOString() };
                                  setShowtimes(updated);
                                }}
                                required
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">End *</label>
                              <DateTimePicker
                                id={`showtime_end_${index}`}
                                name={`showtime_end_${index}`}
                                value={endValue}
                                onChange={(value) => {
                                  const updated = [...showtimes];
                                  updated[index] = { ...updated[index], end_time: new Date(value).toISOString() };
                                  setShowtimes(updated);
                                }}
                                min={startValue}
                                required
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Ticket URL (optional)</label>
                              <input
                                type="url"
                                value={st.ticket_url || ''}
                                onChange={(e) => {
                                  const updated = [...showtimes];
                                  updated[index] = { ...updated[index], ticket_url: e.target.value || undefined };
                                  setShowtimes(updated);
                                }}
                                className="w-full px-2 py-1 text-sm border rounded"
                                placeholder="https://..."
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
                              <input
                                type="text"
                                maxLength={255}
                                value={st.notes || ''}
                                onChange={(e) => {
                                  const updated = [...showtimes];
                                  updated[index] = { ...updated[index], notes: e.target.value || undefined };
                                  setShowtimes(updated);
                                }}
                                className="w-full px-2 py-1 text-sm border rounded"
                                placeholder="e.g. Phone only, Sold Out"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowtimes(showtimes.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setShowtimes([...showtimes, {
                        start_time: now.toISOString(),
                        end_time: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
                      }]);
                    }}
                    className="w-full py-2 border-2 border-dashed border-emerald-300 text-emerald-600 rounded-lg hover:bg-emerald-50 text-sm font-medium"
                  >
                    + Add Another Performance
                  </button>
                </div>
              )}
            </div>

            {/* Recurring Event Logic (Simplified for brevity but functional) */}
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="is_recurring" checked={formData.is_recurring} onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })} className="rounded text-emerald-600" />
              <label htmlFor="is_recurring" className="text-sm">This is a recurring event</label>
            </div>

            {formData.is_recurring && (
              <div className="pl-6 border-l-2 border-emerald-100 space-y-4">
                <select name="frequency" value={formData.frequency} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Bi-Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
                {/* Ends On Logic */}
                <div className="space-y-2">
                  <label className="flex items-center"><input type="radio" value="never" checked={formData.ends_on === 'never'} onChange={() => setFormData({ ...formData, ends_on: 'never' })} className="mr-2" /> Never</label>
                  <label className="flex items-center"><input type="radio" value="date" checked={formData.ends_on === 'date'} onChange={() => setFormData({ ...formData, ends_on: 'date' })} className="mr-2" /> On Date</label>
                  {formData.ends_on === 'date' && <Input type="date" name="recurrence_end_date" value={formData.recurrence_end_date} onChange={handleChange} />}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price (GBP) *</label>
              <Input name="price" type="number" step="0.01" value={formData.price} onChange={handleChange} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ticket URL</label>
              <Input name="ticket_url" type="url" value={formData.ticket_url} onChange={handleChange} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Age Restriction</label>
              <select name="age_restriction" value={formData.age_restriction} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg">
                {AGE_RESTRICTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-200">
              <Link href="/events" className="text-gray-600 hover:text-emerald-600">Cancel</Link>
              <Button type="submit" variant="primary" size="lg" disabled={isLoading}>{isLoading ? 'Submitting...' : 'Submit Event'}</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
