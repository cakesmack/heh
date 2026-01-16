/**
 * Admin Events Page
 * CRUD interface for managing events with search, clickable rows, and full columns
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import Modal from '@/components/admin/Modal';
import ImageUpload from '@/components/common/ImageUpload';
import DateTimePicker from '@/components/common/DateTimePicker';
import VenueTypeahead from '@/components/venues/VenueTypeahead';
import { eventsAPI, categoriesAPI, venuesAPI, adminEventsAPI, AdminEventItem } from '@/lib/api';
import { AGE_RESTRICTION_OPTIONS } from '@/lib/ageRestriction';
import RichTextEditor from '@/components/common/RichTextEditor';
import type { EventResponse, VenueResponse, Category, ShowtimeCreate } from '@/types';

export default function AdminEvents() {
  const router = useRouter();
  // Paginated events from admin API
  const [events, setEvents] = useState<AdminEventItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [venues, setVenues] = useState<VenueResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [venueFilter, setVenueFilter] = useState<string>('');
  const [includePast, setIncludePast] = useState(false);

  // Modal state
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
    image_url: '',
    ticket_url: '',
    age_restriction: '',
  });
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [showtimes, setShowtimes] = useState<ShowtimeCreate[]>([]);
  const [isMultiSession, setIsMultiSession] = useState(false);
  const [noEndTime, setNoEndTime] = useState(false);

  // Admin Promote Modal State
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [promotingEvent, setPromotingEvent] = useState<{ id: string; title: string } | null>(null);
  const [promoteSlotType, setPromoteSlotType] = useState<'hero_home' | 'global_pinned' | 'magazine_carousel'>('hero_home');
  const [promoteLoading, setPromoteLoading] = useState(false);

  // Track active promotions for each event: { eventId: [{id, slot_type},...] }
  const [activePromotions, setActivePromotions] = useState<Record<string, { id: string, slot_type: string }[]>>({});

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch events with pagination (server-side)
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {
        page: currentPage,
        page_size: pageSize,
        include_past: includePast,
      };

      if (debouncedSearch) filters.search = debouncedSearch;
      if (statusFilter !== 'all') filters.status = statusFilter.toLowerCase();
      if (categoryFilter) filters.category_id = categoryFilter;
      if (venueFilter) filters.venue_id = venueFilter;

      const res = await adminEventsAPI.list(filters);
      setEvents(res.data);
      setTotalPages(res.total_pages);
      setTotalEvents(res.total);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, statusFilter, categoryFilter, venueFilter, includePast]);

  // Fetch categories and venues on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [categoriesRes, venuesRes] = await Promise.all([
          categoriesAPI.list(true),
          venuesAPI.list({ limit: 500 }),
        ]);
        setCategories(categoriesRes.categories);
        setVenues(venuesRes.venues);
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch events when filters/page change
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

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
      image_url: '',
      ticket_url: '',
      age_restriction: '',
    });
    setUseManualLocation(false);
    setShowtimes([]);
    setIsMultiSession(false);
    setError(null);
    setDateError(null);
    setModalOpen(true);
  };

  const openEditModal = async (event: AdminEventItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Fetch full event data for editing
      const fullEvent = await eventsAPI.get(event.id);
      setEditingEvent(fullEvent);
      setSelectedVenue(null);
      setFormData({
        title: fullEvent.title,
        description: fullEvent.description || '',
        date_start: formatDateForInput(fullEvent.date_start),
        date_end: formatDateForInput(fullEvent.date_end),
        venue_id: fullEvent.venue_id || '',
        location_name: fullEvent.location_name || '',
        category_id: fullEvent.category_id || '',
        price: fullEvent.price,
        image_url: fullEvent.image_url || '',
        ticket_url: fullEvent.ticket_url || '',
        age_restriction: fullEvent.age_restriction || '',
      });
      setUseManualLocation(!fullEvent.venue_id && !!fullEvent.location_name);
      // Load existing showtimes
      if (fullEvent.showtimes && fullEvent.showtimes.length > 0) {
        setShowtimes(fullEvent.showtimes.map(st => ({
          start_time: st.start_time,
          end_time: st.end_time,
          ticket_url: st.ticket_url,
          notes: st.notes
        })));
        setIsMultiSession(true);
      } else {
        setShowtimes([]);
        setIsMultiSession(false);
      }
      setError(null);
      setDateError(null);
      setModalOpen(true);
    } catch (err: any) {
      console.error('Failed to fetch event details:', err);
      alert('Failed to load event for editing');
    }
  };

  const handleRowClick = (event: AdminEventItem) => {
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
    if (field === 'date_start') {
      // Smart Date Sync: Update end date when start date changes
      const oldStartDate = formData.date_start ? formData.date_start.split('T')[0] : '';
      const newStartDate = value.split('T')[0];
      const currentEndDate = formData.date_end ? formData.date_end.split('T')[0] : '';

      // Sync end date if: empty, matches old start, or is before new start
      if (!formData.date_end || currentEndDate === oldStartDate || currentEndDate < newStartDate) {
        // Keep the time from end date if it exists, otherwise use start time
        const endTime = formData.date_end ? formData.date_end.split('T')[1] : value.split('T')[1];
        setFormData(prev => ({
          ...prev,
          date_start: value,
          date_end: `${newStartDate}T${endTime || '18:00'}`
        }));
      } else {
        setFormData(prev => ({ ...prev, date_start: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
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
      // Calculate dates based on mode
      let calculatedDateStart = formData.date_start;
      let calculatedDateEnd = formData.date_end;
      let showtimesPayload: ShowtimeCreate[] | undefined = undefined;

      if (isMultiSession && showtimes.length > 0) {
        // Multi-session: calculate from showtimes
        const startTimes = showtimes.map(st => new Date(st.start_time).getTime());
        const endTimes = showtimes.map(st => st.end_time ? new Date(st.end_time).getTime() : new Date(st.start_time).getTime());
        calculatedDateStart = new Date(Math.min(...startTimes)).toISOString();
        calculatedDateEnd = new Date(Math.max(...endTimes)).toISOString();
        showtimesPayload = showtimes;
      } else if (isMultiSession && showtimes.length === 0) {
        setError('Please add at least one showtime');
        setSaving(false);
        return;
      } else {
        // Single session: use form dates, clear any stale showtimes
        calculatedDateStart = new Date(formData.date_start).toISOString();

        // If no specific end time, calculate as start + 4 hours
        if (noEndTime) {
          const startDate = new Date(formData.date_start);
          calculatedDateEnd = new Date(startDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
        } else {
          calculatedDateEnd = new Date(formData.date_end).toISOString();
        }
        showtimesPayload = []; // Clear stale showtimes
      }

      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        date_start: calculatedDateStart,
        date_end: calculatedDateEnd,
        venue_id: useManualLocation ? undefined : formData.venue_id,
        location_name: useManualLocation ? formData.location_name : undefined,
        category_id: formData.category_id,
        price: formData.price,
        image_url: formData.image_url || undefined,
        ticket_url: formData.ticket_url || undefined,
        age_restriction: formData.age_restriction || undefined,
        showtimes: showtimesPayload,
      };

      if (editingEvent) {
        await eventsAPI.update(editingEvent.id, payload);
      } else {
        await eventsAPI.create(payload);
      }
      setModalOpen(false);
      fetchEvents();
    } catch (err: any) {
      setError(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: AdminEventItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${event.title}"?`)) return;

    try {
      await eventsAPI.delete(event.id);
      fetchEvents();
    } catch (err: any) {
      alert(err.message || 'Failed to delete event');
    }
  };

  // Admin Promote Handler - runs until event ends
  const handlePromote = async () => {
    if (!promotingEvent) return;
    setPromoteLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/featured/admin-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          event_id: promotingEvent.id,
          slot_type: promoteSlotType
        })
      });
      if (!res.ok) throw new Error('Failed to create featured booking');
      setPromoteModalOpen(false);
      setPromotingEvent(null);
      fetchEvents();
      fetchPromotions();
    } catch (err: any) {
      alert(err.message || 'Failed to promote event');
    } finally {
      setPromoteLoading(false);
    }
  };

  // Fetch active promotions for all events
  const fetchPromotions = useCallback(async () => {
    try {
      // Fetch for each event that might be promoted
      const promotedEvents = events.filter(e => e.featured);
      const promoMap: Record<string, { id: string, slot_type: string }[]> = {};
      await Promise.all(promotedEvents.map(async (event) => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/featured/active-bookings/${event.id}`);
          if (res.ok) {
            const bookings = await res.json();
            if (bookings.length > 0) {
              promoMap[event.id] = bookings;
            }
          }
        } catch { }
      }));
      setActivePromotions(promoMap);
    } catch { }
  }, [events]);

  useEffect(() => {
    if (events.length > 0) {
      fetchPromotions();
    }
  }, [events, fetchPromotions]);

  // Stop promotion handler
  const handleStopPromotion = async (bookingId: string, eventId: string) => {
    if (!confirm('Stop this promotion?')) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/featured/admin-stop/${bookingId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (!res.ok) throw new Error('Failed to stop promotion');
      fetchEvents();
      fetchPromotions();
    } catch (err: any) {
      alert(err.message || 'Failed to stop promotion');
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">—</span>;

    const normalizedStatus = status.toUpperCase();
    switch (normalizedStatus) {
      case 'PUBLISHED':
      case 'APPROVED':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Published</span>;
      case 'PENDING':
      case 'PENDING_REVIEW':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 border border-amber-200">Pending</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-rose-100 text-rose-800 border border-rose-200">Rejected</span>;
      case 'DRAFT':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800 border border-gray-200">Draft</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 border border-gray-200">{status}</span>;
    }
  };

  return (
    <AdminGuard>
      <AdminLayout title="Events">
        {/* Search & Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
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

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              {/* Venue Filter */}
              <select
                value={venueFilter}
                onChange={(e) => { setVenueFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[200px]"
              >
                <option value="">All Venues</option>
                {venues.map(venue => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="draft">Draft</option>
              </select>

              {/* Include Past */}
              <div className="flex items-center gap-2">
                <input
                  id="include-past"
                  type="checkbox"
                  checked={includePast}
                  onChange={(e) => { setIncludePast(e.target.checked); setCurrentPage(1); }}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                />
                <label htmlFor="include-past" className="text-sm text-gray-700 select-none cursor-pointer">
                  Past
                </label>
              </div>

              {/* Reset Button */}
              {(searchQuery || categoryFilter || venueFilter || statusFilter !== 'all' || includePast) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('');
                    setVenueFilter('');
                    setStatusFilter('all');
                    setIncludePast(false);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                >
                  Reset
                </button>
              )}

              <span className="text-sm text-gray-500">{totalEvents} events</span>
            </div>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Add Event
            </button>
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? `No events found matching "${searchQuery}"` : 'No events found'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Title</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Creator</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Recurring</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Date</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((event) => (
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
                        {/* Show promotion indicator and Stop button if promoted */}
                        {activePromotions[event.id]?.map((promo) => (
                          <button
                            key={promo.id}
                            onClick={(e) => { e.stopPropagation(); handleStopPromotion(promo.id, event.id); }}
                            className="text-xs text-orange-600 hover:text-orange-800 px-2 py-1 rounded hover:bg-orange-50 flex items-center gap-1"
                            title={`Stop ${promo.slot_type} promotion`}
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                            Stop
                          </button>
                        ))}
                        {/* Show Promote button only if not already promoted */}
                        {!activePromotions[event.id]?.length && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPromotingEvent(event); setPromoteSlotType('hero_home'); setPromoteModalOpen(true); }}
                            className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 rounded hover:bg-purple-50"
                          >
                            Promote
                          </button>
                        )}
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow">
            <div className="text-sm text-gray-500">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalEvents)} of {totalEvents}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

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
              <RichTextEditor
                value={formData.description}
                onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                placeholder="Describe the event..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Event Type Toggle */}
              <div className="col-span-2 border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Event Type
                </label>
                <div className="flex gap-4">
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${!isMultiSession ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <input
                      type="radio"
                      name="eventType"
                      checked={!isMultiSession}
                      onChange={() => {
                        setIsMultiSession(false);
                        setShowtimes([]);
                      }}
                      className="text-emerald-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Single Event</span>
                      <p className="text-xs text-gray-500">One start and end time</p>
                    </div>
                  </label>
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${isMultiSession ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <input
                      type="radio"
                      name="eventType"
                      checked={isMultiSession}
                      onChange={() => {
                        // Push current dates to first showtime when switching
                        if (formData.date_start) {
                          setShowtimes([{
                            start_time: new Date(formData.date_start).toISOString(),
                            end_time: formData.date_end ? new Date(formData.date_end).toISOString() : undefined,
                          }]);
                        }
                        setIsMultiSession(true);
                      }}
                      className="text-emerald-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Multiple Showings</span>
                      <p className="text-xs text-gray-500">Theatre, cinema-style</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Single Event Date/Time Pickers - shown only when NOT multi-session */}
              {!isMultiSession && (
                <>
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
                  {!noEndTime && (
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
                  )}
                  <div className="col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="noEndTime"
                      checked={noEndTime}
                      onChange={(e) => setNoEndTime(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="noEndTime" className="text-sm text-gray-600">
                      No specific end time (auto: +4hrs)
                    </label>
                  </div>
                </>
              )}

              {/* Multiple Showtimes Manager - shown only when multi-session */}
              {isMultiSession && (
                <div className="col-span-2 space-y-3 bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500">
                    Add performance times. The event's main dates will be calculated automatically.
                  </p>

                  {showtimes.map((st, index) => {
                    // Convert ISO to datetime-local format for DateTimePicker
                    const startValue = st.start_time ? new Date(st.start_time).toISOString().slice(0, 16) : '';
                    const endValue = st.end_time ? new Date(st.end_time).toISOString().slice(0, 16) : '';

                    return (
                      <div key={index} className="flex items-start gap-2 bg-white p-3 rounded border">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Start *</label>
                              <DateTimePicker
                                id={`showtime_start_${index}`}
                                name={`showtime_start_${index}`}
                                value={startValue}
                                onChange={(value) => {
                                  const updated = [...showtimes];
                                  updated[index] = { ...updated[index], start_time: new Date(value).toISOString() };
                                  setShowtimes(updated);
                                }}
                                required
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">End *</label>
                              <DateTimePicker
                                id={`showtime_end_${index}`}
                                name={`showtime_end_${index}`}
                                value={endValue}
                                onChange={(value) => {
                                  const updated = [...showtimes];
                                  updated[index] = { ...updated[index], end_time: new Date(value).toISOString() };
                                  setShowtimes(updated);
                                }}
                                min={startValue}
                                required
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Ticket URL (optional)</label>
                              <input
                                type="url"
                                value={st.ticket_url || ''}
                                onChange={(e) => {
                                  const updated = [...showtimes];
                                  updated[index] = { ...updated[index], ticket_url: e.target.value || undefined };
                                  setShowtimes(updated);
                                }}
                                className="w-full px-2 py-1 text-sm border rounded"
                                placeholder="https://..."
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
                              <input
                                type="text"
                                maxLength={255}
                                value={st.notes || ''}
                                onChange={(e) => {
                                  const updated = [...showtimes];
                                  updated[index] = { ...updated[index], notes: e.target.value || undefined };
                                  setShowtimes(updated);
                                }}
                                className="w-full px-2 py-1 text-sm border rounded"
                                placeholder="e.g. Phone only, Sold Out"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowtimes(showtimes.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setShowtimes([...showtimes, {
                        start_time: now.toISOString(),
                        end_time: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
                      }]);
                    }}
                    className="w-full py-2 border-2 border-dashed border-emerald-300 text-emerald-600 rounded-lg hover:bg-emerald-50 text-sm font-medium"
                  >
                    + Add Another Performance
                  </button>
                </div>
              )}

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                <input
                  type="text"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g., Free, £5, £5-£10"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Age</label>
                <input
                  type="number"
                  min="0"
                  value={formData.age_restriction}
                  onChange={(e) => setFormData({ ...formData, age_restriction: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="0 = All Ages"
                />
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

        {/* Admin Promote Modal */}
        <Modal
          isOpen={promoteModalOpen}
          onClose={() => { setPromoteModalOpen(false); setPromotingEvent(null); }}
          title={`Promote: ${promotingEvent?.title || ''}`}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Promote this event. The promotion will run until the event ends or you stop it.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Where should this appear?
              </label>

              <div className="flex flex-col gap-3">
                {/* Option 1: Hero Carousel */}
                <label className={`relative border rounded-lg p-4 cursor-pointer transition-all ${promoteSlotType === 'hero_home'
                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="slotType"
                      value="hero_home"
                      checked={promoteSlotType === 'hero_home'}
                      onChange={(e) => setPromoteSlotType(e.target.value as any)}
                      className="h-4 w-4 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="block text-sm font-medium text-gray-900">Hero Carousel</span>
                      <span className="block text-xs text-gray-500">Big slide at the top (Max 4 slots)</span>
                    </div>
                  </div>
                </label>

                {/* Option 2: Magazine Carousel */}
                <label className={`relative border rounded-lg p-4 cursor-pointer transition-all ${promoteSlotType === 'magazine_carousel'
                  ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="slotType"
                      value="magazine_carousel"
                      checked={promoteSlotType === 'magazine_carousel'}
                      onChange={(e) => setPromoteSlotType(e.target.value as any)}
                      className="h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                    />
                    <div>
                      <span className="block text-sm font-medium text-gray-900">Magazine Carousel</span>
                      <span className="block text-xs text-gray-500">Grid feature (Max 3 slots)</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => { setPromoteModalOpen(false); setPromotingEvent(null); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handlePromote}
                disabled={promoteLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {promoteLoading ? 'Creating...' : 'Promote Event'}
              </button>
            </div>
          </div>
        </Modal>
      </AdminLayout>
    </AdminGuard >
  );
}
