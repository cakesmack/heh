/**
 * Admin Collections Page
 * CRUD interface for managing curated collections
 */

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import ImageUpload from '@/components/common/ImageUpload';
import { collectionsAPI, categoriesAPI } from '@/lib/api';
import { AGE_RESTRICTION_OPTIONS } from '@/lib/ageRestriction';
import type { Collection, Category } from '@/types';

export default function AdminCollections() {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        image_url: '',
        target_link: '',
        is_active: true,
        sort_order: 0,
        fixed_start_date: '',
        fixed_end_date: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Query Builder State
    const [categories, setCategories] = useState<Category[]>([]);
    const [queryBuilderMode, setQueryBuilderMode] = useState(true);
    const [qbState, setQbState] = useState({
        category: [] as string[],
        q: '',
        tags: '',
        age: '',
        price: 'any', // 'any', 'free', 'paid'
    });

    const fetchCollections = async () => {
        try {
            const [colRes, catRes] = await Promise.all([
                collectionsAPI.list(),
                categoriesAPI.list(true)
            ]);
            setCollections(colRes);
            setCategories(catRes.categories || []);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCollections();
    }, []);

    const openCreateModal = () => {
        setEditingCollection(null);
        setFormData({
            title: '',
            subtitle: '',
            image_url: '',
            target_link: '',
            is_active: true,
            sort_order: collections.length + 1,
            fixed_start_date: '',
            fixed_end_date: '',
        });
        setQbState({
            category: [],
            q: '',
            tags: '',
            age: '',
            price: 'any',
        });
        setQueryBuilderMode(true);
        setError(null);
        setModalOpen(true);
    };

    const openEditModal = (collection: Collection) => {
        setEditingCollection(collection);
        setFormData({
            title: collection.title,
            subtitle: collection.subtitle || '',
            image_url: collection.image_url || '',
            target_link: collection.target_link,
            is_active: collection.is_active,
            sort_order: collection.sort_order,
            fixed_start_date: collection.fixed_start_date || '',
            fixed_end_date: collection.fixed_end_date || '',
        });

        // Parse target_link to populate builder state
        parseLinkToBuilder(collection.target_link);

        setError(null);
        setModalOpen(true);
    };

    // Parse URL params to builder state
    const parseLinkToBuilder = (url: string) => {
        try {
            // Check if it's a standard events URL
            if (!url.startsWith('/events')) {
                setQueryBuilderMode(false);
                return;
            }

            const searchParams = new URLSearchParams(url.split('?')[1] || '');

            setQbState({
                category: searchParams.get('category')?.split(',') || [],
                q: searchParams.get('q') || '',
                tags: searchParams.get('tag_names') || searchParams.get('tag') || '',
                age: searchParams.get('age_restriction') || '',
                price: searchParams.get('price') === 'free' ? 'free' : (searchParams.get('price') === 'paid' ? 'paid' : 'any'),
            });
            setQueryBuilderMode(true);
        } catch (e) {
            setQueryBuilderMode(false);
        }
    };

    // Update target_link when builder state changes
    useEffect(() => {
        if (!queryBuilderMode || !modalOpen) return;

        const params = new URLSearchParams();
        if (qbState.category.length > 0) params.append('category', qbState.category.join(','));
        if (qbState.q) params.append('q', qbState.q);
        if (qbState.tags) params.append('tag_names', qbState.tags);
        if (qbState.age) params.append('age_restriction', qbState.age);
        if (qbState.price === 'free') params.append('price', 'free');

        // Add fixed date range to URL params if set
        if (formData.fixed_start_date || formData.fixed_end_date) {
            params.append('date', 'custom');
        }
        if (formData.fixed_start_date) params.append('date_from', formData.fixed_start_date);
        if (formData.fixed_end_date) params.append('date_to', formData.fixed_end_date);

        const queryString = params.toString();
        const newLink = queryString ? `/events?${queryString}` : '/events';

        setFormData(prev => ({ ...prev, target_link: newLink }));
    }, [qbState, queryBuilderMode, modalOpen, formData.fixed_start_date, formData.fixed_end_date]);

    const handleImageUpload = (urls: { url: string }) => {
        setFormData(prev => ({ ...prev, image_url: urls.url }));
    };

    const handleImageRemove = () => {
        setFormData(prev => ({ ...prev, image_url: '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            if (editingCollection) {
                await collectionsAPI.update(editingCollection.id, formData);
            } else {
                await collectionsAPI.create(formData);
            }
            setModalOpen(false);
            fetchCollections();
        } catch (err: any) {
            setError(err.message || 'Failed to save collection');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (collection: Collection) => {
        if (!confirm(`Are you sure you want to delete "${collection.title}"?`)) return;

        try {
            await collectionsAPI.delete(collection.id);
            fetchCollections();
        } catch (err: any) {
            alert(err.message || 'Failed to delete collection');
        }
    };

    const handleSeed = async () => {
        if (!confirm('This will add default collections. Continue?')) return;
        try {
            await collectionsAPI.seed();
            fetchCollections();
        } catch (err: any) {
            alert(err.message || 'Failed to seed collections');
        }
    };

    const columns = [
        {
            key: 'title',
            header: 'Title',
            render: (col: Collection) => (
                <div className="flex items-center">
                    {col.image_url ? (
                        <img
                            src={col.image_url}
                            alt={col.title}
                            className="w-16 h-9 rounded object-cover mr-3"
                        />
                    ) : (
                        <div className="w-16 h-9 bg-gray-200 rounded mr-3" />
                    )}
                    <div>
                        <div className="font-medium text-gray-900">{col.title}</div>
                        <div className="text-xs text-gray-500">{col.subtitle}</div>
                    </div>
                </div>
            ),
        },
        { key: 'target_link', header: 'Link' },
        { key: 'sort_order', header: 'Order' },
        {
            key: 'is_active',
            header: 'Status',
            render: (col: Collection) => (
                <span
                    className={`px-2 py-1 text-xs rounded-full ${col.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                >
                    {col.is_active ? 'Active' : 'Inactive'}
                </span>
            ),
        },
    ];

    return (
        <AdminGuard>
            <AdminLayout title="Curated Collections">
                <div className="mb-6 flex justify-between items-center">
                    <p className="text-gray-600">Manage homepage curated collections</p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleSeed}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                            Seed Defaults
                        </button>
                        <button
                            onClick={openCreateModal}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                            Add Collection
                        </button>
                    </div>
                </div>

                <DataTable
                    columns={columns}
                    data={collections}
                    loading={loading}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                />

                <Modal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    title={editingCollection ? 'Edit Collection' : 'Add Collection'}
                >
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {/* Collection Image */}
                        <ImageUpload
                            folder="categories" // Reusing categories folder for now
                            currentImageUrl={formData.image_url}
                            onUpload={handleImageUpload}
                            onRemove={handleImageRemove}
                            aspectRatio="16/9"
                        />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title *
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Subtitle
                            </label>
                            <input
                                type="text"
                                value={formData.subtitle}
                                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-medium text-gray-700">
                                    Target Link Configuration
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setQueryBuilderMode(!queryBuilderMode)}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                                >
                                    {queryBuilderMode ? 'Switch to Manual Input' : 'Switch to Query Builder'}
                                </button>
                            </div>

                            {queryBuilderMode ? (
                                <div className="space-y-3">
                                    {/* Categories (Multi-select) */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-2">Categories (Select matches)</label>
                                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded bg-white">
                                            {categories.map(c => (
                                                <label key={c.id} className="flex items-center space-x-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={qbState.category.includes(c.name)} // Assuming name handles slug matching for now as per previous logic
                                                        onChange={(e) => {
                                                            const newCats = e.target.checked
                                                                ? [...qbState.category, c.name]
                                                                : qbState.category.filter(cat => cat !== c.name);
                                                            setQbState({ ...qbState, category: newCats });
                                                        }}
                                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="truncate">{c.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Search Query */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Search Keywords (Title/Desc)</label>
                                        <input
                                            type="text"
                                            value={qbState.q}
                                            onChange={(e) => setQbState({ ...qbState, q: e.target.value })}
                                            className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-emerald-500"
                                            placeholder="e.g. workshop, gala"
                                        />
                                    </div>

                                    {/* Tags */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Tags (Comma separated)</label>
                                        <input
                                            type="text"
                                            value={qbState.tags}
                                            onChange={(e) => setQbState({ ...qbState, tags: e.target.value })}
                                            className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-emerald-500"
                                            placeholder="e.g. jazz, outdoor, family"
                                        />
                                    </div>

                                    {/* Age Restriction */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Age Restriction</label>
                                        <select
                                            value={qbState.age}
                                            onChange={(e) => setQbState({ ...qbState, age: e.target.value })}
                                            className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-emerald-500"
                                        >
                                            {AGE_RESTRICTION_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Price */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Price</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center text-sm text-gray-600">
                                                <input
                                                    type="radio"
                                                    name="qb_price"
                                                    checked={qbState.price === 'any'}
                                                    onChange={() => setQbState({ ...qbState, price: 'any' })}
                                                    className="mr-1.5"
                                                />
                                                Any
                                            </label>
                                            <label className="flex items-center text-sm text-gray-600">
                                                <input
                                                    type="radio"
                                                    name="qb_price"
                                                    checked={qbState.price === 'free'}
                                                    onChange={() => setQbState({ ...qbState, price: 'free' })}
                                                    className="mr-1.5"
                                                />
                                                Free
                                            </label>
                                        </div>
                                    </div>

                                    {/* Custom Date Range */}
                                    <div className="pt-3 border-t border-gray-200">
                                        <label className="block text-xs font-medium text-gray-500 mb-2">
                                            📅 Custom Date Range (Optional)
                                        </label>
                                        <p className="text-xs text-gray-400 mb-2">
                                            Set specific dates for themed collections like "Easter Weekend" or "Festival Week"
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.fixed_start_date}
                                                    onChange={(e) => setFormData({ ...formData, fixed_start_date: e.target.value })}
                                                    className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-emerald-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.fixed_end_date}
                                                    onChange={(e) => setFormData({ ...formData, fixed_end_date: e.target.value })}
                                                    min={formData.fixed_start_date}
                                                    className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-emerald-500"
                                                />
                                            </div>
                                        </div>
                                        {formData.fixed_start_date && formData.fixed_end_date && formData.fixed_end_date < formData.fixed_start_date && (
                                            <p className="text-xs text-red-500 mt-1">End date must be after start date</p>
                                        )}
                                    </div>

                                    <div className="pt-2 border-t border-gray-200">
                                        <p className="text-xs text-gray-500">Generated Link:</p>
                                        <code className="block w-full bg-gray-100 p-2 rounded text-xs text-gray-700 break-all mt-1">
                                            {formData.target_link}
                                        </code>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <input
                                        type="text"
                                        value={formData.target_link}
                                        onChange={(e) => setFormData({ ...formData, target_link: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                        placeholder="/events?category=music"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Internal path, e.g., /events?category=music</p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Sort Order
                                </label>
                                <input
                                    type="number"
                                    value={formData.sort_order}
                                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                className="w-4 h-4 text-emerald-600 rounded"
                            />
                            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                                Active
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : editingCollection ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </form>
                </Modal>
            </AdminLayout>
        </AdminGuard>
    );
}
