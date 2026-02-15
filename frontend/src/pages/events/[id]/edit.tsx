import { useState, useEffect, useRef } from 'react';
import { normalizeUrl } from '@/utils/url';
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
import { MapPinAdjuster } from '@/components/events/MapPinAdjuster';
import { isHIERegion, isPointInHighlands } from '@/utils/validation/hie-check';
import { ShowtimeCreate } from '@/types';
import EventScheduleSection from '@/components/events/form-sections/EventScheduleSection';
import { rrulestr } from 'rrule';

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
        website_url: '',
        is_all_day: false,
        age_restriction: '',
        organizer_profile_id: '',
        is_recurring: false,
        frequency: 'WEEKLY',
        recurrence_rule: '',
        ends_on: 'never', // 'never' | 'date'
        recurrence_end_date: '',
        weekdays: [] as number[],  // 0=Mon, 1=Tue, ... 6=Sun
        // Map Display Override
        map_display_lat: null as number | null,
        map_display_lng: null as number | null,
        map_display_label: '',
    });

    // Helper to format UTC ISO string to Local "YYYY-MM-DDTHH:mm" for input
    const formatDateForInput = (isoString: string | Date | undefined | null) => {
        if (!isoString) return '';

        let date: Date;
        if (typeof isoString === 'string') {
            // Remove 'Z' if present to force Local interpretation
            const localStr = isoString.endsWith('Z') ? isoString.slice(0, -1) : isoString;
            date = new Date(localStr);
        } else {
            date = isoString;
        }

        if (isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

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
    const [hasLoaded, setHasLoaded] = useState(false); // CRITICAL: Prevent re-fetching on user object changes

    // FIX: Use ref to ensure handleSubmit always has access to current formData
    const formDataRef = useRef(formData);
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    // Fetch initial data - ONLY ONCE when id is available
    useEffect(() => {
        if (!isAuthenticated && !authLoading) {
            router.push(`/login?redirect=/events/${id}/edit`);
            return;
        }

        if (!id || hasLoaded) return; // Don't re-fetch if already loaded

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

                // Helper to convert UTC string to Local ISO string "YYYY-MM-DDTHH:mm"
                // REMOVED (Using component-scoped helper)

                // Populate form
                setFormData({
                    title: eventData.title,
                    description: eventData.description || '',
                    category_id: eventData.category?.id || '',
                    venue_id: eventData.venue_id || '',
                    location_name: eventData.location_name || '',
                    latitude: eventData.latitude || 57.4778,
                    longitude: eventData.longitude || -4.2247,
                    date_start: formatDateForInput(eventData.date_start),
                    date_end: formatDateForInput(eventData.date_end),
                    price: eventData.price.toString(),
                    image_url: eventData.image_url || '',
                    ticket_url: eventData.ticket_url || '',
                    website_url: eventData.website_url || '',
                    is_all_day: eventData.is_all_day || false,
                    age_restriction: eventData.age_restriction || '',
                    organizer_profile_id: eventData.organizer_profile_id || '',
                    is_recurring: eventData.is_recurring || false,
                    frequency: 'WEEKLY',
                    recurrence_rule: eventData.recurrence_rule || '',
                    ends_on: 'never',
                    recurrence_end_date: '',
                    weekdays: [],  // Existing events don't have weekdays stored, default to empty

                    // Map Display
                    map_display_lat: eventData.map_display_lat ?? null,
                    map_display_lng: eventData.map_display_lng ?? null,
                    map_display_label: eventData.map_display_label || '',
                });

                // Track original recurring status for UI logic
                setOriginalIsRecurring(eventData.is_recurring || false);

                // Hydrate Recurrence from RRULE
                if (eventData.is_recurring && eventData.recurrence_rule) {
                    try {
                        // Use rrule library to parse strict properties
                        const rule = rrulestr(eventData.recurrence_rule);

                        // Extract basic properties for the form
                        // Note: complex rules might not map 1:1 to the simple UI, 
                        // but we do our best to map Frequency and Interval.
                        const freqMap = ['YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY', 'MINUTELY', 'SECONDLY'];
                        const freqName = freqMap[rule.options.freq] || 'CUSTOM'; // Default to custom if unknown

                        let determinedFreq = 'CUSTOM';

                        // Check for simple patterns
                        if (freqName === 'WEEKLY' && !rule.options.bysetpos) {
                            determinedFreq = rule.options.interval === 2 ? 'BIWEEKLY' : 'WEEKLY';
                        } else if (freqName === 'MONTHLY') {
                            // Simple Monthly = only freq=MONTHLY (and maybe interval=1, bymonthday)
                            // Complex Monthly = has bysetpos or specific byweekday not matching date logic
                            if (rule.options.bysetpos || (rule.options.byweekday && rule.options.byweekday.length > 0)) {
                                determinedFreq = 'CUSTOM';
                            } else {
                                determinedFreq = 'MONTHLY';
                            }
                        }

                        setFormData(prev => ({
                            ...prev,
                            // If it's a standard simple frequency, use it. Otherwise CUSTOM.
                            frequency: (determinedFreq === 'WEEKLY' || determinedFreq === 'MONTHLY' || determinedFreq === 'BIWEEKLY') ? determinedFreq : 'CUSTOM',
                            recurrence_rule: eventData.recurrence_rule || '',
                            is_recurring: true
                        }));

                        // If the rule has an UNTIL date, map it
                        if (rule.options.until) {
                            setFormData(prev => ({
                                ...prev,
                                ends_on: 'date',
                                recurrence_end_date: formatDateForInput(rule.options.until)
                            }));
                        } else {
                            setFormData(prev => ({
                                ...prev,
                                ends_on: 'never'
                            }));
                        }

                    } catch (e) {
                        console.error("Failed to parse RRULE for hydration:", e);
                        // Fallback to manual parsing or leave as is
                        setFormData(prev => ({ ...prev, is_recurring: true, frequency: 'CUSTOM', recurrence_rule: eventData.recurrence_rule || '' }));
                    }
                } else if (eventData.is_recurring) {
                    // Recurring but no rule? Default to weekly
                    setFormData(prev => ({ ...prev, is_recurring: true, frequency: 'WEEKLY' }));
                }

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

                // Showtimes / Multi-Session (Convert to Local Strings)
                if (eventData.showtimes && eventData.showtimes.length > 0) {
                    setShowtimes(eventData.showtimes.map((st: any) => ({
                        ...st,
                        start_time: formatDateForInput(st.start_time),
                        end_time: st.end_time ? formatDateForInput(st.end_time) : undefined
                    })));
                    setIsMultiSession(true);
                } else {
                    setIsMultiSession(false);
                }

                if (eventData.tags) {
                    setSelectedTags(eventData.tags.map((t: any) => t.name));
                }

                // Permission check: only organizer or admin can edit
                if (user && eventData.organizer_id !== user.id && !user.is_admin) {
                    router.push('/403');
                    return;
                }

                setHasLoaded(true); // Mark as loaded to prevent re-fetching

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
    }, [isAuthenticated, authLoading, id, hasLoaded]); // Removed user and router from deps, added hasLoaded guard

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

        // FIX: Use ref to get CURRENT formData (not stale closure)
        const currentFormData = formDataRef.current;



        try {
            // Validate required fields based on location tab
            if (locationTab === 'main') {
                if (locationMode === 'venue' && !currentFormData.venue_id) {
                    throw new Error('Please select a venue');
                }
                if (locationMode === 'custom') {
                    if (!currentFormData.location_name) {
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

            if (!currentFormData.category_id) throw new Error('Please select a category');

            // Date Validation
            if (new Date(currentFormData.date_end) <= new Date(currentFormData.date_start) && !noEndTime) {
                throw new Error('End date must be after start date');
            }

            // Calculate dates based on mode
            let calculatedDateStart = currentFormData.date_start;
            let calculatedDateEnd = currentFormData.date_end;
            let showtimesPayload: ShowtimeCreate[] | undefined = undefined;

            if (isMultiSession && showtimes.length > 0) {
                // Multi-session: calculate from showtimes (using Local Strings)
                const startTimes = showtimes.map(st => new Date(st.start_time).getTime());
                const endTimes = showtimes.map(st => st.end_time ? new Date(st.end_time).getTime() : new Date(st.start_time).getTime());
                // calculatedDateStart/End are expected to be UTC strings for the Payload
                // But wait, in the logic below, we ASSIGNE them to eventData.date_start/end directly.
                // So they MUST be UTC strings.
                // new Date(minString).toISOString() converts Local -> UTC. Correct.
                calculatedDateStart = startTimes.length > 0 ? (new Date(Math.min(...startTimes)).toISOString().slice(0, 19)) : ''; // Fallback, careful. Ideally use strings.
                // Actually, if showtimes are naive, Math.min works on timestamps? Yes.
                // But we want Naive output.
                // Simplest: use the strings.
                // Sort strings.
                const sortedStart = [...showtimes].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
                const sortedEnd = [...showtimes].sort((a, b) => (a.end_time || a.start_time || '').localeCompare(b.end_time || b.start_time || ''));

                calculatedDateStart = sortedStart[0]?.start_time ? (sortedStart[0].start_time.length === 16 ? sortedStart[0].start_time + ':00' : sortedStart[0].start_time) : '';
                const lastEnd = sortedEnd[sortedEnd.length - 1];
                const lastEndStr = lastEnd?.end_time || lastEnd?.start_time || '';
                calculatedDateEnd = lastEndStr.length === 16 ? lastEndStr + ':00' : lastEndStr;

                // CRITICAL: Map showtimes back to UTC
                showtimesPayload = showtimes.map(st => ({
                    ...st,
                    start_time: st.start_time ? (st.start_time.length === 16 ? st.start_time + ':00' : st.start_time) : '',
                    end_time: st.end_time ? (st.end_time.length === 16 ? st.end_time + ':00' : st.end_time) : undefined,
                    ticket_url: st.ticket_url || undefined, // Use undefined, not null
                    notes: st.notes || undefined // Use undefined, not null
                }));
            } else if (isMultiSession && showtimes.length === 0) {
                throw new Error('Please add at least one showtime');
            } else {
                // Single session: use form dates
                // CRITICAL FIX: Explicitly send empty array to clear any existing showtimes in backend
                showtimesPayload = [];
                calculatedDateStart = currentFormData.date_start.length === 16 ? currentFormData.date_start + ':00' : currentFormData.date_start;

                // If no specific end time, calculate as start + 4 hours
                if (noEndTime) {
                    const startDate = new Date(currentFormData.date_start); // Local
                    const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000);
                    // Format explicitly as Local + :00
                    const year = endDate.getFullYear();
                    const month = String(endDate.getMonth() + 1).padStart(2, '0');
                    const day = String(endDate.getDate()).padStart(2, '0');
                    const hours = String(endDate.getHours()).padStart(2, '0');
                    const minutes = String(endDate.getMinutes()).padStart(2, '0');
                    calculatedDateEnd = `${year}-${month}-${day}T${hours}:${minutes}:00`;
                } else {
                    calculatedDateEnd = currentFormData.date_end.length === 16 ? currentFormData.date_end + ':00' : currentFormData.date_end;
                }
            }

            // Build payload
            const eventData = {
                title: currentFormData.title,
                description: currentFormData.description || null,
                category_id: currentFormData.category_id,
                venue_id: locationTab === 'main' && locationMode === 'venue' ? currentFormData.venue_id : null,
                location_name: locationTab === 'main' && locationMode === 'custom' ? currentFormData.location_name : null,
                latitude: locationTab === 'main' && locationMode === 'custom' ? currentFormData.latitude : null,
                longitude: locationTab === 'main' && locationMode === 'custom' ? currentFormData.longitude : null,
                date_start: calculatedDateStart,
                date_end: calculatedDateEnd,
                price: currentFormData.price,
                image_url: currentFormData.image_url || null,
                ticket_url: currentFormData.ticket_url || null,
                website_url: currentFormData.website_url || null,
                is_all_day: currentFormData.is_all_day,
                age_restriction: currentFormData.age_restriction || null,
                tags: selectedTags.length > 0 ? selectedTags : [],
                organizer_profile_id: currentFormData.organizer_profile_id || null,
                is_recurring: currentFormData.is_recurring,
                frequency: currentFormData.is_recurring ? currentFormData.frequency : null,
                recurrence_rule: (currentFormData.is_recurring && currentFormData.frequency === 'CUSTOM') ? currentFormData.recurrence_rule : null,
                recurrence_end_date: (currentFormData.is_recurring && currentFormData.ends_on === 'date') ? new Date(currentFormData.recurrence_end_date).toISOString() : null,
                weekdays: (currentFormData.is_recurring && currentFormData.weekdays.length > 0) ? currentFormData.weekdays : [],
                participating_venue_ids: participatingVenues.length > 0 ? participatingVenues.map(v => v.id) : [],
                showtimes: showtimesPayload,
                // Map Display
                map_display_lat: currentFormData.map_display_lat,
                map_display_lng: currentFormData.map_display_lng,
                map_display_label: currentFormData.map_display_label || null,
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
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="max-w-3xl mb-8">
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

                                    {/* Map Pin Adjuster for Multi-Venue */}
                                    {participatingVenues.length > 0 && (
                                        <div className="mt-6 border-t pt-4">
                                            <MapPinAdjuster
                                                participatingVenues={participatingVenues}
                                                currentLat={formData.map_display_lat}
                                                currentLng={formData.map_display_lng}
                                                label={formData.map_display_label}
                                                onChange={(lat, lng) => setFormData(prev => ({ ...prev, map_display_lat: lat, map_display_lng: lng }))}
                                                onLabelChange={(label) => setFormData(prev => ({ ...prev, map_display_label: label }))}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Event Schedule Section (Replaces manual date fields) */}
                        <div className="border border-gray-200 rounded-lg p-1">
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
                                type="text"
                                value={formData.ticket_url}
                                onChange={handleChange}
                                onBlur={() => setFormData(prev => ({ ...prev, ticket_url: normalizeUrl(prev.ticket_url || '') }))}
                                placeholder="e.g., www.skiddle.com/your-event"
                                disabled={isLoading}
                            />
                            <p className="mt-1 text-sm text-gray-500">Paste a link where attendees can buy tickets. We'll add https:// automatically.</p>
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
