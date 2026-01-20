/**
 * Admin Venues Page
 * CRUD interface for managing venues with search, image upload, postcode lookup, and map
 */

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import DataTable from '@/components/admin/DataTable';
import Modal from '@/components/admin/Modal';
import ImageUpload from '@/components/common/ImageUpload';
import PlacesAutocomplete from '@/components/maps/PlacesAutocomplete';
import { venuesAPI, analyticsAPI, venueInvitesAPI } from '@/lib/api';
import { isHIERegion } from '@/utils/validation/hie-check';
import { VenueCategory, VenueAnalyticsSummary } from '@/types';
import type { VenueResponse } from '@/types';

// Dynamic import for GoogleMiniMap to avoid SSR issues
const GoogleMiniMap = dynamic(() => import('@/components/maps/GoogleMiniMap'), { ssr: false });

// Dynamic import for UnifiedVenueSelect to avoid SSR issues
const UnifiedVenueSelect = dynamic<any>(() => import('@/components/venues/UnifiedVenueSelect').then(mod => mod.UnifiedVenueSelect), { ssr: false });

export default function AdminVenues() {
  const [venues, setVenues] = useState<VenueResponse[]>([]);
  const [categories, setCategories] = useState<VenueCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<VenueResponse | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    postcode: '',
    address_full: '',
    latitude: 57.48,
    longitude: -4.22,
    category_id: '',
    description: '',
    website: '',
    phone: '',
    email: '',
    opening_hours: '',
    image_url: '',
    // Amenities
    is_dog_friendly: false,
    has_wheelchair_access: false,
    has_parking: false,
    serves_food: false,
    amenities_notes: '',
    // Social Media
    social_facebook: '',
    social_instagram: '',
    social_x: '',
    social_linkedin: '',
    social_tiktok: '',
    website_url: '',
  });
  const [isPostcodeValid, setIsPostcodeValid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting state
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'activity'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Stats Modal State
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [viewingStatsVenue, setViewingStatsVenue] = useState<VenueResponse | null>(null);
  const [venueStats, setVenueStats] = useState<VenueAnalyticsSummary | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Invite Owner Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitingVenue, setInvitingVenue] = useState<VenueResponse | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Merge Modal State
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergingSourceVenue, setMergingSourceVenue] = useState<VenueResponse | null>(null);
  const [mergeTargetVenue, setMergeTargetVenue] = useState<VenueResponse | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  useEffect(() => {
    if (viewingStatsVenue && statsModalOpen) {
      const fetchStats = async () => {
        setLoadingStats(true);
        try {
          const data = await analyticsAPI.getVenueStats(viewingStatsVenue.id, 30);
          setVenueStats(data);
        } catch (err) {
          console.error('Failed to fetch venue stats:', err);
        } finally {
          setLoadingStats(false);
        }
      };
      fetchStats();
    }
  }, [viewingStatsVenue, statsModalOpen]);

  const openStatsModal = (venue: VenueResponse) => {
    setViewingStatsVenue(venue);
    setVenueStats(null);
    setStatsModalOpen(true);
  };

  const openInviteModal = (venue: VenueResponse) => {
    setInvitingVenue(venue);
    setInviteEmail('');
    setInviteSuccess(null);
    setInviteModalOpen(true);
  };

  const handleSendInvite = async () => {
    if (!invitingVenue || !inviteEmail) return;
    setSendingInvite(true);
    try {
      await venueInvitesAPI.create(invitingVenue.id, inviteEmail);
      setInviteSuccess(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err: any) {
      alert(err.message || 'Failed to send invite');
    } finally {
      setSendingInvite(false);
    }
  };

  const openMergeModal = (venue: VenueResponse) => {
    setMergingSourceVenue(venue);
    setMergeTargetVenue(null);
    setMergeModalOpen(true);
  };

  const handleMerge = async () => {
    if (!mergingSourceVenue || !mergeTargetVenue) return;

    // Debugging: Check what we are about to send
    console.log('Merging:', {
      source: mergingSourceVenue,
      target: mergeTargetVenue,
      targetId: mergeTargetVenue.id
    });

    if (!mergeTargetVenue.id) {
      alert('Error: Target venue has no ID. Please re-select the venue.');
      return;
    }

    if (!confirm(`WARNING: This will permanently delete "${mergingSourceVenue.name}" and move all its data to "${mergeTargetVenue.name}". This action cannot be undone.\n\nAre you sure?`)) {
      return;
    }

    setIsMerging(true);
    try {
      const result = await venuesAPI.merge(mergingSourceVenue.id, mergeTargetVenue.id);
      alert(`Success: ${result.message}. Moved ${result.events_moved} events.`);
      setMergeModalOpen(false);
      fetchVenues(); // Refresh table
    } catch (err: any) {
      console.error('Merge error:', err);
      alert(err.message || 'Merge failed');
    } finally {
      setIsMerging(false);
    }
  };

  const fetchVenues = useCallback(async () => {
    setLoading(true);
    try {
      // Use search endpoint if query exists, otherwise list
      // BUT list supports complex filters, search logic might be limited or different
      // If we are just filtering/sorting, we should use 'list'. search is for fuzzy text search.
      // If searchQuery is present, we MIGHT lose other filters if 'search' API doesn't support them.
      // HOWEVER, admin dashboard usually prefers LIST endpoint with filters.
      // Let's assume list endpoint handles everything if we don't have a specific text search?
      // Actually, 'list_venues' doesn't seem to support text search 'q'.
      // Only 'search_venues' supports 'q'.
      // So if 'searchQuery' is active, we use search.
      // If NOT active, we use list with filters.

      if (searchQuery && searchQuery.length >= 2) {
        // Search API currently doesn't support status/category filters (based on backend code)
        // We might want to fix that later, but for now behave as is.
        const response = await venuesAPI.search(searchQuery, 50);
        setVenues(response.venues);
        setTotal(response.total);
      } else {
        const response = await venuesAPI.list({
          limit: 100,
          status: filterStatus || undefined,
          category_id: filterCategory || undefined,
          sort_by: sortBy,
          sort_dir: sortDir
        });
        setVenues(response.venues);
        setTotal(response.total);
      }
    } catch (err) {
      console.error('Failed to fetch venues:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterStatus, filterCategory, sortBy, sortDir]);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await venuesAPI.listCategories();
      setCategories(cats);
      // Set default category if creating new
      if (cats.length > 0 && !formData.category_id) {
        setFormData(prev => ({ ...prev, category_id: cats[0].id }));
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchVenues();
    fetchCategories();
  }, [fetchVenues, fetchCategories]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only fetch if query changed significantly or is empty
      fetchVenues();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const openCreateModal = () => {
    setEditingVenue(null);
    setFormData({
      name: '',
      address: '',
      postcode: '',
      address_full: '',
      latitude: 57.48,
      longitude: -4.22,
      category_id: categories.length > 0 ? categories[0].id : '',
      description: '',
      website: '',
      phone: '',
      email: '',
      opening_hours: '',
      image_url: '',
      is_dog_friendly: false,
      has_wheelchair_access: false,
      has_parking: false,
      serves_food: false,
      amenities_notes: '',
      social_facebook: '',
      social_instagram: '',
      social_x: '',
      social_linkedin: '',
      social_tiktok: '',
      website_url: '',
    });
    setError(null);
    setIsPostcodeValid(true);
    setModalOpen(true);
  };

  const openEditModal = (venue: VenueResponse) => {
    setEditingVenue(venue);
    setFormData({
      name: venue.name,
      address: venue.address,
      postcode: venue.postcode || '',
      address_full: venue.address_full || '',
      latitude: venue.latitude,
      longitude: venue.longitude,
      category_id: venue.category_id || (venue.category?.id || ''),
      description: venue.description || '',
      website: venue.website || '',
      phone: venue.phone || '',
      email: venue.email || '',
      opening_hours: venue.opening_hours || '',
      image_url: venue.image_url || '',
      is_dog_friendly: (venue as any).is_dog_friendly || false,
      has_wheelchair_access: (venue as any).has_wheelchair_access || false,
      has_parking: (venue as any).has_parking || false,
      serves_food: (venue as any).serves_food || false,
      amenities_notes: (venue as any).amenities_notes || '',
      social_facebook: venue.social_facebook || '',
      social_instagram: venue.social_instagram || '',
      social_x: venue.social_x || '',
      social_linkedin: venue.social_linkedin || '',
      social_tiktok: venue.social_tiktok || '',
      website_url: venue.website_url || '',
    });
    setError(null);
    setIsPostcodeValid(venue.postcode ? isHIERegion(venue.postcode) : true);
    setModalOpen(true);
  };

  const handleImageUpload = (urls: { url: string }) => {
    setFormData(prev => ({ ...prev, image_url: urls.url }));
  };

  const handleImageRemove = () => {
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
      address_full: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
    }));
    // Validate HIE region using postcode if available
    if (place.postcode) {
      setIsPostcodeValid(isHIERegion(place.postcode));
    } else {
      setIsPostcodeValid(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.postcode && !isHIERegion(formData.postcode)) {
      setError('Venue must be located in the Highlands & Islands region');
      setIsPostcodeValid(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        postcode: formData.postcode || undefined,
        address_full: formData.address_full || undefined,
        image_url: formData.image_url || undefined,
      };

      if (editingVenue) {
        await venuesAPI.update(editingVenue.id, payload);
      } else {
        await venuesAPI.create(payload);
      }
      setModalOpen(false);
      fetchVenues();
    } catch (err: any) {
      setError(err.message || 'Failed to save venue');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (venue: VenueResponse) => {
    if (!confirm(`Are you sure you want to delete "${venue.name}"?`)) return;

    try {
      await venuesAPI.delete(venue.id);
      fetchVenues();
    } catch (err: any) {
      alert(err.message || 'Failed to delete venue');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (v: VenueResponse) => (
        <div className="flex items-center">
          {v.image_url ? (
            <img
              src={v.image_url}
              alt={v.name}
              className="w-10 h-10 rounded object-cover mr-3"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-gray-200 mr-3 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
          )}
          <span className="font-medium">{v.name}</span>
        </div>
      ),
    },
    { key: 'address', header: 'Address' },
    {
      key: 'category',
      header: 'Category',
      render: (v: VenueResponse) => (
        <span className="capitalize">
          {v.category?.name || categories.find(c => c.id === v.category_id)?.name || 'Unknown'}
        </span>
      )
    },

    { key: 'upcoming_events_count', header: 'Events' },
    {
      key: 'actions',
      header: 'Actions',
      render: (v: VenueResponse) => (
        <button
          onClick={(e) => { e.stopPropagation(); openStatsModal(v); }}
          className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100"
        >
          Stats
        </button>
      )
    },
  ];

  return (
    <AdminGuard>
      <AdminLayout title="Venues">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between">
              <p className="text-gray-600">Manage venues ({total} total)</p>
              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Add Venue
              </button>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {/* Search */}
              <div className="relative flex-grow max-w-md">
                <input
                  type="text"
                  placeholder="Search venues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Statuses</option>
                <option value="VERIFIED">Verified</option>
                <option value="UNVERIFIED">Unverified</option>
                <option value="ARCHIVED">Archived</option>
              </select>

              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Venues Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
            </div>
          ) : venues.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? `No venues found matching "${searchQuery}"` : 'No venues found'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="text-left py-3 px-4 font-medium text-gray-600 text-sm cursor-pointer hover:bg-gray-100"
                    onClick={() => {
                      if (sortBy === 'name') {
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('name');
                        setSortDir('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortBy === 'name' && (
                        <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Manager</th>
                  <th
                    className="text-left py-3 px-4 font-medium text-gray-600 text-sm cursor-pointer hover:bg-gray-100"
                    onClick={() => {
                      if (sortBy === 'activity') {
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('activity');
                        setSortDir('desc'); // Default to high activity
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Events
                      {sortBy === 'activity' && (
                        <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {venues.map((venue) => (
                  <tr
                    key={venue.id}
                    onClick={() => window.open(`/venues/${venue.id}`, '_blank')}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        {venue.image_url ? (
                          <img src={venue.image_url} alt={venue.name} className="w-10 h-10 rounded object-cover mr-3" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-200 mr-3 flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-gray-900 block">{venue.name}</span>
                          <span className="text-xs text-gray-500">{venue.address || ''}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      <span className="capitalize">
                        {venue.category?.name || categories.find(c => c.id === venue.category_id)?.name || ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {venue.owner_email ? (
                        <span className="text-emerald-600 font-medium">{venue.owner_email.split('@')[0]}</span>
                      ) : (
                        <span className="text-gray-400 italic">Unclaimed</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-sm">
                        {venue.upcoming_events_count || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openStatsModal(venue); }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50"
                        >
                          Stats
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(venue); }}
                          className="text-xs text-gray-600 hover:text-emerald-600 px-2 py-1 rounded hover:bg-gray-100"
                        >
                          Edit
                        </button>
                        {!venue.owner_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openInviteModal(venue); }}
                            className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-50"
                          >
                            Invite Owner
                          </button>
                        )}
                        {venue.owner_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openInviteModal(venue); }}
                            className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 rounded hover:bg-purple-50"
                          >
                            Change Owner
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(venue); }}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                        >
                          Delete
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openMergeModal(venue); }}
                          className="text-xs text-orange-600 hover:text-orange-800 px-2 py-1 rounded hover:bg-orange-50"
                          title="Merge duplicate into another venue"
                        >
                          Merge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingVenue ? 'Edit Venue' : 'Add Venue'}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Venue Image */}
            <ImageUpload
              folder="venues"
              currentImageUrl={formData.image_url}
              onUpload={handleImageUpload}
              onRemove={handleImageRemove}
              aspectRatio="16/9"
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Google Places Autocomplete */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Find Address</label>
                <PlacesAutocomplete onSelect={handlePlaceSelect} placeholder="Search for venue address..." />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                <input
                  type="text"
                  value={formData.postcode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, postcode: val });
                    setIsPostcodeValid(val ? isHIERegion(val) : true);
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${!isPostcodeValid ? 'border-red-500 focus:ring-red-500' : 'focus:ring-emerald-500'
                    }`}
                  placeholder="e.g., IV1 1AA"
                />
                {!isPostcodeValid && (
                  <p className="text-xs text-red-600 mt-1">
                    Venue must be located in the Highlands & Islands region
                  </p>
                )}
              </div>



              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude *</label>
                <input
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude *</label>
                <input
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Map Preview */}
              {formData.latitude && formData.longitude && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location Preview</label>
                  <GoogleMiniMap
                    latitude={formData.latitude}
                    longitude={formData.longitude}
                    height="150px"
                    zoom={13}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="contact@venue.com"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="https://"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Hours</label>
                <textarea
                  value={formData.opening_hours}
                  onChange={(e) => setFormData({ ...formData, opening_hours: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                  placeholder="Mon-Fri: 9am-5pm&#10;Sat: 10am-4pm&#10;Sun: Closed"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                />
                <p className="mt-1 text-xs text-gray-500">URLs pasted here will automatically become clickable links on the site.</p>
              </div>

              {/* Social Media */}
              <div className="col-span-2 pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-3">Social Media Links</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="url"
                    value={formData.social_facebook}
                    onChange={(e) => setFormData({ ...formData, social_facebook: e.target.value })}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="Facebook URL"
                  />
                  <input
                    type="url"
                    value={formData.social_instagram}
                    onChange={(e) => setFormData({ ...formData, social_instagram: e.target.value })}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="Instagram URL"
                  />
                  <input
                    type="url"
                    value={formData.social_x}
                    onChange={(e) => setFormData({ ...formData, social_x: e.target.value })}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="X (Twitter) URL"
                  />
                  <input
                    type="url"
                    value={formData.social_linkedin}
                    onChange={(e) => setFormData({ ...formData, social_linkedin: e.target.value })}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="LinkedIn URL"
                  />
                  <input
                    type="url"
                    value={formData.social_tiktok}
                    onChange={(e) => setFormData({ ...formData, social_tiktok: e.target.value })}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="TikTok URL"
                  />
                  <input
                    type="url"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="Additional Website URL"
                  />
                </div>
              </div>

              {/* Amenities */}
              <div className="col-span-2 pt-4 border-t">
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                    rows={2}
                    placeholder="Additional details about accessibility, parking, etc."
                  />
                </div>
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
                disabled={saving || !isPostcodeValid}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingVenue ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>


        {/* Merge Modal */}
        <Modal
          isOpen={mergeModalOpen}
          onClose={() => setMergeModalOpen(false)}
          title="Merge Duplicate Venue"
          size="lg"
        >
          <div className="p-4 space-y-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.742-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    You are merging <strong>{mergingSourceVenue?.name}</strong>.
                    Selected target venue will receive all data, and this duplicate will be <strong>permanently deleted</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Target Master Venue
              </label>
              <UnifiedVenueSelect
                value={mergeTargetVenue?.id || null}
                onChange={(_id, venue) => setMergeTargetVenue(venue)}
                placeholder="Search for internal Master Venue..."
                disableGoogle={true}
                excludedVenueId={mergingSourceVenue?.id}
              />
            </div>

            {mergeTargetVenue && (
              <div className="bg-green-50 p-3 rounded-md border border-green-200">
                <p className="text-sm text-green-800">
                  Target: <strong>{mergeTargetVenue.name}</strong> ({(mergeTargetVenue as any).postcode || 'No Postcode'})
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setMergeModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={!mergeTargetVenue || isMerging}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {isMerging ? 'Merging...' : 'Confirm Merge'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Stats Modal */}
        <Modal
          isOpen={statsModalOpen}
          onClose={() => setStatsModalOpen(false)}
          title={`Analytics: ${viewingStatsVenue?.name}`}
          size="lg"
        >
          {loadingStats ? (
            <div className="p-8 text-center text-gray-500">Loading stats...</div>
          ) : venueStats ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900">{venueStats.total_views}</p>
                  <p className="text-xs text-gray-500">Total Views (30d)</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900">{viewingStatsVenue?.upcoming_events_count || 0}</p>
                  <p className="text-xs text-gray-500">Upcoming Events</p>
                </div>
                {/* Using top_events length as proxy for now since total_events isn't in summary */}
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900">{venueStats.top_events.length}</p>
                  <p className="text-xs text-gray-500">Active Events</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900">-</p>
                  <p className="text-xs text-gray-500">Total Bookmarks</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Daily Views</h4>
                <div className="h-32 flex items-end space-x-1 bg-gray-50 p-2 rounded-lg">
                  {venueStats.daily_views.map((day) => {
                    const max = Math.max(...venueStats.daily_views.map(d => d.count), 1);
                    const height = (day.count / max) * 100;
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center group relative">
                        <div
                          className="w-full bg-indigo-300 hover:bg-indigo-500 transition-colors rounded-t"
                          style={{ height: `${height}%` }}
                        />
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs p-1 rounded z-10 whitespace-nowrap">
                          {day.date}: {day.count}
                        </div>
                      </div>
                    );
                  })}
                  {venueStats.daily_views.length === 0 && <div className="w-full text-center text-gray-400 text-sm self-center">No data</div>}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Top Events</h4>
                <div className="space-y-2">
                  {venueStats.top_events.map((event, i) => (
                    <div key={event.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                      <span className="truncate flex-1 mr-2">{i + 1}. {event.title}</span>
                      <span className="font-medium text-gray-900">{event.views} views</span>
                    </div>
                  ))}
                  {venueStats.top_events.length === 0 && <p className="text-sm text-gray-400">No event data yet</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">No data available</div>
          )}
        </Modal>

        {/* Invite Owner Modal */}
        <Modal
          isOpen={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          title={`Invite Owner: ${invitingVenue?.name}`}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Send an email invitation to assign ownership of this venue. The recipient will become the venue owner when they accept.
            </p>

            {inviteSuccess && (
              <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                ✓ {inviteSuccess}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="owner@venue.com"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
              <button
                onClick={handleSendInvite}
                disabled={sendingInvite || !inviteEmail}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {sendingInvite ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </Modal>
      </AdminLayout>
    </AdminGuard >
  );
}
