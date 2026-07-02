/**
 * Admin Collections Page
 * CRUD interface for managing curated collections
 */

import { useEffect, useState, useRef } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import OptimizedImage from '@/components/ui/OptimizedImage';
import ImageUpload from '@/components/common/ImageUpload';
import { collectionsAPI, categoriesAPI, tagsAPI } from '@/lib/api';
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
        target_link: '', // Kept for backwards compatibility payload, but UI removed
        is_active: true,
        sort_order: 0,
        fixed_start_date: '',
        fixed_end_date: '',
        slug: '',
        description: '',
        long_description: '',
        seo_title: '',
        seo_description: '',
        is_featured: false,
        show_on_map: false,
        filter_params: null as Record<string, any> | null,
    });
    const slugManuallyEdited = useRef(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Query Builder State
    const [categories, setCategories] = useState<Category[]>([]);
    const [qbState, setQbState] = useState({
        category: [] as string[],
        q: '',
        age: '',
        price: 'any', // 'any', 'free', 'paid'
        recurrence: 'any', // 'any', 'recurring', 'single'
        combine_operator: 'and' as 'and' | 'or',
        exclude_age_restrictions: [] as string[],
        exclude_event_ids: [] as string[],
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

    const slugify = (text: string) =>
        text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const openCreateModal = () => {
        setEditingCollection(null);
        slugManuallyEdited.current = false;
        setFormData({
            title: '',
            subtitle: '',
            image_url: '',
            target_link: '',
            is_active: true,
            sort_order: collections.length + 1,
            fixed_start_date: '',
            fixed_end_date: '',
            slug: '',
            description: '',
            long_description: '',
            seo_title: '',
            seo_description: '',
            is_featured: false,
            show_on_map: false,
            filter_params: null,
        });
        setQbState({
            category: [],
            q: '',
            age: '',
            price: 'any',
            recurrence: 'any',
            combine_operator: 'and',
            exclude_age_restrictions: [],
            exclude_event_ids: [],
        });
        setError(null);
        setModalOpen(true);
    };

    const mapToCategoryIds = (items: any[]): string[] => {
        if (!items || !Array.isArray(items)) return [];
        return items.map(item => {
            const strVal = String(item).trim().toLowerCase();
            const found = categories.find(c => 
                c.id === item || 
                c.name.toLowerCase() === strVal || 
                c.slug.toLowerCase() === strVal
            );
            return found ? found.id : item;
        });
    };

    const openEditModal = (collection: Collection) => {
        setEditingCollection(collection);
        slugManuallyEdited.current = !!collection.slug;

        setFormData({
            title: collection.title,
            subtitle: collection.subtitle || '',
            image_url: collection.image_url || '',
            target_link: collection.target_link || '',
            is_active: collection.is_active,
            sort_order: collection.sort_order,
            fixed_start_date: collection.fixed_start_date || '',
            fixed_end_date: collection.fixed_end_date || '',
            slug: collection.slug || '',
            description: collection.description || '',
            long_description: (collection as any).long_description || '',
            seo_title: (collection as any).seo_title || '',
            seo_description: (collection as any).seo_description || '',
            is_featured: (collection as any).is_featured || false,
            show_on_map: (collection as any).show_on_map || false,
            filter_params: collection.filter_params || null,
        });

        // Initialize QB State from filter_params FIRST (JSON-first architecture)
        if (collection.filter_params) {
            const rawCats = collection.filter_params.category_ids || collection.filter_params.category || [];
            const mappedCats = mapToCategoryIds(Array.isArray(rawCats) ? rawCats : [rawCats]);
            setQbState({
                category: mappedCats,
                q: collection.filter_params.q || '',
                age: collection.filter_params.age_restriction || '',
                price: collection.filter_params.price === 'free' ? 'free' : (collection.filter_params.price === 'paid' ? 'paid' : 'any'),
                recurrence: collection.filter_params.is_recurring === true ? 'recurring' : (collection.filter_params.is_recurring === false ? 'single' : 'any'),
                combine_operator: collection.filter_params.combine_operator || 'and',
                exclude_age_restrictions: collection.filter_params.exclude_age_restrictions || [],
                exclude_event_ids: collection.filter_params.exclude_event_ids || [],
            });
        }
        // Fallback for legacy target_link parsing only if JSON doesn't exist
        else if (collection.target_link && collection.target_link.startsWith('/events')) {
            parseLinkToBuilder(collection.target_link);
        } else {
            // Reset to default
            setQbState({ category: [], q: '', age: '', price: 'any', recurrence: 'any', combine_operator: 'and', exclude_age_restrictions: [], exclude_event_ids: [] });
        }

        setError(null);
        setModalOpen(true);
    };

    // Safe Resolve Tags on Modal Open
    useEffect(() => {
        if (!modalOpen || !editingCollection) return;

        const resolveTags = async () => {
            const ids = editingCollection?.filter_params?.tag_ids || [];
            if (ids.length > 0 && Array.isArray(ids)) {
                try {
                    const names: string[] = [];
                    for (const tagId of ids) {
                        const tag = await tagsAPI.getById(tagId);
                        names.push(tag.name);
                    }
                    setQbState(prev => ({ ...prev, tag_ids_manual: names.join(', ') }));
                } catch (err) {
                    console.error("Failed to resolve tag names:", err);
                    setQbState(prev => ({ ...prev, tag_ids_manual: ids.join(', ') })); // fallback
                }
            } else {
                setQbState(prev => ({ ...prev, tag_ids_manual: '' }));
            }
        };

        resolveTags();

        // Cleanup function for modal close safety
        return () => {
            // Let the specific open functions handle strict cleanup, but this safely wipes state on remounts
        };
    }, [modalOpen, editingCollection]);

    // Parse URL params to builder state (Legacy Fallback Only)
    const parseLinkToBuilder = (url: string) => {
        try {
            const searchParams = new URLSearchParams(url.split('?')[1] || '');
            const rawCats = searchParams.get('category')?.split(',') || [];
            const mappedCats = mapToCategoryIds(rawCats);

            setQbState({
                category: mappedCats,
                q: searchParams.get('q') || '',
                age: searchParams.get('age_restriction') || '',
                price: searchParams.get('price') === 'free' ? 'free' : (searchParams.get('price') === 'paid' ? 'paid' : 'any'),
                recurrence: searchParams.get('is_recurring') === 'true' ? 'recurring' : (searchParams.get('is_recurring') === 'false' ? 'single' : 'any'),
                combine_operator: (searchParams.get('combine_operator') as any) || 'and',
                exclude_age_restrictions: searchParams.get('exclude_age_restrictions')?.split(',').filter(Boolean) || [],
                exclude_event_ids: searchParams.get('exclude_event_ids')?.split(',').filter(Boolean) || [],
            });
        } catch (e) {
            console.error("Failed to parse fallback URL:", e);
        }
    };
    // Single-write: Update filter_params when builder state changes
    useEffect(() => {
        if (!modalOpen) return;

        // Build structured filter_params JSON from the state
        const filterObj: Record<string, any> = {};

        // Use category_ids logic to enforce ID usage
        if (qbState.category.length > 0) {
            filterObj.category_ids = qbState.category;
        }

        if (qbState.q) filterObj.q = qbState.q;
        
        if (qbState.combine_operator) {
            filterObj.combine_operator = qbState.combine_operator;
        }

        if (qbState.exclude_age_restrictions.length > 0) {
            filterObj.exclude_age_restrictions = qbState.exclude_age_restrictions;
        }
        if (qbState.exclude_event_ids.length > 0) {
            filterObj.exclude_event_ids = qbState.exclude_event_ids;
        }


        if (qbState.age) filterObj.age_restriction = qbState.age;
        if (qbState.price !== 'any') filterObj.price = qbState.price;
        if (qbState.recurrence === 'recurring') filterObj.is_recurring = true;
        if (qbState.recurrence === 'single') filterObj.is_recurring = false;

        if (formData.fixed_start_date || formData.fixed_end_date) {
            filterObj.date = 'custom';
        }
        if (formData.fixed_start_date) filterObj.date_from = formData.fixed_start_date;
        if (formData.fixed_end_date) filterObj.date_to = formData.fixed_end_date;

        const newFilterParams = Object.keys(filterObj).length > 0 ? filterObj : null;

        setFormData(prev => ({ ...prev, filter_params: newFilterParams }));
    }, [qbState, modalOpen, formData.fixed_start_date, formData.fixed_end_date, categories]);

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
            const finalFormData = { ...formData };
            if (finalFormData.filter_params) {
                finalFormData.filter_params = { ...finalFormData.filter_params };
            }
            // Tag filtering has been removed via directive; clean old tag_ids explicitly upon saving
            if (finalFormData.filter_params && finalFormData.filter_params.tag_ids) {
                delete finalFormData.filter_params.tag_ids;
            }

            if (editingCollection) {
                await collectionsAPI.update(editingCollection.id, finalFormData);
            } else {
                await collectionsAPI.create(finalFormData);
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
                        <div className="relative w-16 h-9 mr-3">
                            <OptimizedImage
                                src={col.image_url}
                                alt={col.title}
                                fill
                                className="rounded object-cover"
                                variant="thumb"
                            />
                        </div>
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
        {
            key: 'show_on_map',
            header: 'Map',
            render: (col: Collection) => (
                <span
                    className={`px-2 py-1 text-xs rounded-full ${(col as any).show_on_map ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}
                >
                    {(col as any).show_on_map ? 'Visible' : 'Hidden'}
                </span>
            ),
        },
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
                                onChange={(e) => {
                                    const newTitle = e.target.value;
                                    const updates: any = { title: newTitle };
                                    if (!slugManuallyEdited.current) {
                                        updates.slug = slugify(newTitle);
                                    }
                                    setFormData(prev => ({ ...prev, ...updates }));
                                }}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                URL Slug
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-400">/collections/</span>
                                <input
                                    type="text"
                                    value={formData.slug}
                                    onChange={(e) => {
                                        slugManuallyEdited.current = true;
                                        setFormData(prev => ({ ...prev, slug: slugify(e.target.value) }));
                                    }}
                                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
                                    placeholder="auto-generated-from-title"
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Auto-generated from title. Edit to override.</p>
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                rows={3}
                                placeholder="Optional description for this collection..."
                            />
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-medium text-gray-700">
                                    Filter Configuration
                                </label>
                            </div>

                            <div className="space-y-3">
                                {/* Categories (Multi-select) */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-2">Categories (Select matches)</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded bg-white">
                                        {categories.map(c => (
                                            <label key={c.id} className="flex items-center space-x-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={qbState.category.includes(c.id)}
                                                    onChange={(e) => {
                                                        const newCats = e.target.checked
                                                            ? [...qbState.category, c.id]
                                                            : qbState.category.filter(catId => catId !== c.id);
                                                        setQbState({ ...qbState, category: newCats });
                                                    }}
                                                    className="rounded text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className="truncate">{c.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Categories & Tags combine operator */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Filter Match Mode (Categories & Keywords/Tags)</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input
                                                type="radio"
                                                name="combine_operator"
                                                value="and"
                                                checked={qbState.combine_operator === 'and'}
                                                onChange={() => setQbState({ ...qbState, combine_operator: 'and' })}
                                                className="text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span>Match ALL (AND)</span>
                                        </label>
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input
                                                type="radio"
                                                name="combine_operator"
                                                value="or"
                                                checked={qbState.combine_operator === 'or'}
                                                onChange={() => setQbState({ ...qbState, combine_operator: 'or' })}
                                                className="text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span>Match ANY (OR)</span>
                                        </label>
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


                                {/* Recurrence Filter */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Recurrence</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center text-sm text-gray-600">
                                            <input
                                                type="radio"
                                                name="qb_recurrence"
                                                checked={qbState.recurrence === 'any'}
                                                onChange={() => setQbState({ ...qbState, recurrence: 'any' })}
                                                className="mr-1.5"
                                            />
                                            Any
                                        </label>
                                        <label className="flex items-center text-sm text-gray-600">
                                            <input
                                                type="radio"
                                                name="qb_recurrence"
                                                checked={qbState.recurrence === 'recurring'}
                                                onChange={() => setQbState({ ...qbState, recurrence: 'recurring' })}
                                                className="mr-1.5"
                                            />
                                            Recurring Only
                                        </label>
                                        <label className="flex items-center text-sm text-gray-600">
                                            <input
                                                type="radio"
                                                name="qb_recurrence"
                                                checked={qbState.recurrence === 'single'}
                                                onChange={() => setQbState({ ...qbState, recurrence: 'single' })}
                                                className="mr-1.5"
                                            />
                                            Single Only
                                        </label>
                                    </div>
                                </div>

                                {/* Exclude Age Restrictions */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Exclude Age Restrictions</label>
                                    <div className="grid grid-cols-2 gap-1">
                                        {[
                                            { value: '18_plus', label: '18+' },
                                            { value: '21_plus', label: '21+' },
                                            { value: '15_plus', label: '15+' },
                                            { value: '12_plus', label: '12+' },
                                        ].map(opt => (
                                            <label key={opt.value} className="flex items-center space-x-1.5 text-sm text-gray-600 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={qbState.exclude_age_restrictions.includes(opt.value)}
                                                    onChange={(e) => {
                                                        const newExcl = e.target.checked
                                                            ? [...qbState.exclude_age_restrictions, opt.value]
                                                            : qbState.exclude_age_restrictions.filter(v => v !== opt.value);
                                                        setQbState({ ...qbState, exclude_age_restrictions: newExcl });
                                                    }}
                                                    className="rounded text-red-500 focus:ring-red-400"
                                                />
                                                <span>Exclude {opt.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Exclude Specific Events */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Exclude Specific Events (IDs)</label>
                                    <input
                                        type="text"
                                        value={qbState.exclude_event_ids.join(', ')}
                                        onChange={(e) => {
                                            const ids = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                            setQbState({ ...qbState, exclude_event_ids: ids });
                                        }}
                                        className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-emerald-500"
                                        placeholder="Comma-separated event UUIDs"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-0.5">Paste event IDs to manually exclude them from this collection</p>
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
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="block text-xs text-gray-500">Start Date</label>
                                                {formData.fixed_start_date && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, fixed_start_date: '' })}
                                                        className="text-[10px] text-red-500 hover:text-red-600 underline"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            <input
                                                type="date"
                                                value={formData.fixed_start_date}
                                                onChange={(e) => setFormData({ ...formData, fixed_start_date: e.target.value })}
                                                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="block text-xs text-gray-500">End Date</label>
                                                {formData.fixed_end_date && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, fixed_end_date: '' })}
                                                        className="text-[10px] text-red-500 hover:text-red-600 underline"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
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
                                    <p className="text-xs text-gray-500">Collection URL Preview:</p>
                                    <code className="block w-full bg-gray-100 p-2 rounded text-xs text-gray-700 break-all mt-1">
                                        {formData.slug ? `/collections/${formData.slug}` : 'URL will be generated from title'}
                                    </code>
                                </div>
                            </div>
                        </div>

                        {/* --- NEW SEO FIELDS --- */}
                        <div className="border-t pt-4 mt-6">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">SEO & Metadata</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Long Description (Markdown Supported)
                                    </label>
                                    <textarea
                                        value={formData.long_description}
                                        onChange={(e) => setFormData({ ...formData, long_description: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
                                        rows={6}
                                        placeholder="Detailed content for the main body of the collection page..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        SEO Meta Title
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.seo_title}
                                        onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                        placeholder="Defaults to Collection Title if empty"
                                        maxLength={100}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Keep under 60 characters for best results.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        SEO Meta Description
                                    </label>
                                    <textarea
                                        value={formData.seo_description}
                                        onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                        rows={2}
                                        placeholder="Defaults to Subtitle or Description if empty"
                                        maxLength={300}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Keep between 150-160 characters for optimal search snippet display.</p>
                                </div>
                            </div>
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

                        <div className="flex flex-col gap-4">
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

                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="show_on_map"
                                    checked={(formData as any).show_on_map}
                                    onChange={(e) => setFormData({ ...formData, show_on_map: e.target.checked } as any)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <label htmlFor="show_on_map" className="ml-2 text-sm text-gray-700">
                                    Feature on Map
                                </label>
                            </div>
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
        </AdminGuard >
    );
}
