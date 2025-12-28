/**
 * Admin Featured Bookings Page
 * Manage featured advertising slots and pricing
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { apiFetch } from '@/lib/api';

interface FeaturedBookingAdmin {
  id: string;
  event_id: string;
  event_title: string;
  organizer_id: string;
  organizer_email: string;
  is_trusted: boolean;
  slot_type: string;
  target_id: string | null;
  start_date: string;
  end_date: string;
  status: string;
  amount_paid: number;
  created_at: string;
}

interface SlotPricingAdmin {
  slot_type: string;
  price_per_day: number;
  min_days: number;
  max_concurrent: number;
  is_active: boolean;
  description: string;
  updated_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-100 text-red-700',
};

const SLOT_LABELS: Record<string, string> = {
  hero_home: 'Hero Carousel',
  global_pinned: 'Homepage Pinned',
  category_pinned: 'Category Pinned',
  newsletter: 'Newsletter',
};

export default function AdminFeatured() {
  const [activeTab, setActiveTab] = useState<'bookings' | 'pricing'>('bookings');
  const [bookings, setBookings] = useState<FeaturedBookingAdmin[]>([]);
  const [pricing, setPricing] = useState<SlotPricingAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [slotFilter, setSlotFilter] = useState<string>('');
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SlotPricingAdmin>>({});

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (slotFilter) params.append('slot_type', slotFilter);
      const queryString = params.toString();

      const response = await apiFetch<{ bookings: FeaturedBookingAdmin[] }>(
        `/api/admin/featured${queryString ? `?${queryString}` : ''}`
      );
      setBookings(response.bookings);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      setError('Failed to load featured bookings');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, slotFilter]);

  useEffect(() => {
    if (activeTab === 'bookings') {
      fetchBookings();
    } else {
      fetchPricing();
    }
  }, [activeTab, fetchBookings]);

  const fetchPricing = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ pricing: SlotPricingAdmin[] }>('/api/admin/pricing');
      setPricing(response.pricing);
    } catch (err) {
      console.error('Failed to fetch pricing:', err);
      setError('Failed to load pricing');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPricing = (slot: SlotPricingAdmin) => {
    setEditingSlot(slot.slot_type);
    setEditForm({
      price_per_day: slot.price_per_day,
      min_days: slot.min_days,
      max_concurrent: slot.max_concurrent,
      is_active: slot.is_active,
    });
  };

  const handleSavePricing = async () => {
    if (!editingSlot) return;
    try {
      const params = new URLSearchParams();
      if (editForm.price_per_day !== undefined) params.append('price_per_day', String(editForm.price_per_day));
      if (editForm.min_days !== undefined) params.append('min_days', String(editForm.min_days));
      if (editForm.max_concurrent !== undefined) params.append('max_concurrent', String(editForm.max_concurrent));
      if (editForm.is_active !== undefined) params.append('is_active', String(editForm.is_active));

      await apiFetch(`/api/admin/pricing/${editingSlot}?${params.toString()}`, { method: 'PATCH' });
      setEditingSlot(null);
      await fetchPricing();
    } catch (err: any) {
      alert(err.message || 'Failed to update pricing');
    }
  };

  const handleApprove = async (bookingId: string) => {
    if (!confirm('Approve this booking? The organizer will be notified and marked as trusted.')) {
      return;
    }
    try {
      await apiFetch(`/api/admin/featured/${bookingId}/approve`, { method: 'PATCH' });
      await fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to approve booking');
    }
  };

  const handleReject = async (bookingId: string) => {
    if (!confirm('Reject this booking? A refund will be issued to the organizer.')) {
      return;
    }
    try {
      await apiFetch(`/api/admin/featured/${bookingId}/reject`, { method: 'PATCH' });
      await fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to reject booking');
    }
  };

  const handleCancel = async (bookingId: string, isPaid: boolean) => {
    const message = isPaid
      ? 'Cancel this booking? A refund will be issued.'
      : 'Cancel this abandoned checkout?';
    if (!confirm(message)) {
      return;
    }
    try {
      await apiFetch(`/api/admin/featured/${bookingId}/cancel`, { method: 'PATCH' });
      await fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking');
    }
  };

  const handleEndPromotion = async (bookingId: string) => {
    if (!confirm('End this promotion early? The event will no longer be featured.')) {
      return;
    }
    try {
      await apiFetch(`/api/admin/featured/${bookingId}/end`, { method: 'PATCH' });
      await fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to end promotion');
    }
  };

  const handleSyncFeatured = async () => {
    try {
      const result = await apiFetch<{ synced: number; total_active_bookings: number }>(
        '/api/admin/featured/sync',
        { method: 'POST' }
      );
      alert(`Synced ${result.synced} events. Total active bookings: ${result.total_active_bookings}`);
    } catch (err: any) {
      alert(err.message || 'Failed to sync featured events');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatPrice = (pence: number) => {
    return `£${(pence / 100).toFixed(2)}`;
  };

  const pendingCount = bookings.filter(b => b.status === 'pending_approval').length;
  const activeCount = bookings.filter(b => b.status === 'active').length;
  const totalRevenue = bookings
    .filter(b => ['active', 'completed'].includes(b.status))
    .reduce((sum, b) => sum + b.amount_paid, 0);

  return (
    <AdminGuard>
      <AdminLayout title="Featured Ads">
        <div className="mb-6">
          <p className="text-gray-600">
            Manage paid featured placements and pricing
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`pb-3 px-1 font-medium transition-colors ${activeTab === 'bookings'
              ? 'text-emerald-600 border-b-2 border-emerald-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Bookings
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`pb-3 px-1 font-medium transition-colors ${activeTab === 'pricing'
              ? 'text-emerald-600 border-b-2 border-emerald-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Pricing Settings
          </button>
        </div>

        {activeTab === 'bookings' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-sm text-amber-600 font-medium">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-green-600 font-medium">Active Bookings</p>
                <p className="text-2xl font-bold text-green-700">{activeCount}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-600 font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-blue-700">{formatPrice(totalRevenue)}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 flex flex-col justify-between">
                <p className="text-sm text-purple-600 font-medium">Sync Featured Flags</p>
                <button
                  onClick={handleSyncFeatured}
                  className="mt-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Sync Now
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Statuses</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={slotFilter}
                onChange={(e) => setSlotFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Slot Types</option>
                <option value="hero_home">Hero Carousel</option>
                <option value="global_pinned">Homepage Pinned</option>
                <option value="category_pinned">Category Pinned</option>
                <option value="newsletter">Newsletter</option>
              </select>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No featured bookings found
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Event
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Slot
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dates
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <Link
                              href={`/events/${booking.event_id}`}
                              className="font-medium text-gray-900 hover:text-emerald-600"
                            >
                              {booking.event_title}
                            </Link>
                            <p className="text-sm text-gray-500">
                              {booking.organizer_email}
                              {booking.is_trusted && (
                                <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                                  Trusted
                                </span>
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {SLOT_LABELS[booking.slot_type] || booking.slot_type}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {formatPrice(booking.amount_paid)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[booking.status]}`}>
                            {booking.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {booking.status === 'pending_approval' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(booking.id)}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(booking.id)}
                                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {booking.status === 'pending_payment' && (
                            <button
                              onClick={() => handleCancel(booking.id, false)}
                              className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                          )}
                          {booking.status === 'active' && (
                            <button
                              onClick={() => handleEndPromotion(booking.id)}
                              className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                            >
                              End Promotion
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'pricing' && (
          <>
            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Slot Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price/Day
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Min Days
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Max Slots
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pricing.map((slot) => (
                      <tr key={slot.slot_type} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {SLOT_LABELS[slot.slot_type] || slot.slot_type}
                            </p>
                            <p className="text-sm text-gray-500">{slot.description}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {editingSlot === slot.slot_type ? (
                            <input
                              type="number"
                              value={editForm.price_per_day || 0}
                              onChange={(e) => setEditForm({ ...editForm, price_per_day: parseInt(e.target.value) })}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                              step="100"
                            />
                          ) : (
                            <span className="font-medium">{formatPrice(slot.price_per_day)}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingSlot === slot.slot_type ? (
                            <input
                              type="number"
                              value={editForm.min_days || 1}
                              onChange={(e) => setEditForm({ ...editForm, min_days: parseInt(e.target.value) })}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                              min="1"
                            />
                          ) : (
                            <span>{slot.min_days}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingSlot === slot.slot_type ? (
                            <input
                              type="number"
                              value={editForm.max_concurrent || 1}
                              onChange={(e) => setEditForm({ ...editForm, max_concurrent: parseInt(e.target.value) })}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                              min="1"
                            />
                          ) : (
                            <span>{slot.max_concurrent}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingSlot === slot.slot_type ? (
                            <select
                              value={editForm.is_active ? 'active' : 'inactive'}
                              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'active' })}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          ) : (
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${slot.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                              {slot.is_active ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingSlot === slot.slot_type ? (
                            <div className="flex gap-2">
                              <button
                                onClick={handleSavePricing}
                                className="px-3 py-1 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingSlot(null)}
                                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditPricing(slot)}
                              className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-4 text-sm text-gray-500">
              Prices are in pence (e.g., 4000 = £40.00). Changes take effect immediately for new bookings.
            </p>
          </>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
