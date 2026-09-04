/**
 * Admin Collections Page
 * CRUD interface for managing curated collections
 */

import { useEffect, useState, useRef } from 'react';


import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import OptimizedImage from '@/components/ui/OptimizedImage';
import ImageUpload from '@/components/common/ImageUpload';
import { collectionsAPI, categoriesAPI, tagsAPI, eventsAPI, organizersAPI } from '@/lib/api';
import { AGE_RESTRICTION_OPTIONS } from '@/lib/ageRestriction';
import type { Collection, Category, EventResponse, Organizer } from '@/types';

export default function CollectionsManager() {
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
        badge_text: '',
        external_link_url: '',
        external_link_label: '',
        stat_1_label: '',
        stat_1_value: '',
        stat_2_label: '',
        stat_2_value: '',
        stat_3_label: '',
        stat_3_value: '',
        enable_venue_filter: false,
        organizer_profile_ids: [] as string[],
    });
    const slugManuallyEdited = useRef(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duplicateCollection, setDuplicateCollection] = useState<Collection | null>(null);

    // Event preview state for exclude management
    const [previewEvents, setPreviewEvents] = useState<EventResponse[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewLoaded, setPreviewLoaded] = useState(false);

    // Query Builder State
    const [categories, setCategories] = useState<Category[]>([]);
    const [organizers, setOrganizers] = useState<Organizer[]>([]);
    const [organizerSearch, setOrganizerSearch] = useState('');
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
                collectionsAPI.list({ include_inactive: true }),
                categoriesAPI.list(true),
            ]);
            setCollections(colRes);
            setCategories(catRes.categories || []);

            let allOrganizers: Organizer[] = [];
            let skip = 0;
            const limit = 100;
            while (true) {
                const orgRes = await organizersAPI.list({ skip, limit });
                const batch = orgRes?.organizers || [];
                allOrganizers = [...allOrganizers, ...batch];
                if (batch.length < limit || allOrganizers.length >= (orgRes?.total ?? 0)) {
                    break;
                }
                skip += limit;
            }
            setOrganizers(allOrganizers);
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
            badge_text: '',
            external_link_url: '',
            external_link_label: '',
            stat_1_label: '',
            stat_1_value: '',
            stat_2_label: '',
            stat_2_value: '',
            stat_3_label: '',
            stat_3_value: '',
            enable_venue_filter: false,
            organizer_profile_ids: [],
        });
        setOrganizerSearch('');
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
        setDuplicateCollection(null);
        setPreviewEvents([]);
        setPreviewLoaded(false);
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
        setDuplicateCollection(null);
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
            badge_text: collection.badge_text || '',
            external_link_url: collection.external_link_url || '',
            external_link_label: collection.external_link_label || '',
            stat_1_label: collection.stat_1_label || '',
            stat_1_value: collection.stat_1_value || '',
            stat_2_label: collection.stat_2_label || '',
            stat_2_value: collection.stat_2_value || '',
            stat_3_label: collection.stat_3_label || '',
            stat_3_value: collection.stat_3_value || '',
            enable_venue_filter: collection.enable_venue_filter ?? false,
            organizer_profile_ids: collection.organizer_profile_ids || [],
        });
        setOrganizerSearch('');

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
        setPreviewEvents([]);
        setPreviewLoaded(false);
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

        if (formData.organizer_profile_ids && formData.organizer_profile_ids.length > 0) {
            filterObj.organizer_profile_ids = formData.organizer_profile_ids;
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
    }, [qbState, modalOpen, formData.fixed_start_date, formData.fixed_end_date, formData.organizer_profile_ids, categories]);

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
            if (finalFormData.organizer_profile_ids && finalFormData.organizer_profile_ids.length === 0) {
                finalFormData.organizer_profile_ids = null as any;
            }
            if (finalFormData.filter_params) {
                finalFormData.filter_params = { ...finalFormData.filter_params };
            }
            // Tag filtering has been removed via directive; clean old tag_ids explicitly upon saving
            if (finalFormData.filter_params && finalFormData.filter_params.tag_ids) {
                delete finalFormData.filter_params.tag_ids;
            }

            const targetSlug = (finalFormData.slug || slugify(finalFormData.title)).trim().toLowerCase();
            if (!editingCollection) {
                const duplicate = collections.find(c => c.slug?.toLowerCase() === targetSlug);
                if (duplicate) {
                    setError(`A collection with the slug "${targetSlug}" already exists ("${duplicate.title}"). You can switch to editing that collection or choose a different slug.`);
                    setDuplicateCollection(duplicate);
                    setSaving(false);
                    return;
                }
            } else {
                const duplicate = collections.find(c => c.slug?.toLowerCase() === targetSlug && c.id !== editingCollection.id);
                if (duplicate) {
                    setError(`A collection with the slug "${targetSlug}" already exists ("${duplicate.title}"). Please choose a different slug.`);
                    setDuplicateCollection(duplicate);
                    setSaving(false);
                    return;
                }
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
            const targetSlug = (formData.slug || slugify(formData.title)).trim().toLowerCase();
            const duplicate = collections.find(c => c.slug?.toLowerCase() === targetSlug && c.id !== editingCollection?.id);
            if (duplicate) {
                setDuplicateCollection(duplicate);
            }
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
        <div>
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
                    size="full"
                >
                    <form onSubmit={handleSubmit} className="space-y-6">
    {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>{error}</span>
            {duplicateCollection && (
                <button
                    type="button"
                    onClick={() => {
                        setEditingCollection(duplicateCollection);
                        setDuplicateCollection(null);
                        setError(null);
                    }}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-md hover:bg-red-700 transition-colors shrink-0"
                >
                    Edit Existing &ldquo;{duplicateCollection.title}&rdquo;
                </button>
            )}
        </div>
    )}

    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 text-left">
        {/* --- Left Column --- */}
        <div className="lg:col-span-3 space-y-4">
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
                            {!editingCollection && formData.slug && collections.some(c => c.slug?.toLowerCase() === formData.slug?.toLowerCase()) && (
                                <p className="text-xs text-amber-600 font-medium mt-1">
                                    ⚠️ A collection with this slug already exists (&ldquo;{collections.find(c => c.slug?.toLowerCase() === formData.slug?.toLowerCase())?.title}&rdquo;).
                                </p>
                            )}
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
        </div>
        {/* --- Right Column --- */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3 text-left">Featured Image</h4>
                {/* Collection Image */}
                        <ImageUpload
                            folder="categories" // Reusing categories folder for now
                            currentImageUrl={formData.image_url}
                            onUpload={handleImageUpload}
                            onRemove={handleImageRemove}
                            aspectRatio="16/9"
                        />
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-medium text-gray-700">
                                    Filter Configuration
                                </label>
                            </div>

                            <div className="space-y-3">
                                {/* Enable Venue Filter */}
                                <div className="pb-3 border-b border-gray-200">
                                    <label htmlFor="enable_venue_filter" className="flex items-start space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            id="enable_venue_filter"
                                            checked={!!formData.enable_venue_filter}
                                            onChange={(e) => setFormData({ ...formData, enable_venue_filter: e.target.checked })}
                                            className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300"
                                        />
                                        <div>
                                            <span className="text-sm font-medium text-gray-700">Enable Venue Filter</span>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Dynamically generates a venue dropdown filter on the public collection page. Ideal for multi-venue festivals.
                                            </p>
                                        </div>
                                    </label>
                                </div>

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

                                {/* Organizers Filter */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-medium text-gray-500">
                                            Organizers {(formData.organizer_profile_ids || []).length > 0 && (
                                                <span className="ml-1 px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded-full font-semibold">
                                                    {(formData.organizer_profile_ids || []).length}
                                                </span>
                                            )}
                                        </label>
                                        {(formData.organizer_profile_ids || []).length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, organizer_profile_ids: [] }))}
                                                className="text-xs text-red-500 hover:text-red-700"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={organizerSearch}
                                        onChange={(e) => setOrganizerSearch(e.target.value)}
                                        className="w-full mb-1 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-emerald-500"
                                        placeholder="Search organizers..."
                                    />
                                    <div className="max-h-36 overflow-y-auto border rounded p-2 space-y-1 bg-gray-50">
                                        {organizers
                                            .filter(org => !organizerSearch || org.name.toLowerCase().includes(organizerSearch.toLowerCase()))
                                            .map(org => {
                                                const selected = (formData.organizer_profile_ids || []).includes(org.id);
                                                return (
                                                    <label key={org.id} className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer hover:bg-white px-1 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={selected}
                                                            onChange={(e) => {
                                                                const current = formData.organizer_profile_ids || [];
                                                                const updated = e.target.checked
                                                                    ? [...current, org.id]
                                                                    : current.filter(id => id !== org.id);
                                                                setFormData(prev => ({ ...prev, organizer_profile_ids: updated }));
                                                            }}
                                                            className="rounded text-emerald-600 focus:ring-emerald-500"
                                                        />
                                                        <span className="truncate">{org.name}</span>
                                                    </label>
                                                );
                                            })}
                                        {organizers.filter(org => !organizerSearch || org.name.toLowerCase().includes(organizerSearch.toLowerCase())).length === 0 && (
                                            <p className="text-xs text-gray-400 py-1 text-center">No organizers found</p>
                                        )}
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

                                {/* Exclude Specific Events - Visual Preview */}
                                <div className="pt-3 border-t border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-medium text-gray-500">Exclude Specific Events</label>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                setPreviewLoading(true);
                                                try {
                                                    // Build filters from current qbState (without excludes, so we see all matches)
                                                    const filters: Record<string, any> = { limit: 100 };
                                                    if (qbState.category.length > 0) filters.category_ids = qbState.category;
                                                    if (formData.organizer_profile_ids && formData.organizer_profile_ids.length > 0) {
                                                        filters.organizer_profile_ids = formData.organizer_profile_ids.join(',');
                                                    }
                                                    if (qbState.q) filters.q = qbState.q;
                                                    if (qbState.combine_operator) filters.combine_operator = qbState.combine_operator;
                                                    if (qbState.age) filters.age_restriction = qbState.age;
                                                    if (qbState.price === 'free') filters.price_max = 0;
                                                    if (qbState.exclude_age_restrictions.length > 0) filters.exclude_age_restrictions = qbState.exclude_age_restrictions;
                                                    const res = await eventsAPI.list(filters);
                                                    setPreviewEvents(res.events);
                                                    setPreviewLoaded(true);
                                                } catch (err) {
                                                    console.error('Failed to preview events:', err);
                                                } finally {
                                                    setPreviewLoading(false);
                                                }
                                            }}
                                            className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                                        >
                                            {previewLoading ? 'Loading...' : previewLoaded ? 'â†» Refresh Preview' : 'ðŸ‘ Preview Events'}
                                        </button>
                                    </div>

                                    {qbState.exclude_event_ids.length > 0 && (
                                        <p className="text-xs text-amber-600 mb-2">
                                            {qbState.exclude_event_ids.length} event{qbState.exclude_event_ids.length !== 1 ? 's' : ''} excluded
                                        </p>
                                    )}

                                    {previewLoaded && (
                                        <div className="max-h-60 overflow-y-auto border rounded bg-gray-50 divide-y divide-gray-200">
                                            {previewEvents.length === 0 ? (
                                                <p className="text-xs text-gray-400 p-3 text-center">No events match the current filters.</p>
                                            ) : (
                                                previewEvents.map(ev => {
                                                    const isExcluded = qbState.exclude_event_ids.includes(ev.id);
                                                    return (
                                                        <div
                                                            key={ev.id}
                                                            className={`flex items-center justify-between px-3 py-2 text-sm ${
                                                                isExcluded ? 'bg-red-50 opacity-60' : 'bg-white'
                                                            }`}
                                                        >
                                                            <div className="flex-1 min-w-0 mr-2">
                                                                <p className={`font-medium truncate ${isExcluded ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                                                    {ev.title}
                                                                </p>
                                                                <p className="text-[10px] text-gray-400 truncate">
                                                                    {ev.category?.name || 'Uncategorised'}
                                                                    {ev.age_restriction ? ` Â· ${ev.age_restriction.replace('_', ' ').replace('plus', '+')}` : ''}
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (isExcluded) {
                                                                        setQbState({
                                                                            ...qbState,
                                                                            exclude_event_ids: qbState.exclude_event_ids.filter(id => id !== ev.id)
                                                                        });
                                                                    } else {
                                                                        setQbState({
                                                                            ...qbState,
                                                                            exclude_event_ids: [...qbState.exclude_event_ids, ev.id]
                                                                        });
                                                                    }
                                                                }}
                                                                className={`shrink-0 text-xs px-2 py-1 rounded transition-colors ${
                                                                    isExcluded
                                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                                }`}
                                                            >
                                                                {isExcluded ? 'âœ“ Include' : 'âœ• Exclude'}
                                                            </button>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Custom Date Range */}
                                <div className="pt-3 border-t border-gray-200">
                                    <label className="block text-xs font-medium text-gray-500 mb-2">
                                        ðŸ“… Custom Date Range (Optional)
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

            {/* --- NEW HERO CUSTOMIZATION ACCORDION --- */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden text-left">
                <details className="group">
                    <summary className="flex justify-between items-center font-medium cursor-pointer list-none p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <span className="text-sm text-gray-900">Hero Customization & Stats (Optional)</span>
                        <span className="transition group-open:rotate-180">
                            <svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                        </span>
                    </summary>
                    <div className="p-4 space-y-4 border-t border-gray-200 text-sm">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Badge Text</label>
                            <input
                                type="text"
                                value={formData.badge_text || ''}
                                onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                                className="w-full px-2 py-1.5 border rounded focus:ring-1 focus:ring-emerald-500"
                                placeholder="e.g. FESTIVAL COLLECTION"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">External Link URL</label>
                                <input
                                    type="text"
                                    value={formData.external_link_url || ''}
                                    onChange={(e) => setFormData({ ...formData, external_link_url: e.target.value })}
                                    className="w-full px-2 py-1.5 border rounded focus:ring-1 focus:ring-emerald-500"
                                    placeholder="https://..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">External Link Label</label>
                                <input
                                    type="text"
                                    value={formData.external_link_label || ''}
                                    onChange={(e) => setFormData({ ...formData, external_link_label: e.target.value })}
                                    className="w-full px-2 py-1.5 border rounded focus:ring-1 focus:ring-emerald-500"
                                    placeholder="e.g. Get Tickets"
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t">
                            <label className="block text-xs font-medium text-gray-500 mb-2">Stats (Optional)</label>
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" placeholder="Stat 1 Label (e.g. Days)" value={formData.stat_1_label || ''} onChange={(e) => setFormData({ ...formData, stat_1_label: e.target.value })} className="w-full px-2 py-1.5 border rounded" />
                                    <input type="text" placeholder="Stat 1 Value (e.g. 3)" value={formData.stat_1_value || ''} onChange={(e) => setFormData({ ...formData, stat_1_value: e.target.value })} className="w-full px-2 py-1.5 border rounded" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" placeholder="Stat 2 Label" value={formData.stat_2_label || ''} onChange={(e) => setFormData({ ...formData, stat_2_label: e.target.value })} className="w-full px-2 py-1.5 border rounded" />
                                    <input type="text" placeholder="Stat 2 Value" value={formData.stat_2_value || ''} onChange={(e) => setFormData({ ...formData, stat_2_value: e.target.value })} className="w-full px-2 py-1.5 border rounded" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" placeholder="Stat 3 Label" value={formData.stat_3_label || ''} onChange={(e) => setFormData({ ...formData, stat_3_label: e.target.value })} className="w-full px-2 py-1.5 border rounded" />
                                    <input type="text" placeholder="Stat 3 Value" value={formData.stat_3_value || ''} onChange={(e) => setFormData({ ...formData, stat_3_value: e.target.value })} className="w-full px-2 py-1.5 border rounded" />
                                </div>
                            </div>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    </div>

    <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
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
            </div>
    );
}
