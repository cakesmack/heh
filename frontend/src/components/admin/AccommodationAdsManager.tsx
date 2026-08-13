/**
 * Accommodation Ads Manager Component
 * Reusable dashboard view for managing location-based accommodation advertising slots.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch, locationsAPI } from '@/lib/api';
import { optimizeImage } from '@/utils/imageOptimizer';

// ============================================================
// TYPES
// ============================================================

interface AccommodationAd {
  id: number;
  title: string;
  description: string | null;
  destination_url: string;
  image_url: string;
  location_id: number;
  location_name: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface LocationOption {
  id: number;
  name: string;
  slug: string;
}

// ============================================================
// HELPERS
// ============================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusInfo(ad: AccommodationAd): { label: string; color: string } {
  const today = new Date().toISOString().split('T')[0];
  if (!ad.is_active) return { label: 'Inactive', color: 'bg-gray-100 text-gray-600' };
  if (ad.end_date < today) return { label: 'Expired', color: 'bg-red-50 text-red-600' };
  if (ad.start_date > today) return { label: 'Scheduled', color: 'bg-blue-50 text-blue-600' };
  return { label: 'Live', color: 'bg-emerald-50 text-emerald-700' };
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AccommodationAdsManager() {
  const [ads, setAds] = useState<AccommodationAd[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterLocation, setFilterLocation] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<AccommodationAd | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await locationsAPI.list();
      setLocations(data);
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    }
  }, []);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterLocation) params.append('location_id', filterLocation);
      if (filterStatus) params.append('status', filterStatus);
      const qs = params.toString();
      const data = await apiFetch<AccommodationAd[]>(
        `/api/admin/ads/accommodation${qs ? `?${qs}` : ''}`
      );
      setAds(data);
    } catch (err: any) {
      console.error('Failed to fetch ads:', err);
      setError(err.message || 'Failed to load accommodation ads');
    } finally {
      setLoading(false);
    }
  }, [filterLocation, filterStatus]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/api/admin/ads/accommodation/${id}`, { method: 'DELETE' });
      setDeletingId(null);
      fetchAds();
    } catch (err: any) {
      setError(err.message || 'Failed to delete ad');
    }
  };

  const openCreate = () => {
    setEditingAd(null);
    setModalOpen(true);
  };

  const openEdit = (ad: AccommodationAd) => {
    setEditingAd(ad);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Accommodation Ads</h2>
          <p className="text-gray-500 text-sm mt-1">
            Manage accommodation advertising slots for location pages. Maximum 3 concurrent ads per location.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors shadow-sm text-sm shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Ad
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
        >
          <option value="">All Locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="expired">Expired</option>
        </select>
        <span className="self-center text-sm text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full font-medium">
          {ads.length} ad{ads.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-20 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : ads.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No accommodation ads found.</p>
          <button
            onClick={openCreate}
            className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium text-sm"
          >
            Create your first ad â†’
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ad</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ads.map((ad) => {
                  const status = getStatusInfo(ad);
                  return (
                    <tr key={ad.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                            {ad.image_url ? (
                              <img
                                src={optimizeImage(ad.image_url, 112)}
                                alt={ad.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 text-sm truncate max-w-[200px]">{ad.title}</div>
                            <a
                              href={ad.destination_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-400 hover:text-emerald-600 truncate max-w-[200px] block"
                            >
                              {ad.destination_url}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-700 font-medium">
                          {ad.location_name || `ID: ${ad.location_id}`}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-gray-600">
                          {formatDate(ad.start_date)}
                        </div>
                        <div className="text-xs text-gray-400">
                          â†’ {formatDate(ad.end_date)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(ad)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          {deletingId === ad.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(ad.id)}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingId(ad.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <AdFormModal
          ad={editingAd}
          locations={locations}
          onClose={() => {
            setModalOpen(false);
            setEditingAd(null);
          }}
          onSaved={() => {
            setModalOpen(false);
            setEditingAd(null);
            fetchAds();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// CREATE / EDIT MODAL
// ============================================================

interface AdFormModalProps {
  ad: AccommodationAd | null;
  locations: LocationOption[];
  onClose: () => void;
  onSaved: () => void;
}

function AdFormModal({ ad, locations, onClose, onSaved }: AdFormModalProps) {
  const isEditing = !!ad;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(ad?.title || '');
  const [description, setDescription] = useState(ad?.description || '');
  const [destinationUrl, setDestinationUrl] = useState(ad?.destination_url || '');
  const [locationId, setLocationId] = useState<string>(ad?.location_id?.toString() || '');
  const [startDate, setStartDate] = useState(ad?.start_date || '');
  const [endDate, setEndDate] = useState(ad?.end_date || '');
  const [isActive, setIsActive] = useState(ad?.is_active ?? true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    ad?.image_url ? optimizeImage(ad.image_url, 400) : null
  );

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validation
    if (!title.trim()) return setFormError('Title is required.');
    if (!destinationUrl.trim()) return setFormError('Destination URL is required.');
    if (!locationId) return setFormError('Please select a location.');
    if (!startDate) return setFormError('Start date is required.');
    if (!endDate) return setFormError('End date is required.');
    if (endDate <= startDate) return setFormError('End date must be after start date.');
    if (!isEditing && !imageFile) return setFormError('Image is required for new ads.');

    setSubmitting(true);

    try {
      let formattedUrl = destinationUrl.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('destination_url', formattedUrl);
      formData.append('location_id', locationId);
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      if (description.trim()) formData.append('description', description.trim());

      if (isEditing) {
        formData.append('is_active', String(isActive));
      }

      if (imageFile) {
        formData.append('image', imageFile);
      }

      const token = getAuthToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = isEditing
        ? `${API_BASE_URL}/api/admin/ads/accommodation/${ad!.id}`
        : `${API_BASE_URL}/api/admin/ads/accommodation`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }));
        const errorMessage =
          typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail || errorData);
        throw new Error(errorMessage);
      }

      onSaved();
    } catch (err: any) {
      console.error('Failed to save ad:', err);
      setFormError(err.message || 'Failed to save ad. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl z-10 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {isEditing ? 'Edit Ad' : 'Create Accommodation Ad'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Banner */}
          {formError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-start gap-2">
              <svg className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formError}</span>
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ad Image {!isEditing && <span className="text-red-500">*</span>}
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-full h-40 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-400 bg-gray-50 hover:bg-emerald-50/30 transition-all cursor-pointer overflow-hidden group"
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                    <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-3 py-1.5 rounded-lg">
                      Change Image
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 group-hover:text-emerald-500 transition-colors">
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium">Click to upload image</span>
                  <span className="text-xs mt-1">JPG, PNG, WebP</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Highland Lodge B&B"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description for the ad..."
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow resize-none"
              maxLength={1000}
            />
          </div>

          {/* Destination URL */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Destination URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="example-bnb.co.uk"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Location <span className="text-red-500">*</span>
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow bg-white"
            >
              <option value="">Select a location...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
              />
            </div>
          </div>

          {/* Active Toggle (Edit mode only) */}
          {isEditing && (
            <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl">
              <div>
                <span className="text-sm font-semibold text-gray-700">Active</span>
                <p className="text-xs text-gray-500 mt-0.5">Toggle ad visibility on the location page</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
          )}

          {/* Slot Limit Info */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Maximum of <strong>3 ads</strong> can run concurrently for the same location during overlapping dates.
              The system will reject ads that exceed this limit.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 rounded-xl transition-colors shadow-sm flex items-center gap-2"
            >
              {submitting && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {submitting ? 'Saving...' : isEditing ? 'Update Ad' : 'Create Ad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
