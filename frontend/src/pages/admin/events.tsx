/**
 * Admin Events Page
 * CRUD interface for managing events with search, clickable rows, and full columns
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import Modal from '@/components/admin/Modal';
import ImageUpload from '@/components/common/ImageUpload';
import DateTimePicker from '@/components/common/DateTimePicker';
import VenueTypeahead from '@/components/venues/VenueTypeahead';
import { eventsAPI, categoriesAPI } from '@/lib/api';
import { AGE_RESTRICTION_OPTIONS } from '@/lib/ageRestriction';
import type { EventResponse, VenueResponse, Category } from '@/types';

export default function AdminEvents() {
  const router = useRouter();
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventResponse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventResponse | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<VenueResponse | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date_start: '',
    date_end: '',
    venue_id: '',
    location_name: '',
    category_id: '',
    price: 0,
    featured: false,
    image_url: '',
    ticket_url: '',
    age_restriction: '',
  });
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [eventsRes, categoriesRes] = await Promise.all([
        eventsAPI.list({ limit: 200, q: searchQuery || undefined }),
        categoriesAPI.list(true),
      ]);
      setEvents(eventsRes.events);
      setFilteredEvents(eventsRes.events);
      setCategories(categoriesRes.categories);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter events based on status (client-side for now, search is server-side)
  useEffect(() => {
    let filtered = events;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }

    setFilteredEvents(filtered);
  }, [statusFilter, events]);

  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setSelectedVenue(null);
    const now = new Date();
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    setFormData({
      title: '',
      description: '',
      date_start: now.toISOString().slice(0, 16),
      date_end: later.toISOString().slice(0, 16),
      venue_id: '',
      location_name: '',
      category_id: categories[0]?.id || '',
      price: 0,
      featured: false,
      image_url: '',
      ticket_url: '',
      age_restriction: '',
    });
    setUseManualLocation(false);
    setError(null);
    setDateError(null);
    setModalOpen(true);
  };

  const openEditModal = (event: EventResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setSelectedVenue(null);
    setFormData({
      title: event.title,
      description: event.description || '',
      date_start: formatDateForInput(event.date_start),
      date_end: formatDateForInput(event.date_end),
      venue_id: event.venue_id || '',
      location_name: event.location_name || '',
      category_id: event.category_id || '',
      price: event.price,
      featured: event.featured,
      image_url: event.image_url || '',
      ticket_url: event.ticket_url || '',
      age_restriction: event.age_restriction || '',
    });
    setUseManualLocation(!event.venue_id && !!event.location_name);
    setError(null);
    setDateError(null);
    setModalOpen(true);
  };

  const handleRowClick = (event: EventResponse) => {
    window.open(`/events/${event.id}`, '_blank');
  };

  const handleVenueChange = (venueId: string, venue: VenueResponse | null) => {
    setFormData(prev => ({ ...prev, venue_id: venueId }));
    setSelectedVenue(venue);
  };

  const handleImageUpload = (urls: { url: string }) => {
    setFormData(prev => ({ ...prev, image_url: urls.url }));
  };

  const handleImageRemove = () => {
    setFormData(prev => ({ ...prev, image_url: '' }));
  };

  const validateDates = () => {
    const start = new Date(formData.date_start);
    const end = new Date(formData.date_end);
    if (end < start) {
      setDateError('End date must be after start date');
      return false;
    }
    setDateError(null);
    return true;
  };

  const handleDateChange = (field: 'date_start' | 'date_end', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setDateError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateDates()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        date_start: new Date(formData.date_start).toISOString(),
        date_end: new Date(formData.date_end).toISOString(),
        venue_id: useManualLocation ? undefined : formData.venue_id,
        location_name: useManualLocation ? formData.location_name : undefined,
        category_id: formData.category_id,
        price: formData.price,
        featured: formData.featured,
        image_url: formData.image_url || undefined,
        ticket_url: formData.ticket_url || undefined,
        age_restriction: formData.age_restriction || undefined,
      };

      if (editingEvent) {
        await eventsAPI.update(editingEvent.id, payload);
      } else {
        await eventsAPI.create(payload);
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: EventResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${event.title}"?`)) return;

    try {
      await eventsAPI.delete(event.id);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete event');
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">Approved</span>;
      case 'pending':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">Rejected</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">—</span>;
    }
  };

  return (
    <AdminGuard>
      <AdminLayout title="Events">
        {/* Search & Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            <span className="text-sm text-gray-500">{filteredEvents.length} events</span>
          </div>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Add Event
          </button>
        </div>

        {/* Events Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? `No events found matching "${searchQuery}"` : 'No events found'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Title</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Creator</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Organizer</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Recurring</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Date</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEvents.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => handleRowClick(event)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        {event.image_url ? (
                          <img src={event.image_url} alt={event.title} className="w-10 h-10 rounded object-cover mr-3" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-200 mr-3 flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-gray-900 block">{event.title}</span>
                          <span className="text-xs text-gray-500">{event.venue_name || event.location_name || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {event.organizer_email?.split('@')[0] || '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {event.organizer_profile_name || '—'}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(event.status)}
                    </td>
                    <td className="py-3 px-4">
                      {event.is_recurring || event.parent_event_id ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800 w-fit">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Series
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(event.date_start).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => openEditModal(event, e)}
                          className="text-xs text-gray-600 hover:text-emerald-600 px-2 py-1 rounded hover:bg-gray-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => handleDelete(event, e)}
                          className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                        >
                          Delete
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
          title={editingEvent ? 'Edit Event' : 'Add Event'}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <ImageUpload
              folder="events"
              currentImageUrl={formData.image_url}
              onUpload={handleImageUpload}
              onRemove={handleImageRemove}
              onUploadStart={() => setUploading(true)}
              onUploadEnd={() => setUploading(false)}
              aspectRatio="16/9"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date/Time *</label>
                <DateTimePicker
                  id="date_start"
                  name="date_start"
                  value={formData.date_start}
                  onChange={(value) => handleDateChange('date_start', value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date/Time *</label>
                <DateTimePicker
                  id="date_end"
                  name="date_end"
                  value={formData.date_end}
                  onChange={(value) => handleDateChange('date_end', value)}
                  min={formData.date_start}
                  required
                />
                {dateError && (
                  <p className="text-sm text-red-600 mt-1">{dateError}</p>
                )}
              </div>

              <div className="col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {useManualLocation ? 'Location Name *' : 'Venue *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setUseManualLocation(!useManualLocation);
                      setFormData(prev => ({ ...prev, venue_id: '', location_name: '' }));
                      setSelectedVenue(null);
                    }}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    {useManualLocation ? 'Select existing venue' : 'Enter location manually'}
                  </button>
                </div>

                {useManualLocation ? (
                  <input
                    type="text"
                    value={formData.location_name}
                    onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., Inverness Castle Grounds"
                    required
                  />
                ) : (
                  <VenueTypeahead
                    value={formData.venue_id}
                    onChange={handleVenueChange}
                    placeholder="Search for a venue..."
                    disabled={saving}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (GBP)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticket URL</label>
                <input
                  type="url"
                  value={formData.ticket_url}
                  onChange={(e) => setFormData({ ...formData, ticket_url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="https://tickets.example.com/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age Restriction</label>
                <select
                  value={formData.age_restriction}
                  onChange={(e) => setFormData({ ...formData, age_restriction: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  {AGE_RESTRICTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center pt-6">
                <input
                  type="checkbox"
                  id="featured"
                  checked={formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="featured" className="ml-2 text-sm text-gray-700">
                  Featured Event
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
                disabled={saving || uploading || !!dateError}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : uploading ? 'Uploading...' : editingEvent ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      </AdminLayout>
    </AdminGuard>
  );
}
