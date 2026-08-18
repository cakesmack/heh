import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth, isApprovedSeller } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

interface InvoiceSummary {
  gross_sales: number;
  platform_fees: number;
  net_payout: number;
  total_invoices: number;
  currency: string;
}

interface InvoiceItem {
  invoice_ref: string;
  order_ref: string;
  issue_date: string;
  event_id: string;
  event_title: string;
  buyer_name: string;
  tax_year: string;
  gross_amount: number;
  platform_fee: number;
  net_payout: number;
  status: string;
  currency: string;
}

interface EventFilter {
  id: string;
  title: string;
}

export default function OrganizerInvoicesPage() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [eventsFilter, setEventsFilter] = useState<EventFilter[]>([]);
  const [taxYears, setTaxYears] = useState<string[]>([]);

  // Filters
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedTaxYear, setSelectedTaxYear] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.replace('/login?redirect=/organizers/invoices');
      } else if (!isApprovedSeller(user)) {
        router.replace('/403');
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedEventId) params.append('event_id', selectedEventId);
      if (selectedTaxYear) params.append('tax_year', selectedTaxYear);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch<any>(`/api/ticketing/organizer/invoices${queryString}`);
      setSummary(res.summary);
      setInvoices(res.invoices || []);
      setEventsFilter(res.events_filter || []);
      setTaxYears(res.tax_years || []);
    } catch (err: any) {
      console.error('Failed to load invoices:', err);
      setError(err?.message || 'Failed to load invoices and tax statements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchInvoices();
    }
  }, [isAuthenticated, selectedEventId, selectedTaxYear]);

  const handleDownloadCsv = () => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const params = new URLSearchParams();
    if (selectedEventId) params.append('event_id', selectedEventId);
    if (selectedTaxYear) params.append('tax_year', selectedTaxYear);

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    // Use window.open or fetch with bearer token to download
    const exportUrl = `${baseUrl}/ticketing/organizer/invoices/export?${params.toString()}`;
    
    // Trigger download via fetch to include authorization header
    fetch(exportUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
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

  const filteredInvoices = invoices.filter(inv => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      inv.invoice_ref.toLowerCase().includes(s) ||
      inv.order_ref.toLowerCase().includes(s) ||
      inv.buyer_name.toLowerCase().includes(s) ||
      inv.buyer_email.toLowerCase().includes(s) ||
      inv.event_title.toLowerCase().includes(s)
    );
  });

  if (authLoading || !isAuthenticated || !isApprovedSeller(user)) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Invoices & Tax Statements | Highland Events Hub</title>
        <meta name="description" content="View and download tax invoices, sales receipts, and platform fee statements for your ticketed events." />
      </Head>

      <main className="min-h-screen bg-stone-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb & Header */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                  <Link href="/account" className="hover:text-emerald-700 transition-colors">My Account</Link>
                  <span>/</span>
                  <Link href="/organizers/payouts" className="hover:text-emerald-700 transition-colors">Payouts</Link>
                  <span>/</span>
                  <span className="text-gray-900 font-semibold">Invoices & Tax Statements</span>
                </nav>
                <h1 className="text-3xl font-black text-stone-900 tracking-tight flex items-center gap-3">
                  <span>🧾 Invoices & Tax Statements</span>
                </h1>
                <p className="text-gray-600 mt-1">
                  Access official fee receipts, sales breakdowns, and export full tax records for accounting and HMRC filing.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Export Tax CSV</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm transition-all"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Print Summary</span>
                </button>
              </div>
            </div>
          </div>

          {/* Financial Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Gross Ticket Sales</div>
                <div className="text-3xl font-black text-gray-900">£{summary.total_gross.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-2">{summary.total_tickets} tickets sold across {summary.total_invoices} orders</div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Platform Service Fees</div>
                <div className="text-3xl font-black text-amber-700">£{summary.total_fees.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-2">Deducted fee receipts for accounting</div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/40 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">Net Payout Received</div>
                <div className="text-3xl font-black text-emerald-700">£{summary.total_net.toFixed(2)}</div>
                <div className="text-xs text-emerald-600 mt-2">Deposited directly via Stripe Connect</div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Total Tax Invoices</div>
                <div className="text-3xl font-black text-gray-900">{summary.total_invoices}</div>
                <div className="text-xs text-gray-500 mt-2">Itemized receipts on record</div>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm mb-6 flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by Invoice Ref, Order Ref, Customer, or Event..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Event Filter */}
            {eventsFilter.length > 0 && (
              <div className="min-w-[200px]">
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                >
                  <option value="">All Events</option>
                  {eventsFilter.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tax Year Filter */}
            {taxYears.length > 0 && (
              <div className="min-w-[160px]">
                <select
                  value={selectedTaxYear}
                  onChange={(e) => setSelectedTaxYear(e.target.value)}
                  className="w-full py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                >
                  <option value="">All Tax Years</option>
                  {taxYears.map((yr) => (
                    <option key={yr} value={yr}>Tax Year: {yr}</option>
                  ))}
                </select>
              </div>
            )}

            {(selectedEventId || selectedTaxYear || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedEventId('');
                  setSelectedTaxYear('');
                  setSearchTerm('');
                }}
                className="text-xs text-gray-500 hover:text-red-600 font-semibold underline px-2 py-1"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Invoices List Table */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-gray-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-3" />
                <p>Loading invoices and statements...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-600">
                <p className="font-semibold">{error}</p>
                <button
                  onClick={fetchInvoices}
                  className="mt-3 px-4 py-1.5 text-xs font-bold bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
                >
                  Retry
                </button>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                <span className="text-4xl block mb-2">🧾</span>
                <h3 className="font-bold text-gray-800 text-lg">No Invoices Found</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  {selectedEventId || selectedTaxYear || searchTerm
                    ? 'No invoices match your selected filters.'
                    : 'When attendees purchase tickets for your events, your itemized tax receipts and statements will appear here.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-stone-50 border-b border-stone-200 text-xs font-bold uppercase text-gray-500 tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Invoice Ref</th>
                      <th className="py-3.5 px-4">Date / Tax Year</th>
                      <th className="py-3.5 px-4">Event</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4 text-center">Tickets</th>
                      <th className="py-3.5 px-4 text-right">Gross</th>
                      <th className="py-3.5 px-4 text-right">Fee</th>
                      <th className="py-3.5 px-4 text-right">Net Payout</th>
                      <th className="py-3.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.order_id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-4 px-4 font-mono font-bold text-emerald-800">
                          {inv.invoice_ref}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-900">
                            {new Date(inv.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-gray-400">{inv.tax_year}</div>
                        </td>
                        <td className="py-4 px-4 font-semibold text-gray-900 max-w-[200px] truncate">
                          {inv.event_title}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-900">{inv.buyer_name}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[160px]">{inv.buyer_email}</div>
                        </td>
                        <td className="py-4 px-4 text-center font-semibold text-gray-700">
                          {inv.tickets_count}
                        </td>
                        <td className="py-4 px-4 text-right font-semibold text-gray-900">
                          £{inv.total_gross.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-right font-medium text-gray-500">
                          £{inv.platform_fee.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-emerald-700">
                          £{inv.net_payout.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Link
                            href={`/organizers/invoices/${inv.order_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200"
                          >
                            <span>View / Print</span>
                            <span>→</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tax Compliance Notice */}
          <div className="mt-8 bg-blue-50/60 border border-blue-200 rounded-2xl p-5 text-sm text-blue-900">
            <div className="flex items-start gap-3">
              <span className="text-xl">ℹ️</span>
              <div>
                <h4 className="font-bold mb-1">Tax & Accounting Compliance Note</h4>
                <p className="text-blue-800 text-xs leading-relaxed">
                  Highland Events Hub processes payments on behalf of registered organizers as an agent. The gross amounts shown represent ticket turnover for your tax accounts, and platform fees represent deductible service charges. Retain these itemized statements for your annual HMRC self-assessment or company tax return.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
