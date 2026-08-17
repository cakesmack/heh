import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { apiFetch } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────

interface Ticket {
  id: string;
  tier_name: string;
  status: string;
  qr_token: string;
  checked_in_at: string | null;
}

interface OrderResult {
  order_id: string;
  order_ref: string;
  event_id: string;
  buyer_name: string;
  buyer_email: string;
  total_amount: number;
  status: string;
  stripe_payment_intent_id: string | null;
  tickets: Ticket[];
  created_at: string;
}

interface TicketedEvent {
  event_id: string;
  title: string;
  date_start: string;
  sales_frozen: boolean;
  organizer_name: string;
  total_gross: number;
  total_fees: number;
  tickets_sold: number;
}

interface InvoiceLine {
  order_id: string;
  order_ref: string;
  event_id: string;
  event_title: string;
  organizer_name: string;
  total_amount: number;
  platform_fee_amount: number;
  created_at: string;
}

type TabId = 'orders' | 'events' | 'invoices' | 'fees';

// ─── Tab Button ─────────────────────────────────────────────────

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
        active
          ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Status Badge ───────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    refunded: 'bg-red-50 text-red-700 ring-red-600/20',
    pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    failed: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ring-1 ring-inset ${styles[status] || styles.pending}`}>
      {status.toUpperCase()}
    </span>
  );
}

// ─── Tab 1: Global Orders & Controls ────────────────────────────

function OrdersTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<OrderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventToFreeze, setEventToFreeze] = useState('');
  const [freezeStatus, setFreezeStatus] = useState('');
  const [inspectOrder, setInspectOrder] = useState<OrderResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.length < 2) {
      setError('Search query must be at least 2 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ results: OrderResult[] }>(`/api/admin/ticketing/orders/search?q=${encodeURIComponent(searchQuery)}`);
      setOrders(res.results);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForceRefund = async (orderId: string) => {
    if (!confirm('DANGER: This will bypass refund rules and force a Stripe refund. Proceed?')) return;
    try {
      await apiFetch(`/api/admin/ticketing/orders/${orderId}/force-refund`, { method: 'POST' });
      alert('Order Force Refunded');
      setInspectOrder(null);
      handleSearch(new Event('submit') as any);
    } catch (err: any) {
      alert(err.message || 'Refund Failed');
    }
  };

  const handleFreeze = async () => {
    if (!eventToFreeze) return;
    try {
      const res = await apiFetch<{ sales_frozen: boolean; message: string }>(`/api/admin/ticketing/events/${eventToFreeze}/freeze`, { method: 'POST' });
      setFreezeStatus(res.message);
    } catch (err: any) {
      setFreezeStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Kill Switch */}
      <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
        <div className="px-6 py-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-lg font-bold text-red-800">Event Kill Switch</h2>
          </div>
          <p className="text-sm text-red-600 mt-1">Instantly pause or resume ticket sales for any event.</p>
        </div>
        <div className="p-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter Event ID (UUID)"
              value={eventToFreeze}
              onChange={(e) => setEventToFreeze(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
            />
            <button
              onClick={handleFreeze}
              className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors shadow-sm"
            >
              Toggle Freeze
            </button>
          </div>
          {freezeStatus && (
            <p className="mt-3 text-sm font-semibold text-red-700 bg-red-50 rounded-lg px-4 py-2">{freezeStatus}</p>
          )}
        </div>
      </div>

      {/* Global Order Search */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Global Order Search</h2>
          <p className="text-sm text-gray-500 mt-0.5">Look up any order by email, name, or order reference.</p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSearch} className="flex gap-3 mb-6">
            <input
              type="text"
              placeholder="Search by Email, Name, or Order Ref"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-semibold text-sm hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </form>

          {error && <p className="text-red-600 text-sm mb-4 bg-red-50 rounded-lg px-4 py-2">{error}</p>}

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Ref</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Buyer</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm text-gray-700">{order.order_ref}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{order.buyer_name}</div>
                      <div className="text-xs text-gray-500">{order.buyer_email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">£{order.total_amount.toFixed(2)}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setInspectOrder(order)}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && !loading && !error && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                      No orders found. Enter a search query above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Inspector Modal */}
      {inspectOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setInspectOrder(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Order Inspector</h2>
                <p className="font-mono text-xs text-gray-500 mt-1">
                  Ref: {inspectOrder.order_ref} · Event: <span className="break-all">{inspectOrder.event_id}</span>
                </p>
              </div>
              <button onClick={() => setInspectOrder(null)} className="text-gray-400 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Buyer</p>
                <p className="font-medium text-gray-900">{inspectOrder.buyer_name}</p>
                <p className="text-sm text-gray-600">{inspectOrder.buyer_email}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Stripe Intent</p>
                <p className="font-mono text-xs text-gray-600 break-all">{inspectOrder.stripe_payment_intent_id || 'N/A'}</p>
              </div>
            </div>

            <h3 className="text-base font-bold text-gray-900 mb-3">Ticket Scan Statuses</h3>
            <ul className="space-y-2 mb-6">
              {inspectOrder.tickets.map((t, idx) => (
                <li key={t.id} className="p-3 border border-gray-200 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-sm text-gray-900">{idx + 1}. {t.tier_name}</span>
                    <p className="font-mono text-xs text-gray-400 mt-0.5">{t.id}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={t.status} />
                    {t.checked_in_at && (
                      <p className="text-xs text-gray-400 mt-1">{new Date(t.checked_in_at).toLocaleTimeString()}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
              <span className="text-sm text-gray-500">
                Status: <StatusBadge status={inspectOrder.status} />
              </span>
              {inspectOrder.status === 'completed' && (
                <button
                  onClick={() => handleForceRefund(inspectOrder.order_id)}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors"
                >
                  Force Refund Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Active Ticketed Events ──────────────────────────────

function TicketedEventsTab() {
  const [events, setEvents] = useState<TicketedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await apiFetch<TicketedEvent[]>('/api/admin/ticketing/events/ticketed');
        setEvents(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load ticketed events');
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600 bg-red-50 rounded-xl p-4 text-sm">{error}</p>;
  }

  // Calculate totals
  const totalGross = events.reduce((sum, e) => sum + e.total_gross, 0);
  const totalFees = events.reduce((sum, e) => sum + e.total_fees, 0);
  const totalTickets = events.reduce((sum, e) => sum + e.tickets_sold, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Gross Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">£{totalGross.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Platform Fees Earned</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">£{totalFees.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Tickets Sold</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalTickets.toLocaleString()}</p>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">All Ticketed Events</h2>
          <p className="text-sm text-gray-500 mt-0.5">{events.length} event{events.length !== 1 ? 's' : ''} with native ticketing enabled.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Organizer</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Tickets Sold</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Revenue</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((evt) => (
                <tr key={evt.event_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[240px]">{evt.title}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{evt.organizer_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(evt.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{evt.tickets_sold}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">£{evt.total_gross.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    {evt.sales_frozen ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ring-1 ring-inset bg-red-50 text-red-700 ring-red-600/20">
                        FROZEN
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                        LIVE
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/events/${evt.event_id}`}
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No events with native ticketing enabled.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Platform Invoices / Revenue ─────────────────────────

function InvoicesTab() {
  const [invoices, setInvoices] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const data = await apiFetch<InvoiceLine[]>('/api/admin/ticketing/invoices');
        setInvoices(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load invoices');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600 bg-red-50 rounded-xl p-4 text-sm">{error}</p>;
  }

  const totalFees = invoices.reduce((sum, inv) => sum + inv.platform_fee_amount, 0);
  const totalGross = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Platform Revenue</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">£{totalFees.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Processed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">£{totalGross.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice Lines</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{invoices.length}</p>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Platform Fee Ledger</h2>
          <p className="text-sm text-gray-500 mt-0.5">All completed orders where Highland Events Hub earned a platform fee.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Ref</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Organizer</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Order Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Platform Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.order_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">{inv.order_ref}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{inv.event_title}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{inv.organizer_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(inv.created_at).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">£{inv.total_amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-right">£{inv.platform_fee_amount.toFixed(2)}</td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No platform fee invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Fee Configuration ───────────────────────────────────

interface GlobalFeeSettings {
  base_percentage: number;
  base_flat_fee: number;
  hard_cap_amount: number;
  updated_at?: string;
}

function FeeConfigTab() {
  const [settings, setSettings] = useState<GlobalFeeSettings>({
    base_percentage: 3.5,
    base_flat_fee: 0.30,
    hard_cap_amount: 75.00,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Simulation calculator state
  const [simPrice, setSimPrice] = useState<number>(20.0);
  const [simQty, setSimQty] = useState<number>(10);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<GlobalFeeSettings>('/api/admin/ticketing/settings');
      setSettings(data);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load fee settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      const data = await apiFetch<GlobalFeeSettings>('/api/admin/ticketing/settings', {
        method: 'PUT',
        body: JSON.stringify({
          base_percentage: Number(settings.base_percentage),
          base_flat_fee: Number(settings.base_flat_fee),
          hard_cap_amount: Number(settings.hard_cap_amount),
        }),
      });
      setSettings(data);
      setMessage({ text: 'Global fee settings updated successfully!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to save fee settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Calculations for preview
  const basePct = Number(settings.base_percentage) || 0;
  const baseFlat = Number(settings.base_flat_fee) || 0;
  const hardCap = Number(settings.hard_cap_amount) || 0;

  const feePerTicket = (simPrice * (basePct / 100)) + baseFlat;
  const totalRawFee = feePerTicket * simQty;
  const actualPlatformFee = Math.min(totalRawFee, hardCap);
  const subtotal = simPrice * simQty;

  const passThroughBuyerTotal = subtotal + actualPlatformFee;
  const passThroughOrganizerReceives = subtotal;

  const absorbedBuyerTotal = subtotal;
  const absorbedOrganizerReceives = Math.max(0, subtotal - actualPlatformFee);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading platform fee configuration...</div>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration Form */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Platform Global Fee Engine</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Set baseline platform revenue rates applied across all native ticketing transactions.
              </p>
            </div>
            {settings.updated_at && (
              <span className="text-[11px] text-gray-400">
                Last updated: {new Date(settings.updated_at).toLocaleDateString()}
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                Base Fee Percentage (%)
              </label>
              <div className="relative rounded-lg shadow-sm">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={settings.base_percentage}
                  onChange={(e) => setSettings({ ...settings, base_percentage: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 font-semibold"
                  placeholder="3.50"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400 font-bold">
                  %
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Standard platform percentage cut on paid ticket face value (e.g. 3.50%).
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                Base Flat Fee per Ticket (£)
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 font-bold">
                  £
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={settings.base_flat_fee}
                  onChange={(e) => setSettings({ ...settings, base_flat_fee: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 font-semibold"
                  placeholder="0.30"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Fixed nominal charge per individual ticket (e.g. £0.30 to cover payment gateway costs).
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                Maximum Platform Fee Cap per Event (£)
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 font-bold">
                  £
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={settings.hard_cap_amount}
                  onChange={(e) => setSettings({ ...settings, hard_cap_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 font-semibold"
                  placeholder="75.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Highland Events Hub hard cap: platform fees stop accruing once an event generates this total fee amount.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={fetchSettings}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {saving ? 'Saving Changes...' : 'Save Fee Configuration'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Live Fee Simulation & Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-xl p-6 shadow-md border border-stone-700">
            <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Live Fee Simulator
            </h3>
            <p className="text-xs text-stone-400 mt-1 mb-4">
              Simulate live revenue splits based on the configured rates above.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">Ticket Price (£)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={simPrice}
                  onChange={(e) => setSimPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 rounded-lg bg-stone-800 border border-stone-600 text-white font-mono text-sm focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">Tickets Sold</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={simQty}
                  onChange={(e) => setSimQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 rounded-lg bg-stone-800 border border-stone-600 text-white font-mono text-sm focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-stone-950/60 rounded-lg p-4 border border-stone-700/60 space-y-3 font-mono text-xs">
              <div className="flex justify-between text-stone-300">
                <span>Fee per Ticket:</span>
                <span className="font-bold text-emerald-400">£{feePerTicket.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-300">
                <span>Platform Total Fee:</span>
                <span className="font-bold text-emerald-400">
                  £{actualPlatformFee.toFixed(2)}
                  {totalRawFee > hardCap && <span className="text-[10px] text-amber-400 ml-1">(Cap Applied)</span>}
                </span>
              </div>

              <div className="pt-3 border-t border-stone-800">
                <div className="text-[11px] font-bold text-emerald-300 mb-1 font-sans">
                  Mode A: Pass Fee to Buyer (Default)
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Buyer Pays:</span>
                  <span className="text-white font-bold">£{passThroughBuyerTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Organizer Receives:</span>
                  <span className="text-emerald-400 font-bold">£{passThroughOrganizerReceives.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800">
                <div className="text-[11px] font-bold text-amber-300 mb-1 font-sans">
                  Mode B: Absorb Fee (Free to Buyer)
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Buyer Pays:</span>
                  <span className="text-white font-bold">£{absorbedBuyerTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Organizer Receives:</span>
                  <span className="text-amber-400 font-bold">£{absorbedOrganizerReceives.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function AdminTicketingDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('orders');

  return (
    <AdminGuard>
      <AdminLayout title="Ticketing & Orders">
        <Head>
          <title>Ticketing & Orders | Admin</title>
        </Head>

        <div className="space-y-6">
          {/* Tab Bar */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
              <TabButton
                active={activeTab === 'orders'}
                onClick={() => setActiveTab('orders')}
                label="Global Orders & Controls"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
              <TabButton
                active={activeTab === 'events'}
                onClick={() => setActiveTab('events')}
                label="Active Ticketed Events"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                }
              />
              <TabButton
                active={activeTab === 'invoices'}
                onClick={() => setActiveTab('invoices')}
                label="Platform Invoices"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                }
              />
              <TabButton
                active={activeTab === 'fees'}
                onClick={() => setActiveTab('fees')}
                label="Fee Configuration"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'orders' && <OrdersTab />}
          {activeTab === 'events' && <TicketedEventsTab />}
          {activeTab === 'invoices' && <InvoicesTab />}
          {activeTab === 'fees' && <FeeConfigTab />}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}

