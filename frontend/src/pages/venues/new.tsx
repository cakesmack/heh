/**
 * Create New Venue Page
 * Allows authenticated users to submit new venues
 * Matches the admin venue form for consistency
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import { venuesAPI } from '@/lib/api';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import ImageUpload from '@/components/common/ImageUpload';
import PostcodeLookup from '@/components/admin/PostcodeLookup';
import { isHIERegion } from '@/utils/validation/hie-check';

// Dynamic import for MiniMap to avoid SSR issues
const MiniMap = dynamic(() => import('@/components/maps/MiniMap'), { ssr: false });

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
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isPostcodeValid, setIsPostcodeValid] = useState(true);

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

    const handleImageUpload = (urls: { url: string }) => {
        setFormData(prev => ({ ...prev, image_url: urls.url }));
    };

    const handleImageRemove = () => {
        setFormData(prev => ({ ...prev, image_url: '' }));
    };

    const handlePostcodeLookup = (result: {
        postcode: string;
        address: string;
        latitude: number;
        longitude: number;
    }) => {
        setFormData(prev => ({
            ...prev,
            postcode: result.postcode,
            address: result.address,
            latitude: result.latitude,
            longitude: result.longitude,
        }));
        setIsPostcodeValid(isHIERegion(result.postcode));
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
                image_url: formData.image_url || undefined,
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
            setError(err.message || 'Failed to create venue. Please try again.');
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
                                aspectRatio="16/9"
                            />
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

                        {/* Postcode Lookup */}
                        <div>
                            <PostcodeLookup onResult={handlePostcodeLookup} />
                        </div>

                        {/* Address */}
                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                                Address *
                            </label>
                            <input
                                id="address"
                                name="address"
                                type="text"
                                required
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Full address"
                                disabled={isSubmitting}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>

                        {/* Postcode */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="postcode" className="block text-sm font-medium text-gray-700 mb-2">
                                    Postcode
                                </label>
                                <input
                                    id="postcode"
                                    name="postcode"
                                    type="text"
                                    value={formData.postcode}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData({ ...formData, postcode: val });
                                        setIsPostcodeValid(val ? isHIERegion(val) : true);
                                    }}
                                    placeholder="e.g., IV1 1AA"
                                    disabled={isSubmitting}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${!isPostcodeValid ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-emerald-500'}`}
                                />
                                {!isPostcodeValid && (
                                    <p className="text-xs text-red-600 mt-1">
                                        Venue must be in the Highlands & Islands region
                                    </p>
                                )}
                            </div>
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
                        </div>

                        {/* Coordinates */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Latitude *
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={formData.latitude}
                                    onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Longitude *
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={formData.longitude}
                                    onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>
                        </div>

                        {/* Map Preview */}
                        {formData.latitude && formData.longitude && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Location Preview
                                </label>
                                <MiniMap
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
                                disabled={isSubmitting || success || !isPostcodeValid}
                                className="flex-1"
                            >
                                {isSubmitting ? 'Creating Venue...' : 'Create Venue'}
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
