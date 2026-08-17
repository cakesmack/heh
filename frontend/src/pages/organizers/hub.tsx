import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, API_BASE_URL } from '@/lib/api';

type TabType = 'events' | 'payouts' | 'invoices' | 'scanner';

interface TicketedEventItem {
  id: string;
  event_id?: string;
  title: string;
  date_start: string;
  date_end: string | null;
  venue_name: string;
  is_scanner_active: boolean;
  scanner_access_key: string | null;
  scanner_url: string;
  total_tickets_sold: number;
  total_checked_in: number;
}

interface StripeAccountInfo {
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

interface SellerStatus {
  seller_tier: number;
  seller_status: string;
  is_connected?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  organizer_id?: string | null;
  organizer_name?: string | null;
  stripe_account?: StripeAccountInfo | null;
}

interface InvoiceSummary {
  total_gross: number;
  total_fees: number;
  total_net: number;
  total_invoices: number;
  total_tickets: number;
}

interface InvoiceItem {
  invoice_ref: string;
  order_id: string;
  order_ref: string;
  event_id: string;
  event_title: string;
  created_at: string;
  tax_year: string;
  buyer_name: string;
  buyer_email: string;
  tickets_count: number;
  total_gross: number;
  platform_fee: number;
  net_payout: number;
  status: string;
  currency: string;
}

const DEFAULT_SELLER_STATUS: SellerStatus = {
  seller_tier: 1,
  seller_status: 'none',
  is_connected: false,
  charges_enabled: false,
  payouts_enabled: false,
  stripe_account: null
};

const DEFAULT_INVOICE_SUMMARY: InvoiceSummary = {
  total_gross: 0,
  total_fees: 0,
  total_net: 0,
  total_invoices: 0,
  total_tickets: 0
};

export default function OrganizerHubPage() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();

  // Active tab state with query param sync
  const [activeTab, setActiveTab] = useState<TabType>('events');

  // Tab 1 & 4: Events & Scanner Data
  const [events, setEvents] = useState<TicketedEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [activeStaffQrEvent, setActiveStaffQrEvent] = useState<TicketedEventItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Tab 2: Payouts & Stripe Connect Data
  const [sellerStatus, setSellerStatus] = useState<SellerStatus>(DEFAULT_SELLER_STATUS);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeConnecting, setStripeConnecting] = useState(false);

  // Tab 3: Invoices & Tax Data
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary>(DEFAULT_INVOICE_SUMMARY);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [taxYears, setTaxYears] = useState<string[]>([]);
  const [selectedTaxYear, setSelectedTaxYear] = useState<string>('');
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Sync tab with URL query parameter
  useEffect(() => {
    if (router.query.tab && ['events', 'payouts', 'invoices', 'scanner'].includes(router.query.tab as string)) {
      setActiveTab(router.query.tab as TabType);
    }
  }, [router.query.tab]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push({ pathname: '/organizers/hub', query: { tab } }, undefined, { shallow: true });
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/organizers/hub');
    }
  }, [authLoading, isAuthenticated, router]);

  // 1. Fetch Organizer Events (Safe try/catch)
  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      // Try primary /api/organizers/events, fallback to /api/ticketing/organizer/scanner/events
      let data: { events?: TicketedEventItem[] } | null = null;
      try {
        data = await apiFetch<{ events: TicketedEventItem[] }>('/api/organizers/events');
      } catch (e) {
        data = await apiFetch<{ events: TicketedEventItem[] }>('/api/ticketing/organizer/scanner/events');
      }
      setEvents(data?.events || []);
    } catch (err: any) {
      console.warn('OrganizerHub: Could not fetch organizer events, defaulting to empty list.', err);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  // 2. Fetch Seller & Stripe Status (Safe try/catch)
  const fetchSellerStatus = async () => {
    setStripeLoading(true);
    try {
      const data = await apiFetch<SellerStatus>('/api/sellers/status');
      setSellerStatus({
        ...DEFAULT_SELLER_STATUS,
        ...data,
        is_connected: Boolean(data?.stripe_account?.stripe_account_id || data?.is_connected),
        charges_enabled: Boolean(data?.stripe_account?.charges_enabled || data?.charges_enabled),
        payouts_enabled: Boolean(data?.stripe_account?.payouts_enabled || data?.payouts_enabled),
      });
    } catch (err: any) {
      console.warn('OrganizerHub: Could not fetch seller status, defaulting to safe state.', err);
      setSellerStatus(DEFAULT_SELLER_STATUS);
    } finally {
      setStripeLoading(false);
    }
  };

  // 3. Fetch Invoices (Safe try/catch)
  const fetchInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const query = selectedTaxYear ? `?tax_year=${encodeURIComponent(selectedTaxYear)}` : '';
      let data: { summary?: InvoiceSummary; invoices?: InvoiceItem[]; tax_years?: string[] } | null = null;
      try {
        data = await apiFetch<any>(`/api/organizers/invoices${query}`);
      } catch (e) {
        data = await apiFetch<any>(`/api/ticketing/organizer/invoices${query}`);
      }
      setInvoiceSummary(data?.summary || DEFAULT_INVOICE_SUMMARY);
      setInvoices(data?.invoices || []);
      setTaxYears(data?.tax_years || []);
    } catch (err: any) {
      console.warn('OrganizerHub: Could not fetch organizer invoices, defaulting to empty list.', err);
      setInvoiceSummary(DEFAULT_INVOICE_SUMMARY);
      setInvoices([]);
      setTaxYears([]);
    } finally {
      setInvoicesLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchEvents();
      fetchSellerStatus();
      fetchInvoices();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'invoices') {
      fetchInvoices();
    }
  }, [selectedTaxYear, activeTab]);

  // Scanner Actions
  const handleActivateScanner = async (eventId: string) => {
    setActionLoading(eventId);
    try {
      await apiFetch(`/api/ticketing/organizer/events/${eventId}/activate-scanner`, { method: 'POST' });
      await fetchEvents();
    } catch (err: any) {
      alert(err.message || 'Failed to activate scanner.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivateScanner = async (eventId: string) => {
    if (!confirm('Are you sure you want to stop ticket scanning for this event? Door staff access keys will be revoked.')) return;
    setActionLoading(eventId);
    try {
      await apiFetch(`/api/ticketing/organizer/events/${eventId}/deactivate-scanner`, { method: 'POST' });
      await fetchEvents();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate scanner.');
    } finally {
      setActionLoading(null);
    }
  };

  // Stripe Connect Onboarding / Dashboard
  const handleStripeConnect = async () => {
    setStripeConnecting(true);
    try {
      const res = await apiFetch<{ url?: string }>('/api/sellers/stripe-connect/onboard', { method: 'POST' });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        router.push('/organizers/payouts');
      }
    } catch (err: any) {
      alert(err.message || 'Redirecting to Payouts portal...');
      router.push('/organizers/payouts');
    } finally {
      setStripeConnecting(false);
    }
  };

  // Download Attendee List CSV
  const handleDownloadAttendees = async (eventId: string, eventTitle: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '';
      const res = await fetch(`${API_BASE_URL}/api/ticketing/organizer/events/${eventId}/export-attendees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendees_${eventTitle.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert('Could not export attendees: ' + err.message);
    }
  };

  // Download Tax Invoices CSV
  const handleDownloadTaxCsv = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '';
    const params = new URLSearchParams();
    if (selectedTaxYear) params.append('tax_year', selectedTaxYear);
    const exportUrl = `${API_BASE_URL}/api/ticketing/organizer/invoices/export?${params.toString()}`;

    fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const yearTag = selectedTaxYear ? selectedTaxYear.replace('/', '_') : 'all_years';
        a.download = `tax_invoices_${yearTag}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(err => {
        alert('Could not download CSV export: ' + err.message);
      });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Organizer Hub | Highland Events Hub</title>
        <meta name="description" content="Manage your event ticketing, attendee check-ins, Stripe payouts, and tax invoices in one unified dashboard." />
      </Head>

      <main className="min-h-screen bg-stone-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Banner */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-emerald-900 to-stone-900 rounded-3xl p-6 sm:p-8 text-white shadow-md">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                  Organizer Pro Portal
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3">
                <span>🎪 Organizer Hub</span>
              </h1>
              <p className="text-emerald-100/80 text-sm mt-1 max-w-2xl">
                Manage your ticketed events, monitor sales capacity, connect Stripe payouts, access tax receipts, and run gate check-in scanners.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/submit-event"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-golden-heather text-stone-900 hover:bg-white transition-all shadow-sm"
              >
                <span>+ Create New Event</span>
              </Link>
              <Link
                href="/account"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
              >
                <span>Account Overview</span>
              </Link>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-stone-200 mb-8 overflow-x-auto no-scrollbar gap-2 sm:gap-4">
            <button
              onClick={() => handleTabChange('events')}
              className={`pb-4 px-3 sm:px-5 font-bold text-sm sm:text-base whitespace-nowrap transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'events'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <span>🎟️</span>
              <span>Events & Sales</span>
              {events.length > 0 && (
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  {events.length}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('payouts')}
              className={`pb-4 px-3 sm:px-5 font-bold text-sm sm:text-base whitespace-nowrap transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'payouts'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <span>💳</span>
              <span>Payouts & Banking</span>
              {sellerStatus.payouts_enabled && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('invoices')}
              className={`pb-4 px-3 sm:px-5 font-bold text-sm sm:text-base whitespace-nowrap transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'invoices'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <span>🧾</span>
              <span>Invoices & Billing</span>
              {invoiceSummary.total_invoices > 0 && (
                <span className="text-xs bg-stone-200 text-stone-800 px-2 py-0.5 rounded-full font-bold">
                  {invoiceSummary.total_invoices}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('scanner')}
              className={`pb-4 px-3 sm:px-5 font-bold text-sm sm:text-base whitespace-nowrap transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'scanner'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <span>📷</span>
              <span>Door Scanner</span>
              {events.some(e => e.is_scanner_active) && (
                <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                  Live
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: EVENTS & SALES */}
          {activeTab === 'events' && (
            <div className="space-y-6">
              {eventsLoading ? (
                <div className="py-20 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-3" />
                  <p>Loading your ticketed events...</p>
                </div>
              ) : events.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
                  <span className="text-5xl block mb-3">🎟️</span>
                  <h3 className="text-xl font-bold text-gray-900">No Ticketed Events Yet</h3>
                  <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                    Enable ticketing on your events to sell passes, track capacity, and download guest lists.
                  </p>
                  <Link
                    href="/submit-event"
                    className="mt-6 inline-flex items-center px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm transition-all shadow-sm"
                  >
                    + Create a Ticketed Event
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {events.map((ev) => {
                    const dateFormatted = ev.date_start ? new Date(ev.date_start).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Date TBA';

                    const eventId = ev.id || ev.event_id || '';

                    return (
                      <div
                        key={eventId}
                        className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-emerald-300 transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              Ticketed Event
                            </span>
                            {ev.is_scanner_active && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Door Active
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 truncate">{ev.title}</h3>
                          <p className="text-xs text-gray-500 mt-1">📅 {dateFormatted} • 📍 {ev.venue_name || 'Highlands'}</p>

                          {/* Capacity Metrics */}
                          <div className="mt-4 max-w-md">
                            <div className="flex justify-between text-xs text-gray-600 font-semibold mb-1">
                              <span>Tickets Sold: {ev.total_tickets_sold || 0}</span>
                              <span>Gate Check-Ins: {ev.total_checked_in || 0}</span>
                            </div>
                            <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                                style={{
                                  width: `${(ev.total_tickets_sold || 0) > 0 ? Math.min(100, Math.round(((ev.total_checked_in || 0) / ev.total_tickets_sold) * 100)) : 0}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-3">
                          <Link
                            href={`/organizers/events/${eventId}/ticketing`}
                            className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all flex items-center gap-1.5"
                          >
                            <span>📊 Ticketing Dashboard</span>
                          </Link>

                          <button
                            onClick={() => handleDownloadAttendees(eventId, ev.title)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 transition-all flex items-center gap-1.5 border border-stone-200"
                          >
                            <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Guest List (CSV)</span>
                          </button>

                          <Link
                            href={`/events/${eventId}/edit`}
                            className="px-3 py-2 rounded-xl text-sm font-medium bg-white hover:bg-stone-50 text-stone-600 border border-stone-200 transition-all"
                          >
                            Edit
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PAYOUTS & BANKING */}
          {activeTab === 'payouts' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-6 border-b border-stone-100 pb-6 mb-6">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                      Direct Payout System
                    </span>
                    <h2 className="text-2xl font-black text-gray-900">Stripe Connect Account</h2>
                    <p className="text-sm text-gray-600 mt-1 max-w-xl">
                      Ticket sale funds are paid directly into your UK bank account with automated fee deduction and daily/weekly rolling payouts.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {sellerStatus.payouts_enabled ? (
                      <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        Payouts Active & Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Setup or Verification Pending
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
                    <span className="text-xs font-bold uppercase text-gray-400 block mb-1">Seller Level</span>
                    <div className="text-xl font-bold text-gray-900">
                      {sellerStatus.seller_tier >= 2 ? 'Verified Seller (Tier 2)' : 'Standard Organizer'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Direct ticket selling permission</p>
                  </div>

                  <div className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
                    <span className="text-xs font-bold uppercase text-gray-400 block mb-1">Card Processing</span>
                    <div className="text-xl font-bold text-emerald-700">
                      {sellerStatus.charges_enabled ? 'Ready for Payments' : 'Pending Setup'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Visa, Mastercard, Apple Pay, Google Pay</p>
                  </div>

                  <div className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
                    <span className="text-xs font-bold uppercase text-gray-400 block mb-1">Bank Deposits</span>
                    <div className="text-xl font-bold text-emerald-700">
                      {sellerStatus.payouts_enabled ? 'Active UK Account' : 'Setup Required'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Direct to your bank via Stripe</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={handleStripeConnect}
                    disabled={stripeConnecting}
                    className="px-6 py-3 rounded-xl font-bold text-sm bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all flex items-center gap-2"
                  >
                    {stripeConnecting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Connecting to Stripe...</span>
                      </>
                    ) : (
                      <>
                        <span>💳</span>
                        <span>{sellerStatus.is_connected ? 'Access Stripe Dashboard & Banking' : 'Complete Stripe Payout Setup'}</span>
                      </>
                    )}
                  </button>

                  <Link
                    href="/organizers/payouts"
                    className="px-5 py-3 rounded-xl font-semibold text-sm bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 transition-all"
                  >
                    Full Banking Details →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INVOICES & BILLING */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Gross Sales</div>
                  <div className="text-3xl font-black text-gray-900">£{invoiceSummary.total_gross.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 mt-2">{invoiceSummary.total_tickets} tickets across {invoiceSummary.total_invoices} orders</div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Platform Fees Deducted</div>
                  <div className="text-3xl font-black text-amber-700">£{invoiceSummary.total_fees.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 mt-2">Deductible service receipts</div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-emerald-100 bg-emerald-50/30 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">Net Payouts Received</div>
                  <div className="text-3xl font-black text-emerald-700">£{invoiceSummary.total_net.toFixed(2)}</div>
                  <div className="text-xs text-emerald-600 mt-2">Direct bank payouts</div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Total Invoices</div>
                  <div className="text-3xl font-black text-gray-900">{invoiceSummary.total_invoices}</div>
                  <div className="text-xs text-gray-500 mt-2">Itemized receipts on record</div>
                </div>
              </div>

              {/* Action and Filter Bar */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {taxYears.length > 0 && (
                    <select
                      value={selectedTaxYear}
                      onChange={(e) => setSelectedTaxYear(e.target.value)}
                      className="py-2 px-3 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">All UK Tax Years</option>
                      {taxYears.map(yr => (
                        <option key={yr} value={yr}>Tax Year: {yr}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadTaxCsv}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download Full Tax CSV</span>
                  </button>

                  <Link
                    href="/organizers/invoices"
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 transition-all border border-stone-200"
                  >
                    Full Invoices Portal →
                  </Link>
                </div>
              </div>

              {/* Invoices Mini Table */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {invoicesLoading ? (
                  <div className="py-16 text-center text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-3" />
                    <p>Loading invoice records...</p>
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <span className="text-4xl block mb-2">🧾</span>
                    <p className="font-bold text-gray-800">No Invoices Generated Yet</p>
                    <p className="text-xs text-gray-500 mt-1">Receipts are generated automatically when customer orders complete.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                      <thead className="bg-stone-50 border-b border-stone-200 text-xs font-bold uppercase text-gray-500">
                        <tr>
                          <th className="py-3 px-4">Invoice Ref</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Event</th>
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4 text-right">Gross</th>
                          <th className="py-3 px-4 text-right">Fee</th>
                          <th className="py-3 px-4 text-right">Net Payout</th>
                          <th className="py-3 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {invoices.slice(0, 10).map((inv) => (
                          <tr key={inv.order_id} className="hover:bg-stone-50/70">
                            <td className="py-3 px-4 font-mono font-bold text-emerald-800">{inv.invoice_ref}</td>
                            <td className="py-3 px-4 text-xs">{new Date(inv.created_at).toLocaleDateString('en-GB')}</td>
                            <td className="py-3 px-4 font-semibold text-gray-900 max-w-[180px] truncate">{inv.event_title}</td>
                            <td className="py-3 px-4 text-xs">{inv.buyer_name}</td>
                            <td className="py-3 px-4 text-right font-semibold text-gray-900">£{inv.total_gross.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-gray-500">£{inv.platform_fee.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-700">£{inv.net_payout.toFixed(2)}</td>
                            <td className="py-3 px-4 text-center">
                              <Link
                                href={`/organizers/invoices/${inv.order_id}`}
                                className="px-2.5 py-1 rounded text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                              >
                                View Receipt
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DOOR SCANNER */}
          {activeTab === 'scanner' && (
            <div className="space-y-6">
              {eventsLoading ? (
                <div className="py-20 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-3" />
                  <p>Loading scanner passes...</p>
                </div>
              ) : events.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
                  <span className="text-5xl block mb-3">📷</span>
                  <h3 className="text-xl font-bold text-gray-900">No Events for Scanning</h3>
                  <p className="text-sm text-gray-500 mt-2">When you create ticketed events, you can activate the door scanner here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {events.map((ev) => {
                    const eventId = ev.id || ev.event_id || '';
                    return (
                      <div
                        key={eventId}
                        className={`bg-white rounded-2xl border p-6 shadow-sm transition-all ${
                          ev.is_scanner_active ? 'border-green-300 ring-2 ring-green-100' : 'border-stone-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {ev.is_scanner_active ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-green-100 text-green-800">
                                  <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
                                  SCANNER ACTIVE & READY
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-600">
                                  <span className="w-2 h-2 rounded-full bg-stone-400"></span>
                                  Inactive
                                </span>
                              )}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">{ev.title}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">📍 {ev.venue_name || 'Highlands'}</p>
                          </div>

                          {/* Scanner Activation Controls */}
                          <div className="flex flex-wrap items-center gap-3">
                            {ev.is_scanner_active ? (
                              <>
                                <Link
                                  href={ev.scanner_url || `/scan/${eventId}?token=${ev.scanner_access_key}`}
                                  target="_blank"
                                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm flex items-center gap-2 transition-all"
                                >
                                  <span>📷 Launch Camera Scanner</span>
                                </Link>

                                <button
                                  onClick={() => setActiveStaffQrEvent(ev)}
                                  className="px-4 py-2.5 rounded-xl font-bold text-sm bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 transition-all flex items-center gap-1.5"
                                >
                                  <span>📱 Staff QR</span>
                                </button>

                                <button
                                  onClick={() => handleDeactivateScanner(eventId)}
                                  disabled={actionLoading === eventId}
                                  className="px-4 py-2.5 rounded-xl font-bold text-sm bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-all"
                                >
                                  <span>⏹ Stop</span>
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleActivateScanner(eventId)}
                                disabled={actionLoading === eventId}
                                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all flex items-center gap-2"
                              >
                                {actionLoading === eventId ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Activating...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>⚡</span>
                                    <span>Activate Event Scanner</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Check-In Progress Bar */}
                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                          <div className="flex justify-between text-xs text-gray-600 font-bold mb-1.5">
                            <span>Check-In Progress</span>
                            <span>{(ev.total_checked_in || 0)} / {(ev.total_tickets_sold || 0)} Checked In ({(ev.total_tickets_sold || 0) > 0 ? Math.round(((ev.total_checked_in || 0) / ev.total_tickets_sold) * 100) : 0}%)</span>
                          </div>
                          <div className="w-full bg-stone-200 rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-3 rounded-full transition-all duration-500"
                              style={{
                                width: `${(ev.total_tickets_sold || 0) > 0 ? Math.min(100, Math.round(((ev.total_checked_in || 0) / ev.total_tickets_sold) * 100)) : 0}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Staff QR Code Modal */}
          {activeStaffQrEvent && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl animate-fade-in border border-stone-200">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center text-2xl mx-auto mb-3">
                  📱
                </div>
                <h3 className="text-xl font-bold text-gray-900">Door Staff Scanner Pass</h3>
                <p className="text-xs text-gray-500 mt-1 mb-4">{activeStaffQrEvent.title}</p>

                <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-emerald-500 inline-block mb-4 shadow-xs">
                  <QRCodeSVG
                    value={
                      typeof window !== 'undefined'
                        ? `${window.location.origin}${activeStaffQrEvent.scanner_url || `/scan/${activeStaffQrEvent.id || activeStaffQrEvent.event_id}?token=${activeStaffQrEvent.scanner_access_key}`}`
                        : ''
                    }
                    size={200}
                    level="M"
                  />
                </div>

                <p className="text-xs text-gray-600 leading-relaxed mb-6">
                  Have your door volunteers point their phone cameras at this QR code. It will open the live ticket scanner immediately without needing a password.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}${activeStaffQrEvent.scanner_url || `/scan/${activeStaffQrEvent.id || activeStaffQrEvent.event_id}?token=${activeStaffQrEvent.scanner_access_key}`}`;
                      navigator.clipboard.writeText(link);
                      alert('Door scanner link copied to clipboard!');
                    }}
                    className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-colors border border-stone-200"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => setActiveStaffQrEvent(null)}
                    className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
