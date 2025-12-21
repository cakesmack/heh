/**
 * Edit Organizer Profile Page
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

export default function EditOrganizerPage() {
    const router = useRouter();
    const { id } = router.query;
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
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
    const [members, setMembers] = useState<any[]>([]);

    useEffect(() => {
        if (!id || authLoading) return;

        if (!isAuthenticated) {
            router.push(`/auth/login?redirect=/account/organizers/${id}/edit`);
            return;
        }

        const fetchOrganizer = async () => {
            try {
                const org = await api.organizers.get(id as string);
                setFormData({
                    name: org.name || '',
                    bio: org.bio || '',
                    website_url: org.website_url || '',
                    logo_url: org.logo_url || '',
                    social_links: org.social_links || {},
                });

                // Fetch members
                try {
                    const membersData = await api.groups.listMembers(id as string);
                    setMembers(membersData || []);
                } catch (err) {
                    console.error('Failed to fetch members:', err);
                }
            } catch (err) {
                setError('Failed to load organizer profile');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrganizer();
    }, [id, isAuthenticated, authLoading, router]);

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

            await api.organizers.update(id as string, data);
            router.push('/account');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update organizer profile');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this organizer profile? This cannot be undone.')) {
            return;
        }

        try {
            await api.organizers.delete(id as string);
            router.push('/account');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete organizer profile');
        }
    };

    const handleGenerateInvite = async () => {
        try {
            const invite = await api.groups.createInvite(id as string);
            const inviteUrl = `${window.location.origin}/join/group/${invite.token}`;
            navigator.clipboard.writeText(inviteUrl);
            alert(`Invite link copied to clipboard!\n\n${inviteUrl}`);
        } catch (err) {
            console.error('Failed to generate invite:', err);
            alert('Failed to generate invite link');
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Spinner size="lg" />
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
                    <h1 className="text-3xl font-bold text-gray-900">Edit Organizer Profile</h1>
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

                        {/* Group Management */}
                        <div className="pt-6 border-t border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Group Management</h3>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">Invite Members</h4>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Generate a link to invite others to manage this profile.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={handleGenerateInvite}
                                    >
                                        Copy Invite Link
                                    </Button>
                                </div>

                                {/* Members List */}
                                <div className="mt-6 border-t border-gray-200 pt-6">
                                    <h4 className="text-sm font-medium text-gray-900 mb-4">Current Members ({members.length})</h4>
                                    {members.length > 0 ? (
                                        <div className="space-y-3">
                                            {members.map((member) => (
                                                <div key={member.user_id} className="flex items-center justify-between bg-white p-3 border border-gray-200 rounded-lg">
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold mr-3">
                                                            {(member.user_name || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{member.user_name || 'Unknown User'}</p>
                                                            <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">No members found.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="text-sm text-red-600 hover:text-red-800"
                            >
                                Delete Profile
                            </button>
                            <div className="flex gap-3">
                                <Link href="/account" className="text-sm text-gray-600 hover:text-emerald-600 py-2">
                                    Cancel
                                </Link>
                                <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
                                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Card >
            </div >
        </div >
    );
}
