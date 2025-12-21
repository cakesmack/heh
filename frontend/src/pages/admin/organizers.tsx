/**
 * Admin Organizers Page
 * Manage all organizer profiles (Groups) with edit functionality
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import AdminLayout from '@/components/admin/AdminLayout';
import Modal from '@/components/admin/Modal';
import ImageUpload from '@/components/common/ImageUpload';
import { Spinner } from '@/components/common/Spinner';

interface Organizer {
    id: string;
    name: string;
    slug: string;
    bio?: string;
    website_url?: string;
    logo_url?: string;
    hero_image_url?: string;
    social_links?: Record<string, string>;
    user_id: string;
    created_at: string;
}

export default function AdminOrganizersPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const [organizers, setOrganizers] = useState<Organizer[]>([]);
    const [filteredOrganizers, setFilteredOrganizers] = useState<Organizer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Edit modal state
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingOrganizer, setEditingOrganizer] = useState<Organizer | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        bio: '',
        website_url: '',
        logo_url: '',
        hero_image_url: '',
    });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const fetchOrganizers = async () => {
        try {
            const data = await api.organizers.list();
            setOrganizers(data.organizers || []);
            setFilteredOrganizers(data.organizers || []);
        } catch (err) {
            setError('Failed to load organizers');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated || !user?.is_admin) {
            router.push('/login');
            return;
        }

        fetchOrganizers();
    }, [isAuthenticated, user, authLoading, router]);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredOrganizers(organizers);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredOrganizers(
                organizers.filter(org =>
                    org.name.toLowerCase().includes(query) ||
                    org.slug.toLowerCase().includes(query) ||
                    (org.bio && org.bio.toLowerCase().includes(query))
                )
            );
        }
    }, [searchQuery, organizers]);

    const openEditModal = (org: Organizer) => {
        setEditingOrganizer(org);
        setFormData({
            name: org.name,
            bio: org.bio || '',
            website_url: org.website_url || '',
            logo_url: org.logo_url || '',
            hero_image_url: org.hero_image_url || '',
        });
        setFormError(null);
        setEditModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingOrganizer) return;

        setSaving(true);
        setFormError(null);

        try {
            await api.organizers.update(editingOrganizer.id, {
                name: formData.name,
                bio: formData.bio || undefined,
                website_url: formData.website_url || undefined,
                logo_url: formData.logo_url || undefined,
                hero_image_url: formData.hero_image_url || undefined,
            });
            setEditModalOpen(false);
            fetchOrganizers();
        } catch (err: any) {
            setFormError(err.message || 'Failed to update organizer');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
            return;
        }

        try {
            await api.organizers.delete(id);
            setOrganizers(prev => prev.filter(org => org.id !== id));
        } catch (err) {
            alert('Failed to delete organizer');
        }
    };

    if (authLoading || isLoading) {
        return (
            <AdminLayout title="Groups">
                <div className="flex items-center justify-center py-12">
                    <Spinner size="lg" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Groups">
            {/* Search & Stats Bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium">
                        {organizers.length} Total Groups
                    </div>
                </div>
                <div className="relative w-full md:w-80">
                    <input
                        type="text"
                        placeholder="Search groups..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                {filteredOrganizers.length > 0 ? (
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Group</th>
                                <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Slug</th>
                                <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Website</th>
                                <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Created</th>
                                <th className="text-right py-3 px-4 font-medium text-gray-600 text-sm">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredOrganizers.map((org) => (
                                <tr
                                    key={org.id}
                                    onClick={() => window.open(`/groups/${org.slug}`, '_blank')}
                                    className="hover:bg-gray-50 cursor-pointer"
                                >
                                    <td className="py-3 px-4">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mr-3 flex-shrink-0">
                                                {org.logo_url ? (
                                                    <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover rounded-lg" />
                                                ) : (
                                                    <span className="text-sm font-bold text-emerald-600">{org.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-900 block">{org.name}</span>
                                                {org.bio && (
                                                    <span className="text-xs text-gray-500 line-clamp-1">{org.bio}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <code className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">@{org.slug}</code>
                                    </td>
                                    <td className="py-3 px-4">
                                        {org.website_url ? (
                                            <a
                                                href={org.website_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-emerald-600 hover:text-emerald-800 text-sm"
                                            >
                                                {org.website_url.replace(/^https?:\/\//, '').substring(0, 25)}
                                            </a>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-gray-600 text-sm">
                                        {new Date(org.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openEditModal(org); }}
                                                className="text-xs text-emerald-600 hover:text-emerald-800 px-3 py-1.5 rounded hover:bg-emerald-50"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(org.id, org.name); }}
                                                className="text-xs text-red-600 hover:text-red-800 px-3 py-1.5 rounded hover:bg-red-50"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="text-center py-12">
                        {searchQuery ? (
                            <p className="text-gray-500">No groups found matching "{searchQuery}"</p>
                        ) : (
                            <p className="text-gray-500">No organizer profiles found.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <Modal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                title={`Edit: ${editingOrganizer?.name}`}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    {formError && (
                        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                            {formError}
                        </div>
                    )}

                    {/* Hero Image */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Hero Image (Banner)</label>
                        <ImageUpload
                            folder="organizers"
                            currentImageUrl={formData.hero_image_url}
                            onUpload={(result) => setFormData(prev => ({ ...prev, hero_image_url: result.url }))}
                            onRemove={() => setFormData(prev => ({ ...prev, hero_image_url: '' }))}
                            aspectRatio="21/9"
                        />
                        <p className="text-xs text-gray-500 mt-1">This appears as the blurred background on the group page.</p>
                    </div>

                    {/* Logo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
                        <ImageUpload
                            folder="organizers"
                            currentImageUrl={formData.logo_url}
                            onUpload={(result) => setFormData(prev => ({ ...prev, logo_url: result.url }))}
                            onRemove={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                            aspectRatio="1/1"
                        />
                        <p className="text-xs text-gray-500 mt-1">Square logo displayed on the group profile.</p>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>

                    {/* Bio */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bio / Description</label>
                        <textarea
                            value={formData.bio}
                            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            rows={4}
                            placeholder="Tell people about this group..."
                        />
                    </div>

                    {/* Website */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                        <input
                            type="url"
                            value={formData.website_url}
                            onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            placeholder="https://example.com"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={() => setEditModalOpen(false)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </Modal>
        </AdminLayout>
    );
}
