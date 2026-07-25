import { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { adminAPI, venuesAPI, categoriesAPI } from '@/lib/api';
import { PendingEvent, Venue, Category } from '@/types';
import { PendingEventEditModal } from '@/components/admin/PendingEventEditModal';
import toast from 'react-hot-toast';
import {
  Check,
  Trash2,
  Calendar,
  MapPin,
  Tag,
  ExternalLink,
  Clock,
  DollarSign,
  AlertCircle,
  Inbox,
  Sparkles,
  Edit3
} from 'lucide-react';

export default function PendingEventsModerationPage() {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal editing state
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<PendingEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pendingData, venuesData, categoriesData] = await Promise.all([
        adminAPI.getPendingEvents(),
        venuesAPI.list({ all: true }).catch(() => ({ venues: [] })),
        categoriesAPI.list().catch(() => ({ categories: [] }))
      ]);
      setEvents(Array.isArray(pendingData) ? pendingData : []);
      const parsedVenues = Array.isArray(venuesData)
        ? venuesData
        : Array.isArray((venuesData as any)?.venues)
        ? (venuesData as any).venues
        : [];
      const parsedCategories = Array.isArray(categoriesData)
        ? categoriesData
        : Array.isArray((categoriesData as any)?.categories)
        ? (categoriesData as any).categories
        : [];
      setVenues(parsedVenues);
      setCategories(parsedCategories);
    } catch (err: any) {
      console.error('Failed to load moderation data:', err);
      setError(err?.message || 'Failed to load pending events.');
      toast.error('Failed to load pending events.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (event: PendingEvent) => {
    setSelectedEventForEdit(event);
    setIsModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsModalOpen(false);
    setSelectedEventForEdit(null);
  };

  const handleSaveDraft = async (id: string, formData: Partial<PendingEvent>) => {
    try {
      setProcessingId(id);
      const updated = await adminAPI.updatePendingEvent(id, formData);
      setEvents((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
      toast.success('Staging record updated draft saved!');
    } catch (err: any) {
      console.error('Failed to save draft:', err);
      toast.error(err?.message || 'Failed to save draft.');
      throw err;
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (id: string, overrides?: Partial<PendingEvent>) => {
    const targetEvent = events.find((e) => e.id === id);
    if (!targetEvent) return;

    // Pre-flight Category Validation
    const categoryName = overrides?.category_name || targetEvent.category_name;
    if (!categoryName || categoryName === 'Select Category' || categoryName.trim() === '') {
      toast.error('⚠️ You must select a category before approving this event.');
      return;
    }

    const title = overrides?.title || targetEvent.title || 'Event';
    try {
      setProcessingId(id);
      await adminAPI.approvePendingEvent(id, overrides);
      setEvents((prev) => prev.filter((item) => item.id !== id));
      toast.success(`Approved "${title}" and published live!`);
    } catch (err: any) {
      console.error('Failed to approve event:', err);
      const errorMsg = err?.message || '';
      if (errorMsg.includes('Duplicate event')) {
        toast.error('❌ Failed to approve: This event is a duplicate and already exists.');
      } else {
        toast.error(errorMsg || `Failed to approve "${title}".`);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string, title: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to reject "${title}"? It will be removed from the moderation queue.`
    );
    if (!confirmed) return;

    try {
      setProcessingId(id);
      await adminAPI.rejectPendingEvent(id);
      setEvents((prev) => prev.filter((item) => item.id !== id));
      toast.success(`Rejected "${title}".`);
    } catch (err: any) {
      console.error('Failed to reject event:', err);
      toast.error(err?.message || `Failed to reject "${title}".`);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AdminGuard>
      <AdminLayout title="Pending Events Moderation">
        <Head>
          <title>Pending Events Moderation | Admin Panel</title>
        </Head>

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                <Clock className="w-6 h-6 text-amber-500" />
                Pending Events Queue
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Review, edit data quality in full wizard modal, approve, or reject scraped events.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold border border-amber-200">
                {events.length} Pending
              </span>
              <button
                onClick={fetchInitialData}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Refresh Queue
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-3 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm animate-pulse space-y-4"
                >
                  <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                  <div className="h-16 bg-gray-50 rounded"></div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center shadow-sm max-w-2xl mx-auto my-8">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                <Inbox className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Queue clean! No pending events to moderate.
              </h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                All scraped staging records have been processed. New events will appear here automatically when scrapers push data.
              </p>
            </div>
          ) : (
            /* Events List Cards */
            <div className="space-y-6">
              {events.map((event) => {
                const isProcessing = processingId === event.id;

                return (
                  <div
                    key={event.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md"
                  >
                    <div className="p-6">
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Image Preview */}
                        {event.image_url ? (
                          <div className="w-full lg:w-48 h-48 lg:h-auto rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 relative group">
                            <img
                              src={event.image_url}
                              alt={event.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-full lg:w-48 h-36 lg:h-auto rounded-xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 flex-shrink-0 p-4">
                            <Sparkles className="w-8 h-8 mb-1 text-gray-300" />
                            <span className="text-xs">No image provided</span>
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-3">
                          {/* Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200/60 capitalize flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              {event.category_name || 'Uncategorized'}
                            </span>
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200/60 uppercase tracking-wider">
                              Source: {event.source}
                            </span>
                            {event.price_display && (
                              <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg border border-purple-200/60 flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                {event.price_display}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h2 className="text-xl font-bold text-gray-900 tracking-tight leading-snug">
                            {event.title}
                          </h2>

                          {/* Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              <span className="font-medium text-gray-800">{event.venue_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              <span>{formatDate(event.date_start)}</span>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-gray-600 line-clamp-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                            {event.description}
                          </p>

                          {/* Raw Showtimes */}
                          {event.raw_showtimes && event.raw_showtimes.length > 0 && (
                            <div className="text-xs bg-amber-50/60 border border-amber-100 p-2.5 rounded-xl text-amber-900">
                              <span className="font-semibold block mb-1">Raw Showtimes:</span>
                              <div className="flex flex-wrap gap-1">
                                {event.raw_showtimes.map((st, idx) => (
                                  <span
                                    key={idx}
                                    className="bg-white px-2 py-0.5 rounded border border-amber-200/80 font-mono text-[11px]"
                                  >
                                    {st}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Website & Ticket Links */}
                          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                            {event.website_url && (
                              <a
                                href={event.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-800 font-medium hover:underline"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Event Website Link
                              </a>
                            )}
                            {event.ticket_url && (
                              <a
                                href={event.ticket_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-medium hover:underline"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Ticket Link
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex lg:flex-col justify-end gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-gray-100 lg:pl-6 flex-shrink-0 min-w-[140px]">
                          <button
                            onClick={() => handleOpenEditModal(event)}
                            disabled={isProcessing}
                            className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4 text-gray-600" />
                            Edit Event
                          </button>

                          <button
                            onClick={() => handleApprove(event.id)}
                            disabled={isProcessing}
                            className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {isProcessing ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            Approve
                          </button>

                          <button
                            onClick={() => handleReject(event.id, event.title)}
                            disabled={isProcessing}
                            className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-sm font-semibold rounded-xl border border-rose-200/80 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {isProcessing ? (
                              <div className="w-4 h-4 border-2 border-rose-700 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Full Import Wizard Style Edit Modal */}
        <PendingEventEditModal
          event={selectedEventForEdit}
          venues={venues}
          categories={categories}
          isOpen={isModalOpen}
          onClose={handleCloseEditModal}
          onSaveDraft={handleSaveDraft}
          onApprovePublish={handleApprove}
        />
      </AdminLayout>
    </AdminGuard>
  );
}
