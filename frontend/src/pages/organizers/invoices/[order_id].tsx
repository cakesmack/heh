import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth, isApprovedSeller } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

interface LineItem {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface InvoiceDetail {
  invoice_ref: string;
  order_ref: string;
  issue_date: string;
  tax_year: string;
  status: string;
  platform: {
    name: string;
    address: string;
    support_email: string;
    vat_note: string;
  };
  organizer: {
    name: string;
    email: string;
  };
  event: {
    id: string;
    title: string;
    date_start: string;
    venue: string;
  };
  buyer: {
    name: string;
    email: string;
  };
  line_items: LineItem[];
  financials: {
    gross_amount: number;
    platform_fee: number;
    net_payout: number;
    currency: string;
  };
}

export default function SingleInvoicePage() {
  const router = useRouter();
  const { order_id } = router.query;
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.replace(`/login?redirect=/organizers/invoices/${order_id}`);
      } else if (!isApprovedSeller(user)) {
        router.replace('/403');
      }
    }
  }, [authLoading, isAuthenticated, user, order_id, router]);

  useEffect(() => {
    if (order_id && isAuthenticated && isApprovedSeller(user)) {
      setLoading(true);
      apiFetch<InvoiceDetail>(`/api/ticketing/organizer/invoices/${order_id}`)
        .then((data) => {
          setInvoice(data);
        })
        .catch((err) => {
          console.error('Failed to fetch invoice:', err);
          setError(err?.message || 'Failed to load invoice details.');
        })
        .finally(() => setLoading(false));
    }
  }, [order_id, isAuthenticated, user]);

  if (loading || authLoading || !isAuthenticated || !isApprovedSeller(user)) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent mb-3" />
          <p className="text-gray-500 font-medium">Generating Tax Invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center border border-stone-200 shadow-sm">
          <span className="text-4xl block mb-2">⚠️</span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invoice Not Found</h2>
          <p className="text-sm text-gray-600 mb-6">{error || 'Could not locate the requested invoice receipt.'}</p>
          <Link
            href="/organizers/invoices"
            className="inline-block px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm transition-colors"
          >
            Back to Invoices Hub
          </Link>
        </div>
      </div>
    );
  }

  const issueDateFormatted = new Date(invoice.issue_date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const eventDateFormatted = invoice.event.date_start
    ? new Date(invoice.event.date_start).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  return (
    <>
      <Head>
        <title>{invoice.invoice_ref} - Tax Invoice | Highland Events Hub</title>
        <style>{`
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            .no-print {
              display: none !important;
            }
            .print-container {
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
              max-width: 100% !important;
              margin: 0 !important;
            }
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
          }
        `}</style>
      </Head>

      <main className="min-h-screen bg-stone-100 py-10 px-4 sm:px-6">
        {/* Top Floating Action Bar */}
        <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between no-print">
          <Link
            href="/organizers/invoices"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-emerald-800 transition-colors"
          >
            <span>←</span>
            <span>Back to Invoices Hub</span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* Formal Single-Page Tax Invoice Container */}
        <div className="print-container max-w-3xl mx-auto bg-white rounded-2xl border border-stone-200 shadow-md p-8 sm:p-12 text-gray-800">
          {/* Header */}
          <div className="border-b border-gray-200 pb-8 mb-8 flex flex-wrap justify-between items-start gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🌲</span>
                <span className="text-xl font-black tracking-tight text-stone-900">HIGHLAND EVENTS HUB</span>
              </div>
              <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                {invoice.platform.address}
              </p>
              <p className="text-xs text-gray-500 mt-1">Email: {invoice.platform.support_email}</p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider rounded-md mb-2">
                TAX INVOICE & RECEIPT
              </span>
              <h2 className="text-2xl font-black font-mono text-gray-900">{invoice.invoice_ref}</h2>
              <p className="text-xs text-gray-500 mt-1">Issue Date: <strong>{issueDateFormatted}</strong></p>
              <p className="text-xs text-gray-500">UK Tax Year: <strong>{invoice.tax_year}</strong></p>
              <p className="text-xs text-gray-500">Order Ref: <strong className="font-mono text-emerald-800">{invoice.order_ref}</strong></p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
            {/* Event & Organizer */}
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
              <span className="text-xs font-bold uppercase text-gray-400 block mb-1">Event & Organizer</span>
              <h3 className="font-bold text-gray-900 text-base mb-1">{invoice.event.title}</h3>
              {eventDateFormatted && (
                <p className="text-xs text-gray-600 mb-1">📅 {eventDateFormatted}</p>
              )}
              {invoice.event.venue && (
                <p className="text-xs text-gray-600 mb-2">📍 {invoice.event.venue}</p>
              )}
              <div className="border-t border-gray-200 pt-2 mt-2 text-xs text-gray-500">
                Organizer: <strong>{invoice.organizer.name}</strong> ({invoice.organizer.email})
              </div>
            </div>

            {/* Customer / Attendee */}
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
              <span className="text-xs font-bold uppercase text-gray-400 block mb-1">Billed Customer</span>
              <h3 className="font-bold text-gray-900 text-base mb-1">{invoice.buyer.name}</h3>
              <p className="text-xs text-gray-600 mb-3">{invoice.buyer.email}</p>
              <div className="border-t border-gray-200 pt-2 text-xs text-gray-500">
                Payment Status: <strong className="text-emerald-700 capitalize">{invoice.status}</strong>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-8">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Ticket Sales Itemization</h4>
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 text-xs font-bold uppercase text-gray-500">
                  <th className="py-2.5">Description</th>
                  <th className="py-2.5 text-center">Qty</th>
                  <th className="py-2.5 text-right">Unit Price</th>
                  <th className="py-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.line_items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 font-semibold text-gray-800">{item.name}</td>
                    <td className="py-3 text-center text-gray-600">{item.quantity}</td>
                    <td className="py-3 text-right text-gray-600">£{item.unit_price.toFixed(2)}</td>
                    <td className="py-3 text-right font-semibold text-gray-900">£{item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown */}
          <div className="border-t-2 border-gray-200 pt-4 mb-8 flex justify-end">
            <div className="w-full sm:w-80 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Gross Ticket Turnover</span>
                <span className="font-semibold text-gray-900">£{invoice.financials.gross_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-xs">
                <span>Platform Service Fee</span>
                <span className="font-medium text-gray-700">-£{invoice.financials.platform_fee.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-base font-black text-emerald-800">
                <span>Net Payout Deposited</span>
                <span>£{invoice.financials.net_payout.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Legal / VAT Notice */}
          <div className="border-t border-gray-200 pt-6 text-xs text-gray-400 leading-relaxed text-center">
            <p className="font-semibold text-gray-500 mb-1">{invoice.platform.vat_note}</p>
            <p>Highland Events Hub • Supporting authentic events & culture across the Scottish Highlands.</p>
          </div>
        </div>
      </main>
    </>
  );
}
