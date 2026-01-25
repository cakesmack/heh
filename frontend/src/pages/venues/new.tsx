/**
 * Create New Venue Page
 * Allows authenticated users to submit new venues
 * Matches the admin venue form for consistency
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import { venuesAPI } from '@/lib/api';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import ImageUpload from '@/components/common/ImageUpload';
import PlacesAutocomplete from '@/components/maps/PlacesAutocomplete';
import { isHIERegion } from '@/utils/validation/hie-check';

/**
 * Parse backend validation errors into human-readable messages
 */
function parseBackendError(error: any): string {
    // Handle Pydantic validation errors (array format)
    if (error?.detail && Array.isArray(error.detail)) {
        const messages = error.detail.map((err: any) => {
            const field = err.loc?.slice(-1)[0] || 'field';
            const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

            // Map common error types to friendly messages
            if (err.type === 'string_too_long') {
                return `${fieldName} is too long (max ${err.ctx?.max_length || 'limit'} characters)`;
            }
            if (err.type === 'string_too_short') {
                return `${fieldName} is too short (min ${err.ctx?.min_length || 'required'} characters)`;
            }
            if (err.type === 'missing') {
                return `${fieldName} is required`;
            }
            if (err.type === 'value_error') {
                return `${fieldName} has an invalid value`;
            }
            if (err.type === 'url_parsing') {
                return `${fieldName} must be a valid URL (e.g., https://example.com)`;
            }

            return err.msg || `Invalid ${fieldName}`;
        });
        return messages.join('. ');
    }

    // Handle string detail
    if (typeof error?.detail === 'string') {
        return error.detail;
    }

    // Handle message property
    if (error?.message) {
        return error.message;
    }

    // Fallback
    return 'Failed to create venue. Please check your input and try again.';
}

// Dynamic import for GoogleMiniMap to avoid SSR issues
const GoogleMiniMap = dynamic(() => import('@/components/maps/GoogleMiniMap'), { ssr: false });

interface VenueFormData {
    name: string;
    description: string;
    address: string;
    postcode: string;
    latitude: number;
    longitude: number;
    category_id: string;
    website: string;
    phone: string;
    image_url: string;
    // Amenities
    is_dog_friendly: boolean;
    has_wheelchair_access: boolean;
    has_parking: boolean;
    serves_food: boolean;
    amenities_notes: string;
}

export default function NewVenuePage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    const [formData, setFormData] = useState<VenueFormData>({
        name: '',
        description: '',
        address: '',
        postcode: '',
        latitude: 57.48,
        longitude: -4.22,
        category_id: '',
        website: '',
        phone: '',
        image_url: '',
        is_dog_friendly: false,
        has_wheelchair_access: false,
        has_parking: false,
        serves_food: false,
        amenities_notes: '',
    });
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isImageUploading, setIsImageUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isPostcodeValid, setIsPostcodeValid] = useState(true);

    // Ref to hold the latest image URL (avoids stale closure issues)
    const imageUrlRef = useRef<string>('');
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const [potentialDuplicates, setPotentialDuplicates] = useState<any[]>([]);
    const [isChecking, setIsChecking] = useState(false);

    // Duplicate Detection Logic
    useEffect(() => {
        const query = formData.name.trim();

        if (query.length < 3) {
            setPotentialDuplicates([]);
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);

        setIsChecking(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await venuesAPI.search(query, 3);
                // Filter out exact matches if strictly equal (optional, but keep them for clarity)
                setPotentialDuplicates(res.venues);
            } catch (err) {
                console.error("Duplicate check failed", err);
            } finally {
                setIsChecking(false);
            }
        }, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [formData.name]);

    const handleUseExisting = (venueId: string) => {
        if (confirm("Redirect to the existing venue page?")) {
            router.push(`/venues/${venueId}`);
        }
    };

    // Fetch venue categories
    useEffect(() => {
        venuesAPI.listCategories().then((cats) => {
            setCategories(cats);
            if (cats.length > 0 && !formData.category_id) {
                setFormData(prev => ({ ...prev, category_id: cats[0].id }));
            }
        }).catch(() => { });
    }, []);

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login?redirect=/venues/new');
        }
    }, [authLoading, isAuthenticated, router]);

    const handleImageUploadStart = () => {
        setIsImageUploading(true);
    };

    const handleImageUploadEnd = () => {
        setIsImageUploading(false);
    };

    const handleImageUpload = (urls: { url: string }) => {
        imageUrlRef.current = urls.url;
        setFormData(prev => ({ ...prev, image_url: urls.url }));
    };

    const handleImageRemove = () => {
        imageUrlRef.current = '';
        setFormData(prev => ({ ...prev, image_url: '' }));
    };

    const handlePlaceSelect = (place: {
        postcode: string;
        address: string;
        latitude: number;
        longitude: number;
        placeId: string;
    }) => {
        setFormData(prev => ({
            ...prev,
            postcode: place.postcode,
            address: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
        }));
        // Validate HIE region using postcode if available, otherwise check coordinates
        if (place.postcode) {
            setIsPostcodeValid(isHIERegion(place.postcode));
        } else {
            // If no postcode, assume valid (coordinates will be used)
            setIsPostcodeValid(true);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        if (!formData.name.trim()) {
            setError('Venue name is required');
            setIsSubmitting(false);
            return;
        }

        if (!formData.address.trim()) {
            setError('Address is required');
            setIsSubmitting(false);
            return;
        }

        if (!formData.category_id) {
            setError('Please select a venue category');
            setIsSubmitting(false);
            return;
        }

        if (formData.postcode && !isHIERegion(formData.postcode)) {
            setError('Venue must be located in the Highlands & Islands region');
            setIsPostcodeValid(false);
            setIsSubmitting(false);
            return;
        }

        try {
            // Use ref for image_url to avoid stale closure issues
            const finalImageUrl = imageUrlRef.current || formData.image_url;

            const newVenue = await venuesAPI.create({
                name: formData.name,
                description: formData.description || undefined,
                address: formData.address,
                postcode: formData.postcode || undefined,
                latitude: formData.latitude,
                longitude: formData.longitude,
                category_id: formData.category_id,
                website: formData.website || undefined,
                phone: formData.phone || undefined,
                image_url: finalImageUrl || undefined,
                is_dog_friendly: formData.is_dog_friendly,
                has_wheelchair_access: formData.has_wheelchair_access,
                has_parking: formData.has_parking,
                serves_food: formData.serves_food,
                amenities_notes: formData.amenities_notes || undefined,
            });

            setSuccess(true);
            setTimeout(() => {
                router.push(`/venues/${newVenue.id}`);
            }, 1500);
        } catch (err: any) {
            // Parse backend errors into human-readable messages
            const errorMessage = parseBackendError(err);
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <Link href="/venues" className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 inline-block">
                        ← Back to Venues
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Add New Venue</h1>
                    <p className="text-gray-600">
                        Submit a new venue to the Highland Events Hub directory
                    </p>
                </div>

                {success && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 text-emerald-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <p className="text-emerald-800 font-medium">Venue created successfully! Redirecting...</p>
                        </div>
                    </div>
                )}

                <Card>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        {/* Venue Image */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Venue Image
                            </label>
                            <ImageUpload
                                folder="venues"
                                currentImageUrl={formData.image_url}
                                onUpload={handleImageUpload}
                                onRemove={handleImageRemove}
                                onUploadStart={handleImageUploadStart}
                                onUploadEnd={handleImageUploadEnd}
                                aspectRatio="16/9"
                            />
                            {isImageUploading && (
                                <p className="text-sm text-amber-600 mt-1">
                                    Uploading image... Please wait before submitting.
                                </p>
                            )}
                        </div>

                        {/* Name */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                Venue Name *
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., The Highlander Pub"
                                disabled={isSubmitting}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />

                            {/* Duplicate Warning */}
                            {potentialDuplicates.length > 0 && (
                                <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <h4 className="font-medium text-amber-800">Possible duplicate found</h4>
                                    </div>
                                    <p className="text-sm text-amber-700 mb-3">
                                        We found venues with similar names. To avoid duplicates, please check if your venue already exists:
                                    </p>
                                    <div className="space-y-2">
                                        {potentialDuplicates.map(venue => (
                                            <div key={venue.id} className="flex items-center justify-between bg-white/60 p-2 rounded border border-amber-100">
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium text-amber-900 truncate">{venue.name}</p>
                                                    <p className="text-xs text-amber-700 truncate">{venue.address} {venue.postcode}</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="white"
                                                    onClick={() => handleUseExisting(venue.id)}
                                                    className="ml-3 shrink-0 text-xs border-amber-200 text-amber-700 hover:bg-white hover:text-emerald-700"
                                                >
                                                    Use This Venue
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Category */}
                        <div>
                            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-2">
                                Category *
                            </label>
                            <select
                                id="category_id"
                                name="category_id"
                                value={formData.category_id}
                                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                disabled={isSubmitting}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                required
                            >
                                <option value="">Select a category...</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Address Lookup - Google Places Autocomplete */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Find Address *
                            </label>
                            <PlacesAutocomplete
                                onSelect={handlePlaceSelect}
                                placeholder="Search for venue address..."
                                disabled={isSubmitting}
                            />
                            {formData.address && (
                                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-sm text-gray-700">
                                        <span className="font-medium">Selected:</span> {formData.address}
                                        {formData.postcode && `, ${formData.postcode}`}
                                    </p>
                                </div>
                            )}
                            {!isPostcodeValid && (
                                <p className="text-sm text-red-600 mt-2">
                                    Venue must be located in the Highlands & Islands region
                                </p>
                            )}
                        </div>

                        {/* Hidden fields - populated by PlacesAutocomplete */}
                        <input type="hidden" name="address" value={formData.address} />
                        <input type="hidden" name="postcode" value={formData.postcode} />
                        <input type="hidden" name="latitude" value={formData.latitude} />
                        <input type="hidden" name="longitude" value={formData.longitude} />

                        {/* Phone */}
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                                Phone
                            </label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="01234 567890"
                                disabled={isSubmitting}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>

                        {/* Map Preview */}
                        {formData.latitude && formData.longitude && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Location Preview
                                </label>
                                <GoogleMiniMap
                                    latitude={formData.latitude}
                                    longitude={formData.longitude}
                                    height="150px"
                                    zoom={13}
                                />
                            </div>
                        )}

                        {/* Website */}
                        <div>
                            <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
                                Website
                            </label>
                            <input
                                id="website"
                                name="website"
                                type="url"
                                value={formData.website}
                                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                placeholder="https://example.com"
                                disabled={isSubmitting}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                                rows={3}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Briefly describe this venue..."
                                disabled={isSubmitting}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>

                        {/* Amenities */}
                        <div className="pt-4 border-t">
                            <label className="block text-sm font-medium text-gray-700 mb-3">Amenities</label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_dog_friendly}
                                        onChange={(e) => setFormData({ ...formData, is_dog_friendly: e.target.checked })}
                                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Dog Friendly</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.has_wheelchair_access}
                                        onChange={(e) => setFormData({ ...formData, has_wheelchair_access: e.target.checked })}
                                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Wheelchair Access</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.has_parking}
                                        onChange={(e) => setFormData({ ...formData, has_parking: e.target.checked })}
                                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Parking Available</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.serves_food}
                                        onChange={(e) => setFormData({ ...formData, serves_food: e.target.checked })}
                                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Serves Food</span>
                                </label>
                            </div>
                            <div className="mt-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amenities Notes</label>
                                <textarea
                                    value={formData.amenities_notes}
                                    onChange={(e) => setFormData({ ...formData, amenities_notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    rows={2}
                                    placeholder="Additional details about accessibility, parking, etc."
                                />
                            </div>
                        </div>

                        {/* Submit Buttons */}
                        <div className="flex gap-4 pt-4 border-t">
                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                disabled={isSubmitting || success || !isPostcodeValid || isImageUploading}
                                className="flex-1"
                            >
                                {isImageUploading
                                    ? 'Uploading Image...'
                                    : isSubmitting
                                        ? 'Creating Venue...'
                                        : 'Create Venue'}
                            </Button>
                            <Link
                                href="/venues"
                                className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </Link>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}
