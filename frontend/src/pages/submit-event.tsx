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
import { VenueResponse, Category, Organizer } from '@/types';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import TagInput from '@/components/tags/TagInput';
import ImageUpload from '@/components/common/ImageUpload';
import VenueTypeahead from '@/components/venues/VenueTypeahead';
import DateTimePicker from '@/components/common/DateTimePicker';
import { AGE_RESTRICTION_OPTIONS } from '@/lib/ageRestriction';

export default function SubmitEventPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueResponse | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    venue_id: '',
    location_name: '',
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
    ends_on: 'never', // 'never' or 'date'
  });
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await api.categories.list();
        setCategories(data.categories || []);
        // Set default category if available
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
          // We need to add api.organizers.list to api.ts first, or use fetch directly.
          // Assuming api.organizers.list exists or we add it.
          // For now, let's use apiFetch directly if needed, or assume I'll add it.
          // I'll add it to api.ts in a separate step.
          // Let's just use the user object if it has profiles, or fetch.
          // Actually, let's fetch.
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
    setFormData(prev => ({ ...prev, venue_id: venueId }));
    setSelectedVenue(venue);
  };

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Sign In Required</h1>
          <p className="text-gray-600 mb-6">Please sign in to submit an event.</p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error when user starts typing
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
      if (!useManualLocation && !formData.venue_id) {
        throw new Error('Please select a venue');
      }
      if (useManualLocation && !formData.location_name) {
        throw new Error('Please enter a location name');
      }
      if (!formData.category_id) {
        throw new Error('Please select a category');
      }
      if (new Date(formData.date_end) <= new Date(formData.date_start)) {
        throw new Error('End date must be after start date');
      }

      // Convert form data to API format
      const eventData = {
        title: formData.title,
        description: formData.description || undefined,
        category_id: formData.category_id,
        venue_id: useManualLocation ? undefined : formData.venue_id,
        location_name: useManualLocation ? formData.location_name : undefined,
        date_start: new Date(formData.date_start).toISOString(),
        date_end: new Date(formData.date_end).toISOString(),
        price: parseFloat(formData.price),
        image_url: formData.image_url || undefined,
        ticket_url: formData.ticket_url || undefined,
        age_restriction: formData.age_restriction || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        organizer_profile_id: formData.organizer_profile_id || undefined,
        is_recurring: formData.is_recurring,
        frequency: formData.is_recurring ? formData.frequency : undefined,
        recurrence_end_date: (formData.is_recurring && formData.ends_on === 'date' && formData.recurrence_end_date)
          ? new Date(formData.recurrence_end_date).toISOString()
          : undefined,
      };

      const newEvent = await api.events.create(eventData);

      // Redirect to the new event page
      router.push(`/events/${newEvent.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit event. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit an Event</h1>
          <p className="text-gray-600">
            Share your event with the Highland Events Hub community
          </p>
        </div>

        {/* Form */}
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-red-600 mr-2 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Featured Image Upload */}
            <ImageUpload
              folder="events"
              currentImageUrl={formData.image_url}
              onUpload={handleImageUpload}
              onRemove={handleImageRemove}
            />

            {/* Organizer Profile (Optional) */}
            {organizers.length > 0 && (
              <div>
                <label htmlFor="organizer_profile_id" className="block text-sm font-medium text-gray-700 mb-2">
                  Post as Organizer (Optional)
                </label>
                <select
                  id="organizer_profile_id"
                  name="organizer_profile_id"
                  value={formData.organizer_profile_id}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Myself ({user?.email})</option>
                  {organizers.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Select an organizer profile to post this event under a group/brand name.
                </p>
              </div>
            )}

            {/* Event Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Event Title *
              </label>
              <Input
                id="title"
                name="title"
                type="text"
                required
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Highland Folk Festival"
                disabled={isLoading}
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your event..."
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                id="category_id"
                name="category_id"
                required
                value={formData.category_id}
                onChange={handleChange}
                disabled={isLoading || isLoadingCategories}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <TagInput
              selectedTags={selectedTags}
              onChange={setSelectedTags}
              maxTags={5}
            />

            {/* Venue or Location */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  {useManualLocation ? 'Location Name *' : 'Venue *'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setUseManualLocation(!useManualLocation);
                    setFormData(prev => ({ ...prev, venue_id: '', location_name: '' }));
                    setSelectedVenue(null);
                  }}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {useManualLocation ? 'Select existing venue' : 'Enter location manually'}
                </button>
              </div>

              {useManualLocation ? (
                <Input
                  id="location_name"
                  name="location_name"
                  type="text"
                  required
                  value={formData.location_name}
                  onChange={handleChange}
                  placeholder="e.g., Inverness Castle Grounds"
                  disabled={isLoading}
                />
              ) : (
                <>
                  <VenueTypeahead
                    value={formData.venue_id}
                    onChange={handleVenueChange}
                    placeholder="Search for a venue..."
                    disabled={isLoading}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    <Link href="/venues" className="text-emerald-600 hover:text-emerald-700">
                      Don't see your venue? Add it here →
                    </Link>
                  </p>
                </>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Start Date/Time */}
              <div>
                <label
                  htmlFor="date_start"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Start Date & Time *
                </label>
                <DateTimePicker
                  id="date_start"
                  name="date_start"
                  required
                  value={formData.date_start}
                  onChange={(value) => setFormData({ ...formData, date_start: value })}
                  disabled={isLoading}
                />
              </div>

              {/* End Date/Time */}
              <div>
                <label htmlFor="date_end" className="block text-sm font-medium text-gray-700 mb-2">
                  End Date & Time *
                </label>
                <DateTimePicker
                  id="date_end"
                  name="date_end"
                  required
                  value={formData.date_end}
                  onChange={(value) => setFormData({ ...formData, date_end: value })}
                  min={formData.date_start}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Recurring Event Toggle */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_recurring"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
              />
              <label htmlFor="is_recurring" className="text-sm font-medium text-gray-700">
                This is a recurring event
              </label>
            </div>

            {/* Recurrence Options (Set and Forget) */}
            {formData.is_recurring && (
              <div className="space-y-4 pl-6 border-l-2 border-emerald-100">
                {/* Frequency */}
                <div>
                  <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-2">
                    Frequency
                  </label>
                  <select
                    id="frequency"
                    name="frequency"
                    value={formData.frequency}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-Weekly (Every 2 weeks)</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>

                {/* Ends On */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ends On
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        id="ends_never"
                        name="ends_on"
                        type="radio"
                        value="never"
                        checked={formData.ends_on === 'never'}
                        onChange={(e) => setFormData({ ...formData, ends_on: 'never' })}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                      />
                      <label htmlFor="ends_never" className="ml-2 block text-sm text-gray-700">
                        Never (Repeat indefinitely)
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="ends_date"
                        name="ends_on"
                        type="radio"
                        value="date"
                        checked={formData.ends_on === 'date'}
                        onChange={(e) => setFormData({ ...formData, ends_on: 'date' })}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300"
                      />
                      <label htmlFor="ends_date" className="ml-2 block text-sm text-gray-700">
                        Specific Date
                      </label>
                    </div>
                  </div>
                </div>

                {/* End Date Picker */}
                {formData.ends_on === 'date' && (
                  <div>
                    <Input
                      id="recurrence_end_date"
                      name="recurrence_end_date"
                      type="date"
                      value={formData.recurrence_end_date}
                      onChange={handleChange}
                      min={formData.date_start.split('T')[0]}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Price */}
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                Price (GBP) *
              </label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.price}
                onChange={handleChange}
                placeholder="0.00"
                disabled={isLoading}
              />
              <p className="mt-1 text-sm text-gray-500">Enter 0 for free events</p>
            </div>

            {/* Ticket URL */}
            <div>
              <label htmlFor="ticket_url" className="block text-sm font-medium text-gray-700 mb-2">
                Ticket URL
              </label>
              <Input
                id="ticket_url"
                name="ticket_url"
                type="url"
                value={formData.ticket_url}
                onChange={handleChange}
                placeholder="https://example.com/tickets"
                disabled={isLoading}
              />
            </div>

            {/* Age Restriction */}
            <div>
              <label htmlFor="age_restriction" className="block text-sm font-medium text-gray-700 mb-2">
                Age Restriction
              </label>
              <select
                id="age_restriction"
                name="age_restriction"
                value={formData.age_restriction}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {AGE_RESTRICTION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <Link
                href="/events"
                className="text-sm text-gray-600 hover:text-emerald-600"
              >
                &larr; Cancel
              </Link>
              <Button type="submit" variant="primary" size="lg" disabled={isLoading}>
                {isLoading ? 'Submitting...' : 'Submit Event'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Event Submission Guidelines</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Events are reviewed before being published</li>
            <li>Ensure all information is accurate and up-to-date</li>
            <li>Free events help attract more attendees</li>
            <li>High-quality images improve event visibility</li>
            <li>Add relevant tags to help people discover your event</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
