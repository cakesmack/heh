/**
 * Edit Venue Page
 * Allow venue owners to edit their venue details including amenities
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';

export default function EditVenuePage() {
    const router = useRouter();
    const { id } = router.query;
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        description: '',
        website: '',
        phone: '',
        image_url: '',
        // Amenities
        is_dog_friendly: false,
        has_wheelchair_access: false,
        has_parking: false,
        serves_food: false,
        amenities_notes: '',
    });

    useEffect(() => {
        if (!id || authLoading) return;

        if (!isAuthenticated) {
            router.push(`/auth/login?redirect=/account/venues/${id}/edit`);
            return;
        }

        const fetchVenue = async () => {
            try {
                const venue = await api.venues.get(id as string);

                // Check if user owns this venue
                if (venue.owner_id !== user?.id && !user?.is_admin) {
                    setError('You do not have permission to edit this venue');
                    setIsLoading(false);
                    return;
                }

                setFormData({
                    name: venue.name || '',
                    address: venue.address || '',
                    description: venue.description || '',
                    website: venue.website || '',
                    phone: venue.phone || '',
                    image_url: venue.image_url || '',
                    is_dog_friendly: venue.is_dog_friendly || false,
                    has_wheelchair_access: venue.has_wheelchair_access || false,
                    has_parking: venue.has_parking || false,
                    serves_food: venue.serves_food || false,
                    amenities_notes: venue.amenities_notes || '',
                });
            } catch (err) {
                setError('Failed to load venue');
            } finally {
                setIsLoading(false);
            }
        };

        fetchVenue();
    }, [id, isAuthenticated, authLoading, user, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            await api.venues.update(id as string, formData);
            router.push('/account');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update venue');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (error && !formData.name) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-2xl mx-auto px-4">
                    <Card>
                        <div className="text-center py-8">
                            <h1 className="text-xl font-bold text-gray-900 mb-2">Error</h1>
                            <p className="text-gray-600 mb-4">{error}</p>
                            <Link href="/account" className="text-emerald-600 hover:text-emerald-700">
                                &larr; Back to Account
                            </Link>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/account" className="text-sm text-gray-600 hover:text-emerald-600 mb-4 inline-block">
                        &larr; Back to Account
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Edit Venue</h1>
                </div>

                <Card>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        {/* Basic Info */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                Venue Name *
                            </label>
                            <Input
                                id="name"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />
                        </div>

                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                                Address *
                            </label>
                            <Input
                                id="address"
                                name="address"
                                required
                                value={formData.address}
                                onChange={handleChange}
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
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
                                    placeholder="https://..."
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                                    Phone
                                </label>
                                <Input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="image_url" className="block text-sm font-medium text-gray-700 mb-2">
                                Image URL
                            </label>
                            <Input
                                id="image_url"
                                name="image_url"
                                type="url"
                                value={formData.image_url}
                                onChange={handleChange}
                                placeholder="https://..."
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Amenities */}
                        <div className="pt-6 border-t border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Amenities</h3>
                            <div className="space-y-3">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="is_dog_friendly"
                                        checked={formData.is_dog_friendly}
                                        onChange={handleChange}
                                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                        disabled={isSubmitting}
                                    />
                                    <span className="ml-3 text-sm text-gray-700">Dog Friendly</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="has_wheelchair_access"
                                        checked={formData.has_wheelchair_access}
                                        onChange={handleChange}
                                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                        disabled={isSubmitting}
                                    />
                                    <span className="ml-3 text-sm text-gray-700">Wheelchair Accessible</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="has_parking"
                                        checked={formData.has_parking}
                                        onChange={handleChange}
                                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                        disabled={isSubmitting}
                                    />
                                    <span className="ml-3 text-sm text-gray-700">Parking Available</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="serves_food"
                                        checked={formData.serves_food}
                                        onChange={handleChange}
                                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                        disabled={isSubmitting}
                                    />
                                    <span className="ml-3 text-sm text-gray-700">Serves Food</span>
                                </label>
                            </div>

                            <div className="mt-4">
                                <label htmlFor="amenities_notes" className="block text-sm font-medium text-gray-700 mb-2">
                                    Amenities Notes
                                </label>
                                <textarea
                                    id="amenities_notes"
                                    name="amenities_notes"
                                    rows={2}
                                    value={formData.amenities_notes}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="Additional details about accessibility, parking, etc."
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                            <Link href="/account" className="text-sm text-gray-600 hover:text-emerald-600">
                                Cancel
                            </Link>
                            <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}
