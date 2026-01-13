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
import DateTimePicker from '@/components/common/DateTimePicker';
import VenueTypeahead from '@/components/venues/VenueTypeahead';
import TagInput from '@/components/tags/TagInput';
import MultiVenueSelector from '@/components/venues/MultiVenueSelector';
import RichTextEditor from '@/components/common/RichTextEditor';
import { AGE_RESTRICTION_OPTIONS } from '@/lib/ageRestriction';
import LocationPickerMap from '@/components/maps/LocationPickerMap';
import GooglePlacesAutocomplete from '@/components/common/GooglePlacesAutocomplete';
import { isHIERegion, isPointInHighlands } from '@/utils/validation/hie-check';
import { ShowtimeCreate } from '@/types';

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
        latitude: 57.4778,  // Default to Inverness
        longitude: -4.2247,
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
        weekdays: [] as number[],  // 0=Mon, 1=Tue, ... 6=Sun
    });

    const [categories, setCategories] = useState<Category[]>([]);
    const [organizers, setOrganizers] = useState<Organizer[]>([]);
    const [selectedVenue, setSelectedVenue] = useState<VenueResponse | null>(null);
    const [participatingVenues, setParticipatingVenues] = useState<VenueResponse[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // New State for Advanced Form Features
    const [locationTab, setLocationTab] = useState<'main' | 'multi'>('main');
    const [locationMode, setLocationMode] = useState<'venue' | 'custom'>('venue');
    const [showtimes, setShowtimes] = useState<ShowtimeCreate[]>([]);
    const [isMultiSession, setIsMultiSession] = useState(false);
    const [noEndTime, setNoEndTime] = useState(false);
    const [isLocationValid, setIsLocationValid] = useState(true);
    const [originalIsRecurring, setOriginalIsRecurring] = useState(false);  // Track if event was originally recurring

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
                    latitude: eventData.latitude || 57.4778,
                    longitude: eventData.longitude || -4.2247,
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
                    weekdays: [],  // Existing events don't have weekdays stored, default to empty
                });

                // Track original recurring status for UI logic
                setOriginalIsRecurring(eventData.is_recurring || false);

                // Hydrate participating venues
                if (eventData.participating_venues && eventData.participating_venues.length > 0) {
                    setParticipatingVenues(eventData.participating_venues);
                    setLocationTab('multi');
                } else if (eventData.location_name && !eventData.venue_id) {
                    // Manual location
                    setLocationMode('custom');
                    setLocationTab('main');
                } else {
                    // Venue location (default)
                    setLocationMode('venue');
                    setLocationTab('main');
                }

                // Showtimes / Multi-Session
                if (eventData.showtimes && eventData.showtimes.length > 0) {
                    setShowtimes(eventData.showtimes);
                    setIsMultiSession(true);
                } else {
                    setIsMultiSession(false);
                }

                if (eventData.tags) {
                    setSelectedTags(eventData.tags.map((t: any) => t.name));
                }

                // Permission check: only organizer or admin can edit

                if (eventData.tags) {
                    setSelectedTags(eventData.tags.map((t: any) => t.name));
                }

                // Permission check: only organizer or admin can edit
                if (user && eventData.organizer_id !== user.id && !user.is_admin) {
                    router.push('/403');
                    return;
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
    }, [isAuthenticated, authLoading, id, user, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (error) setError(null);
    };

    const handleVenueChange = (venueId: string, venue: VenueResponse | null) => {
        setFormData(prev => ({
            ...prev,
            venue_id: venueId,
        }));
        setSelectedVenue(venue);
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

            // Validate region
            const isValid = postcode
                ? isHIERegion(postcode)
                : isPointInHighlands(lat, lng);
            setIsLocationValid(isValid);

            setFormData(prev => ({
                ...prev,
                location_name: place.name || place.formatted_address || '',
                latitude: lat,
                longitude: lng,
            }));
        }
    };

    const handleLocationChange = (lat: number, lng: number) => {
        setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
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
            // Validate required fields based on location tab
            if (locationTab === 'main') {
                if (locationMode === 'venue' && !formData.venue_id) {
                    throw new Error('Please select a venue');
                }
                if (locationMode === 'custom') {
                    if (!formData.location_name) {
                        throw new Error('Please enter a location name');
                    }
                    if (!isLocationValid) {
                        throw new Error('Events must be located within the Scottish Highlands.');
                    }
                }
            } else {
                // Multi-venue tab
                if (participatingVenues.length === 0) {
                    throw new Error('Please add at least one participating venue');
                }
            }

            if (!formData.category_id) throw new Error('Please select a category');

            // Date Validation
            if (new Date(formData.date_end) <= new Date(formData.date_start) && !noEndTime) {
                throw new Error('End date must be after start date');
            }

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
                // Single session: use form dates
                showtimesPayload = undefined;
                calculatedDateStart = new Date(formData.date_start).toISOString();

                // If no specific end time, calculate as start + 4 hours
                if (noEndTime) {
                    const startDate = new Date(formData.date_start);
                    calculatedDateEnd = new Date(startDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
                } else {
                    calculatedDateEnd = new Date(formData.date_end).toISOString();
                }
            }

            // Build payload
            const eventData = {
                title: formData.title,
                description: formData.description || undefined,
                category_id: formData.category_id,
                venue_id: locationTab === 'main' && locationMode === 'venue' ? formData.venue_id : null,
                location_name: locationTab === 'main' && locationMode === 'custom' ? formData.location_name : null,
                latitude: locationTab === 'main' && locationMode === 'custom' ? formData.latitude : null,
                longitude: locationTab === 'main' && locationMode === 'custom' ? formData.longitude : null,
                date_start: calculatedDateStart,
                date_end: calculatedDateEnd,
                price: formData.price,
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
                            <RichTextEditor
                                value={formData.description}
                                onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                                placeholder="Describe your event..."
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
                        {/* LOCATION SECTION - Tab Split */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                            <label className="block text-sm font-medium text-gray-900">Event Location *</label>

                            {/* Main Tabs: Main Location vs Multi-Venue */}
                            <div className="flex border-b border-gray-200 mb-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLocationTab('main');
                                        setParticipatingVenues([]);
                                    }}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${locationTab === 'main'
                                        ? 'border-emerald-600 text-emerald-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    📍 Main Location
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLocationTab('multi');
                                        setFormData(prev => ({ ...prev, venue_id: '', location_name: '' }));
                                        setSelectedVenue(null);
                                    }}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${locationTab === 'multi'
                                        ? 'border-emerald-600 text-emerald-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    🎪 Multi-Venue Event
                                </button>
                            </div>

                            {/* Tab Content */}
                            {locationTab === 'main' ? (
                                <div className="space-y-4">
                                    {/* Sub-tabs: Venue vs Custom */}
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setLocationMode('venue')}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${locationMode === 'venue'
                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                                }`}
                                        >
                                            Select Venue
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLocationMode('custom')}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${locationMode === 'custom'
                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                                }`}
                                        >
                                            Custom Location
                                        </button>
                                    </div>

                                    {locationMode === 'venue' ? (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Search for a venue</label>
                                            <VenueTypeahead
                                                value={formData.venue_id}
                                                onChange={handleVenueChange}
                                                placeholder="e.g. The Ironworks"
                                            />
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
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-600">
                                        For festivals, pub crawls, or multi-venue events. Add all participating venues below.
                                    </p>
                                    <MultiVenueSelector
                                        selectedVenues={participatingVenues}
                                        onChange={setParticipatingVenues}
                                        disabled={isLoading}
                                    />
                                    {participatingVenues.length === 0 && (
                                        <p className="text-xs text-amber-600">Please add at least one participating venue.</p>
                                    )}
                                </div>
                            )}
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
                                <div className="mt-4 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                                            <DateTimePicker
                                                id="date_start"
                                                name="date_start"
                                                required
                                                value={formData.date_start}
                                                onChange={(val) => {
                                                    // Smart Date Sync: Update end date when start date changes
                                                    const oldStartDate = formData.date_start ? formData.date_start.split('T')[0] : '';
                                                    const newStartDate = val.split('T')[0];
                                                    const currentEndDate = formData.date_end ? formData.date_end.split('T')[0] : '';

                                                    // Sync end date if: empty, matches old start, or is before new start
                                                    if (!formData.date_end || currentEndDate === oldStartDate || currentEndDate < newStartDate) {
                                                        // Keep the time from end date if it exists, otherwise use start time + 2 hours
                                                        const endTime = formData.date_end ? formData.date_end.split('T')[1] : val.split('T')[1];
                                                        setFormData({
                                                            ...formData,
                                                            date_start: val,
                                                            date_end: `${newStartDate}T${endTime || '18:00'}`
                                                        });
                                                    } else {
                                                        setFormData({ ...formData, date_start: val });
                                                    }
                                                }}
                                                disabled={isLoading}
                                            />
                                        </div>
                                        {!noEndTime && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                                                <DateTimePicker
                                                    id="date_end"
                                                    name="date_end"
                                                    required
                                                    value={formData.date_end}
                                                    onChange={(val) => setFormData({ ...formData, date_end: val })}
                                                    min={formData.date_start}
                                                    disabled={isLoading}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={noEndTime}
                                            onChange={(e) => setNoEndTime(e.target.checked)}
                                            className="rounded text-emerald-600 focus:ring-emerald-500"
                                            disabled={isLoading}
                                        />
                                        <span className="text-sm text-gray-600">No specific end time</span>
                                    </label>
                                    {noEndTime && (
                                        <p className="text-xs text-gray-500">End time will be set to 4 hours after start time.</p>
                                    )}
                                </div>
                            )}

                            {/* Multiple Showtimes Manager */}
                            {isMultiSession && (
                                <div className="mt-4 space-y-3 bg-gray-50 p-4 rounded-lg">
                                    <p className="text-sm text-gray-500">
                                        Add performance times. The event's main dates will be calculated automatically.
                                    </p>

                                    {showtimes.map((st: ShowtimeCreate, index: number) => {
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
                                                                disabled={isLoading}
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
                                                                disabled={isLoading}
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
                                                                disabled={isLoading}
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
                                                                disabled={isLoading}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowtimes(showtimes.filter((_, i) => i !== index))}
                                                    className="text-red-500 hover:text-red-700 p-1"
                                                    title="Remove"
                                                    disabled={isLoading}
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
                                        disabled={isLoading}
                                    >
                                        + Add Another Performance
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Price */}
                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                                Price
                            </label>
                            <Input
                                id="price"
                                name="price"
                                type="text"
                                value={formData.price}
                                onChange={handleChange}
                                placeholder="e.g., Free, £5, £5-£10"
                                disabled={isLoading}
                            />
                            <p className="mt-1 text-sm text-gray-500">Enter "Free" for free events or any price format.</p>
                        </div>

                        {/* Ticket URL */}
                        <div>
                            <label htmlFor="ticket_url" className="block text-sm font-medium text-gray-700 mb-2">
                                Ticket Link (Skiddle, Eventbrite, etc.)
                            </label>
                            <Input
                                id="ticket_url"
                                name="ticket_url"
                                type="url"
                                value={formData.ticket_url}
                                onChange={handleChange}
                                placeholder="https://www.skiddle.com/your-event or https://www.eventbrite.com/..."
                                disabled={isLoading}
                            />
                            <p className="mt-1 text-sm text-gray-500">Paste a link where attendees can buy tickets</p>
                        </div>

                        {/* Age Restriction */}
                        <div>
                            <label htmlFor="age_restriction" className="block text-sm font-medium text-gray-700 mb-2">
                                Minimum Age
                            </label>
                            <Input
                                id="age_restriction"
                                name="age_restriction"
                                type="number"
                                min="0"
                                value={formData.age_restriction}
                                onChange={handleChange}
                                placeholder="0 = All Ages"
                                disabled={isLoading}
                            />
                            <p className="mt-1 text-sm text-gray-500">Enter 0 for All Ages, or minimum age required.</p>
                        </div>

                        {/* Recurring Event Options */}
                        {!formData.is_recurring && (
                            <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="is_recurring"
                                        checked={formData.is_recurring}
                                        onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                                        className="rounded text-emerald-600"
                                    />
                                    <label htmlFor="is_recurring" className="text-sm">Make this a recurring event</label>
                                </div>
                            </div>
                        )}

                        {formData.is_recurring && !originalIsRecurring && (
                            <div className="pl-6 border-l-2 border-emerald-100 space-y-4">
                                <select
                                    name="frequency"
                                    value={formData.frequency}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="BIWEEKLY">Bi-Weekly</option>
                                    <option value="MONTHLY">Monthly</option>
                                </select>

                                {/* Weekday Selector */}
                                {(formData.frequency === 'WEEKLY' || formData.frequency === 'BIWEEKLY') && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Repeat on these days:</label>
                                        <div className="flex gap-2">
                                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        const newWeekdays = formData.weekdays.includes(idx)
                                                            ? formData.weekdays.filter(d => d !== idx)
                                                            : [...formData.weekdays, idx];
                                                        setFormData({ ...formData, weekdays: newWeekdays });
                                                    }}
                                                    className={`w-10 h-10 rounded-full font-bold text-sm transition-colors ${formData.weekdays.includes(idx)
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Select one or more days</p>
                                    </div>
                                )}

                                {/* Ends On Logic */}
                                <div className="space-y-2">
                                    <label className="flex items-center">
                                        <input type="radio" value="never" checked={formData.ends_on === 'never'} onChange={() => setFormData({ ...formData, ends_on: 'never' })} className="mr-2" /> Never (90 days)
                                    </label>
                                    <label className="flex items-center">
                                        <input type="radio" value="date" checked={formData.ends_on === 'date'} onChange={() => setFormData({ ...formData, ends_on: 'date' })} className="mr-2" /> On Date
                                    </label>
                                    {formData.ends_on === 'date' && (
                                        <Input type="date" name="recurrence_end_date" value={formData.recurrence_end_date} onChange={handleChange} />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Stop Recurring Series - for existing recurring events */}
                        {formData.is_recurring && originalIsRecurring && (
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
