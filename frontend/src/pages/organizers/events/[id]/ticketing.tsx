import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

interface InventoryItem {
  tier_id: string;
  name: string;
  quantity_available: number;
  quantity_sold: number;
  price: number;
}

interface DashboardMetrics {
  event_title: string;
  gross_revenue: number;
  platform_fees: number;
  net_payout: number;
  total_orders: number;
  inventory: InventoryItem[];
}

export default function OrganizerTicketingDashboard() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !id) return;
    
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
  }, [id, isAuthenticated]);

  const handleExport = () => {
    // We can just open the API URL to trigger a download since we pass the token in cookies, 
    // or if we use Bearer token, we must fetch and blob it.
    // Assuming apiFetch handles headers, we fetch as blob.
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/ticketing/organizer/events/${id}/export-guests`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}` // If using local storage
      }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `guest_list_${id}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    })
    .catch(() => alert('Failed to export guests'));
  };

  if (!isAuthenticated) return <div className="p-8 text-center">Please log in.</div>;
  if (loading) return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;
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
          </div>
        </div>
        
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
    </div>
  );
}
