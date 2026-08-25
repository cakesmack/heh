import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth, isApprovedSeller } from '@/hooks/useAuth';
import { apiFetch, API_BASE_URL } from '@/lib/api';

interface InventoryItem {
  tier_id: string;
  name: string;
  quantity_available: number;
  quantity_sold: number;
  price: number;
}

interface DashboardMetrics {
  event_id?: string;
  event_title: string;
  is_cancelled?: boolean;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  gross_revenue: number;
  platform_fees: number;
  net_payout: number;
  total_orders: number;
  inventory: InventoryItem[];
}

export default function OrganizerTicketingDashboard() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Cancellation Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.replace(`/login?redirect=/organizers/events/${id}/ticketing`);
      } else if (!isApprovedSeller(user)) {
        router.replace('/403');
      } else if (id) {
        apiFetch<DashboardMetrics>(`/api/ticketing/organizer/events/${id}/dashboard`)
          .then(data => {
            setMetrics(data);
          })
          .catch(err => {
            setError(err.message || 'Failed to load ticketing metrics.');
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  }, [id, isAuthenticated, authLoading, user, router]);

  const handleCancelEvent = async () => {
    if (!id || isCancelling) return;
    setIsCancelling(true);
    try {
      const res = await apiFetch<any>(`/api/organizers/events/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancellationReason || undefined })
      });
      setCancelSuccessMsg('Event successfully cancelled. Ticket sales have stopped and refunds have been dispatched.');
      setCancelModalOpen(false);
      setMetrics(m => m ? ({ ...m, is_cancelled: true, cancellation_reason: cancellationReason }) : null);
    } catch (err: any) {
      alert('Failed to cancel event: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleExport = async () => {
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('token')) : '';
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE_URL}/api/ticketing/organizer/events/${id}/export-attendees`, {
        headers
      });

      if (!res.ok) {
        let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const errData = await res.json();
          if (errData?.detail) {
            errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
          }
        } catch {
          try {
            const errText = await res.text();
            if (errText) errorDetail = errText;
          } catch {}
        }
        throw new Error(errorDetail);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `guest_list_${id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to export guests: ' + (err?.message || 'Unknown error'));
    }
  };

  if (authLoading || !isAuthenticated || !isApprovedSeller(user) || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-3" />
          <p className="text-gray-500 font-medium">Loading ticketing dashboard...</p>
        </div>
      </div>
    );
  }
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!metrics) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <Head>
        <title>Ticketing Dashboard - {metrics.event_title}</title>
      </Head>
      
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <Link href={`/organizers/events/${id}`} className="text-sm text-gray-500 hover:underline mb-2 inline-block">
              ← Back to Event Editor
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Ticketing Dashboard</h1>
            <p className="text-gray-600">{metrics.event_title}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/organizers/scanner"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition flex items-center gap-2 text-sm"
            >
              <span>📷 Door Scanner</span>
            </Link>

            <Link
              href="/organizers/invoices"
              className="bg-white text-stone-800 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg font-bold shadow-sm transition flex items-center gap-2 text-sm"
            >
              <span>🧾 Invoices & Tax</span>
            </Link>

            <button 
              onClick={handleExport}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-gray-700 transition text-sm"
            >
              Export Guests (CSV)
            </button>

            {!metrics.is_cancelled ? (
              <button
                onClick={() => setCancelModalOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition text-sm flex items-center gap-1.5"
              >
                <span>🚫 Cancel Event</span>
              </button>
            ) : (
              <span className="px-3.5 py-1.5 bg-red-100 text-red-800 text-xs font-black uppercase tracking-wider rounded-lg border border-red-200">
                Event Cancelled
              </span>
            )}
          </div>
        </div>

        {/* Cancellation Notice Banner */}
        {metrics.is_cancelled && (
          <div className="p-6 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-4 animate-in fade-in">
            <div className="text-3xl">⚠️</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-red-900">Event Cancelled & Sales Frozen</h2>
              <p className="text-sm text-red-700 mt-1">
                This event has been officially cancelled. Ticket sales are disabled, existing tickets have been voided from door scanners, and face-value refunds have been automatically dispatched to ticket holders via Stripe.
              </p>
              {metrics.cancellation_reason && (
                <p className="text-xs text-red-800 font-semibold mt-2 italic">
                  Organizer note to buyers: "{metrics.cancellation_reason}"
                </p>
              )}
            </div>
          </div>
        )}

        {cancelSuccessMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold flex items-center justify-between">
            <span>✓ {cancelSuccessMsg}</span>
            <button onClick={() => setCancelSuccessMsg('')} className="text-emerald-900 hover:text-emerald-950">✕</button>
          </div>
        )}
        
        {/* Financial Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Gross Revenue</h3>
            <p className="text-3xl font-bold mt-2">£{metrics.gross_revenue.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">Total collected from {metrics.total_orders} orders</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Platform Fees</h3>
            <p className="text-3xl font-bold mt-2 text-red-500">-£{metrics.platform_fees.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">Deducted via Stripe</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow border border-emerald-100 ring-2 ring-emerald-500 ring-offset-2">
            <h3 className="text-sm font-semibold text-emerald-600 uppercase">Net Payout Expected</h3>
            <p className="text-3xl font-bold mt-2 text-emerald-700">£{metrics.net_payout.toFixed(2)}</p>
            <p className="text-xs text-emerald-500/80 mt-1">Deposited to your Stripe account</p>
          </div>
        </div>
        
        {/* Inventory */}
        <div className="bg-white p-6 md:p-8 rounded-xl shadow border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Inventory Status</h2>
          
          <div className="space-y-6">
            {metrics.inventory.map(tier => {
              const capacity = tier.quantity_available;
              const sold = tier.quantity_sold;
              const percent = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
              
              return (
                <div key={tier.tier_id} className="border-b border-gray-50 pb-6 last:border-0 last:pb-0">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <h4 className="font-bold text-gray-800">{tier.name}</h4>
                      <p className="text-sm text-gray-500">£{tier.price.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{sold} / {capacity}</p>
                      <p className="text-xs text-gray-500">Tickets Sold</p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${percent >= 100 ? 'bg-red-500' : percent > 80 ? 'bg-orange-500' : 'bg-emerald-500'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
            
            {metrics.inventory.length === 0 && (
              <p className="text-gray-500 italic">No ticket tiers configured for this event.</p>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation Confirmation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl mb-4 font-bold">
              ⚠️
            </div>
            <h3 className="text-xl font-bold text-gray-900">Cancel "{metrics.event_title}"?</h3>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              Cancelling this event is a permanent action with the following automated operations:
            </p>

            <ul className="mt-3 space-y-2 text-xs text-gray-700 bg-red-50/70 p-4 rounded-xl border border-red-200">
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✓</span>
                <span><strong>Stops Sales:</strong> Ticket sales are immediately frozen and public event listings are marked Cancelled.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✓</span>
                <span><strong>Automatic Refunds:</strong> Ticket face value is automatically refunded via Stripe to all buyers' payment cards.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✓</span>
                <span><strong>Email Notifications:</strong> All ticket buyers receive an official cancellation email notification.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✓</span>
                <span><strong>Door Lock:</strong> Existing QR barcode passes are invalidated across all check-in scanners.</span>
              </li>
            </ul>

            <div className="mt-4">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Reason for cancellation (included in buyer email):
              </label>
              <textarea
                value={cancellationReason}
                onChange={e => setCancellationReason(e.target.value)}
                placeholder="e.g. Due to unforeseen venue maintenance / performer illness..."
                rows={3}
                className="w-full text-sm rounded-xl border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-3"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setCancelModalOpen(false)}
                disabled={isCancelling}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
              >
                Keep Event Active
              </button>
              <button
                onClick={handleCancelEvent}
                disabled={isCancelling}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition shadow-sm flex items-center gap-2"
              >
                {isCancelling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Refunds...</span>
                  </>
                ) : (
                  <span>Confirm Cancellation & Refund Buyers</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
