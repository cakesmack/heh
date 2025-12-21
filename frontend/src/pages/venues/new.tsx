/**
 * Create New Venue Page
 * Allows authenticated users to submit new venues
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { venuesAPI } from '@/lib/api';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { LocationInput } from '@/components/common/LocationInput';

interface VenueFormData {
    name: string;
    description: string;
    address: string;
    postcode: string;
    latitude: number | null;
    longitude: number | null;
    category_id: string;
    website: string;
    phone: string;
}

export default function NewVenuePage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    const [formData, setFormData] = useState<VenueFormData>({
        name: '',
        description: '',
        address: '',
        postcode: '',
        latitude: null,
        longitude: null,
        category_id: '',
        website: '',
        phone: '',
    });
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Fetch venue categories
    useEffect(() => {
        venuesAPI.listCategories().then(setCategories).catch(() => { });
    }, []);

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login?redirect=/venues/new');
        }
    }, [authLoading, isAuthenticated, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        if (error) setError(null);
    };

    const handleLocationSelect = (location: { latitude: number; longitude: number; placeName: string }) => {
        setFormData({
            ...formData,
            address: location.placeName,
            latitude: location.latitude,
            longitude: location.longitude,
        });
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

        try {
            const newVenue = await venuesAPI.create({
                name: formData.name,
                description: formData.description || undefined,
                address: formData.address,
                postcode: formData.postcode || undefined,
                latitude: formData.latitude || undefined,
                longitude: formData.longitude || undefined,
                category_id: formData.category_id || undefined,
                website: formData.website || undefined,
                phone: formData.phone || undefined,
            });

            setSuccess(true);
            setTimeout(() => {
                router.push(`/venues/${newVenue.id}`);
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create venue. Please try again.');
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

                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                Venue Name *
                            </label>
                            <Input
                                id="name"
                                name="name"
                                type="text"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g., The Highlander Pub"
                                disabled={isSubmitting}
                            />
                        </div>

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
                                placeholder="Briefly describe this venue..."
                                disabled={isSubmitting}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-2">
                                Category *
                            </label>
                            <select
                                id="category_id"
                                name="category_id"
                                value={formData.category_id}
                                onChange={handleChange}
                                disabled={isSubmitting}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                            >
                                <option value="">Select a category...</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Address *
                            </label>
                            <LocationInput
                                onSelect={handleLocationSelect}
                                placeholder="Start typing an address..."
                            />
                            {formData.latitude && formData.longitude && (
                                <p className="mt-1 text-xs text-gray-500">
                                    📍 Location set: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                                </p>
                            )}
                        </div>



                        <div>
                            <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
                                Website
                            </label>
                            <Input
                                id="website"
                                name="website"
                                type="url"
                                value={formData.website}
                                onChange={handleChange}
                                placeholder="https://example.com"
                                disabled={isSubmitting}
                            />
                        </div>

                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                                Phone Number
                            </label>
                            <Input
                                id="phone"
                                name="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="01234 567890"
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="flex gap-4">
                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                disabled={isSubmitting || success}
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
