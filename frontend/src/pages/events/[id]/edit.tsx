import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api, apiFetch } from '@/lib/api';
import { Category, Organizer, VenueResponse } from '@/types';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import ImageUpload from '@/components/common/ImageUpload';
import VenueTypeahead from '@/components/venues/VenueTypeahead';
import TagInput from '@/components/tags/TagInput';
import { AGE_RESTRICTION_OPTIONS } from '@/lib/ageRestriction';

export default function EditEventPage() {
    const router = useRouter();
    const { id } = router.query;
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category_id: '',
        venue_id: '',
        location_name: '',
        date_start: '',
        date_end: '',
        price: '',
        image_url: '',
        ticket_url: '',
        age_restriction: '',
        organizer_profile_id: '',
        is_recurring: false,
        frequency: 'WEEKLY',
        ends_on: 'never', // 'never' | 'date'
        recurrence_end_date: '',
    });

    const [categories, setCategories] = useState<Category[]>([]);
    const [organizers, setOrganizers] = useState<Organizer[]>([]);
    const [selectedVenue, setSelectedVenue] = useState<VenueResponse | null>(null);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [useManualLocation, setUseManualLocation] = useState(false);

    // Fetch initial data
    useEffect(() => {
        if (!isAuthenticated && !authLoading) {
            router.push(`/auth/login?redirect=/events/${id}/edit`);
            return;
        }

        if (!id) return;

        const fetchData = async () => {
            try {
                const [categoriesData, eventData] = await Promise.all([
                    api.categories.list(),
                    api.events.get(id as string),
                ]);

                setCategories(categoriesData.categories);

                // Fetch user's organizer profiles
                if (user?.id) {
                    try {
                        const orgResponse = await apiFetch<any>(`/api/organizers?user_id=${user.id}`);
                        setOrganizers(orgResponse.organizers || []);
                    } catch (err) {
                        console.error('Error fetching organizers:', err);
                    }
                }

                // Populate form
                setFormData({
                    title: eventData.title,
                    description: eventData.description || '',
                    category_id: eventData.category?.id || '',
                    venue_id: eventData.venue_id || '',
                    location_name: eventData.location_name || '',
                    date_start: new Date(eventData.date_start).toISOString().slice(0, 16),
                    date_end: new Date(eventData.date_end).toISOString().slice(0, 16),
                    price: eventData.price.toString(),
                    image_url: eventData.image_url || '',
                    ticket_url: eventData.ticket_url || '',
                    age_restriction: eventData.age_restriction || '',
                    organizer_profile_id: eventData.organizer_profile_id || '',
                    is_recurring: eventData.is_recurring || false,
                    frequency: 'WEEKLY',
                    ends_on: 'never',
                    recurrence_end_date: '',
                });

                if (eventData.location_name && !eventData.venue_id) {
                    setUseManualLocation(true);
                }

                if (eventData.tags) {
                    setSelectedTags(eventData.tags.map((t: any) => t.id));
                }

            } catch (err) {
                console.error('Failed to load data:', err);
                setError('Failed to load event data');
            } finally {
                setIsLoading(false);
            }
        };

        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated, authLoading, id, user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (error) setError(null);
    };

    const handleVenueChange = (venueId: string, venue: VenueResponse | null) => {
        setFormData((prev) => ({
            ...prev,
            venue_id: venueId,
            location_name: venue?.name || '',
        }));
        setSelectedVenue(venue);
    };

    const handleImageUpload = (urls: { url: string; thumbnail_url: string; medium_url: string }) => {
        setFormData((prev) => ({ ...prev, image_url: urls.url }));
    };

    const handleImageRemove = () => {
        setFormData((prev) => ({ ...prev, image_url: '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Validate
            if (!useManualLocation && !formData.venue_id) {
                throw new Error('Please select a venue');
            }
            if (useManualLocation && !formData.location_name) {
                throw new Error('Please enter a location name');
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
            };

            await api.events.update(id as string, eventData);

            // Redirect to the event page
            router.push(`/events/${id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update event. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 py-12">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <Spinner size="lg" />
                    <p className="text-gray-600 mt-4">Loading event...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Event</h1>
                    <p className="text-gray-600">
                        Update your event details below
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
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
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
                                disabled={isLoading}
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
                            <div>
                                <label htmlFor="date_start" className="block text-sm font-medium text-gray-700 mb-2">
                                    Start Date & Time *
                                </label>
                                <Input
                                    id="date_start"
                                    name="date_start"
                                    type="datetime-local"
                                    required
                                    value={formData.date_start}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                />
                            </div>
                            <div>
                                <label htmlFor="date_end" className="block text-sm font-medium text-gray-700 mb-2">
                                    End Date & Time *
                                </label>
                                <Input
                                    id="date_end"
                                    name="date_end"
                                    type="datetime-local"
                                    required
                                    value={formData.date_end}
                                    onChange={handleChange}
                                    min={formData.date_start}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

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
                            <p className="mt-1 text-sm text-gray-500">Link where people can purchase tickets</p>
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

                        {/* Stop Recurring Series */}
                        {formData.is_recurring && (
                            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                                <h3 className="text-sm font-medium text-purple-800 mb-2">Recurring Event</h3>
                                <p className="text-sm text-purple-600 mb-3">
                                    This event is part of a recurring series. Changes will only affect this instance.
                                </p>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (confirm('Are you sure you want to stop this recurring series? All future instances will be deleted.')) {
                                            try {
                                                await api.events.stopRecurrence(id as string);
                                                alert('Recurring series stopped. Future instances have been removed.');
                                                router.push('/account');
                                            } catch (err) {
                                                alert('Failed to stop series. Please try again.');
                                            }
                                        }
                                    }}
                                    className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                    Stop Recurring Series
                                </button>
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                            <Link
                                href={`/events/${id}`}
                                className="text-sm text-gray-600 hover:text-emerald-600"
                            >
                                &larr; Cancel
                            </Link>
                            <Button type="submit" variant="primary" size="lg" disabled={isLoading}>
                                {isLoading ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}
