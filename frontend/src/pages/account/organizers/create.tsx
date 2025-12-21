/**
 * Create Organizer Profile Page
 */
import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';

export default function CreateOrganizerPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        bio: '',
        website_url: '',
        logo_url: '',
        social_links: {} as Record<string, string>,
    });

    const [newSocialPlatform, setNewSocialPlatform] = useState('');
    const [newSocialUrl, setNewSocialUrl] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddSocialLink = () => {
        if (newSocialPlatform && newSocialUrl) {
            setFormData(prev => ({
                ...prev,
                social_links: {
                    ...prev.social_links,
                    [newSocialPlatform.toLowerCase()]: newSocialUrl,
                },
            }));
            setNewSocialPlatform('');
            setNewSocialUrl('');
        }
    };

    const handleRemoveSocialLink = (platform: string) => {
        setFormData(prev => {
            const links = { ...prev.social_links };
            delete links[platform];
            return { ...prev, social_links: links };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const data = {
                name: formData.name,
                bio: formData.bio || undefined,
                website_url: formData.website_url || undefined,
                logo_url: formData.logo_url || undefined,
                social_links: Object.keys(formData.social_links).length > 0 ? formData.social_links : undefined,
            };

            await api.organizers.create(data);
            router.push('/account');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create organizer profile');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        router.push('/auth/login?redirect=/account/organizers/create');
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/account" className="text-sm text-gray-600 hover:text-emerald-600 mb-4 inline-block">
                        &larr; Back to Account
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Create Organizer Profile</h1>
                    <p className="text-gray-600 mt-2">Create a profile for your organization, group, or venue to manage events.</p>
                </div>

                <Card>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                Organization Name *
                            </label>
                            <Input
                                id="name"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g., Highland Music Society"
                                disabled={isSubmitting}
                            />
                        </div>

                        <div>
                            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
                                Bio / Description
                            </label>
                            <textarea
                                id="bio"
                                name="bio"
                                rows={4}
                                value={formData.bio}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                placeholder="Tell people about your organization..."
                                disabled={isSubmitting}
                            />
                        </div>

                        <div>
                            <label htmlFor="website_url" className="block text-sm font-medium text-gray-700 mb-2">
                                Website URL
                            </label>
                            <Input
                                id="website_url"
                                name="website_url"
                                type="url"
                                value={formData.website_url}
                                onChange={handleChange}
                                placeholder="https://example.com"
                                disabled={isSubmitting}
                            />
                        </div>

                        <div>
                            <label htmlFor="logo_url" className="block text-sm font-medium text-gray-700 mb-2">
                                Logo URL
                            </label>
                            <Input
                                id="logo_url"
                                name="logo_url"
                                type="url"
                                value={formData.logo_url}
                                onChange={handleChange}
                                placeholder="https://example.com/logo.png"
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Social Links */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Social Links
                            </label>

                            {Object.entries(formData.social_links).length > 0 && (
                                <div className="space-y-2 mb-4">
                                    {Object.entries(formData.social_links).map(([platform, url]) => (
                                        <div key={platform} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                                            <span className="text-sm">
                                                <span className="font-medium capitalize">{platform}:</span> {url}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSocialLink(platform)}
                                                className="text-red-600 hover:text-red-800 text-sm"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Input
                                    placeholder="Platform (e.g., facebook)"
                                    value={newSocialPlatform}
                                    onChange={(e) => setNewSocialPlatform(e.target.value)}
                                    disabled={isSubmitting}
                                    className="flex-1"
                                />
                                <Input
                                    placeholder="URL"
                                    value={newSocialUrl}
                                    onChange={(e) => setNewSocialUrl(e.target.value)}
                                    disabled={isSubmitting}
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleAddSocialLink}
                                    disabled={isSubmitting || !newSocialPlatform || !newSocialUrl}
                                >
                                    Add
                                </Button>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                            <Link href="/account" className="text-sm text-gray-600 hover:text-emerald-600">
                                Cancel
                            </Link>
                            <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : 'Create Profile'}
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}
