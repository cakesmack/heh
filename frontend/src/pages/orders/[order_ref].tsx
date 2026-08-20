import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Head from 'next/head';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL } from '@/lib/api';

interface Ticket {
  id: string;
  qr_token: string;
  tier_id?: string;
  tier_name: string;
  tier_price?: number;
  status: string;
}

interface OrderDetail {
  order_ref: string;
  event_id: string;
  event_title: string;
  event_start: string | null;
  event_end: string | null;
  is_cancelled?: boolean;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  previous_date_start?: string | null;
  venue_name: string;
  venue_address: string;
  venue_town: string;
  organizer_name: string;
  buyer_name: string;
  buyer_email: string;
  total_amount: number;
  platform_fee_amount: number;
  status: string;
  created_at: string;
  tickets: Ticket[];
}

export default function OrderConfirmationPage() {
  const router = useRouter();
  const { order_ref } = router.query;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order_ref) return;
    
    axios.get(`${API_BASE_URL}/api/ticketing/checkout/orders/${order_ref}`)
      .then(res => {
        setOrder(res.data);
      })
      .catch(() => {
        setError('Order not found or access denied.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [order_ref]);

  const formatEventDate = (startStr: string | null, endStr: string | null) => {
    if (!startStr) return 'Date TBA';
    const start = new Date(startStr);
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    
    const formattedDate = start.toLocaleDateString('en-GB', dateOptions);
    const formattedStartTime = start.toLocaleTimeString('en-GB', timeOptions);

    if (endStr) {
      const end = new Date(endStr);
      const formattedEndTime = end.toLocaleTimeString('en-GB', timeOptions);
      return `${formattedDate} • ${formattedStartTime} – ${formattedEndTime}`;
    }

    return `${formattedDate} • ${formattedStartTime}`;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 font-medium">Loading your tickets...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
        <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">!</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
        <p className="text-gray-600 mb-6">{error || 'Could not load the requested order tickets.'}</p>
        <Link
          href="/account/tickets"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition"
        >
          View My Tickets
        </Link>
      </div>
    );
  }

  const formattedDate = formatEventDate(order.event_start, order.event_end);
  const locationString = [order.venue_name, order.venue_address, order.venue_town]
    .filter(Boolean)
    .join(', ') || 'Venue Details on Event Page';

  return (
    <div className="min-h-screen bg-stone-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
      <Head>
        <title>Tickets: {order.event_title} ({order.order_ref})</title>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { margin: 6mm; size: auto; }
            html, body { background: white !important; padding: 0 !important; margin: 0 !important; }
            header, footer, nav, .no-print, [data-no-print] { display: none !important; }
            .print-ticket-pass {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
              box-shadow: none !important;
              border: 1px solid #111827 !important;
              margin: 0 auto !important;
            }
          }
        `}} />
      </Head>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Cancelled Banner */}
        {(order.is_cancelled || order.status === 'refunded' || order.status === 'cancelled') ? (
          <div className="bg-red-50 rounded-2xl shadow-sm border-2 border-red-200 p-6 md:p-8 text-center no-print animate-in fade-in">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
              🚫
            </div>
            <h1 className="text-3xl font-extrabold text-red-900 mb-1">Event Cancelled</h1>
            <p className="text-red-700 text-sm max-w-md mx-auto mb-4 leading-relaxed">
              {order.total_amount > 0 ? (
                <>This event was cancelled by the organizer. A full face-value refund of <strong>£{(order.total_amount - (order.platform_fee_amount || 0)).toFixed(2)}</strong> has been automatically issued via Stripe back to your card.</>
              ) : (
                <>This event was cancelled by the organizer. Your RSVP reservation has been cancelled.</>
              )}
            </p>
            {order.cancellation_reason && (
              <div className="bg-white/80 border border-red-200 rounded-xl p-3 max-w-md mx-auto mb-5 text-xs text-red-900 italic font-medium">
                "{order.cancellation_reason}"
              </div>
            )}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 text-xs font-bold rounded-xl mb-4">
              All barcode passes for this booking are VOID and cannot be admitted.
            </div>
          </div>
        ) : (
          /* Top Confirmation Banner (Hidden in Print) */
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 md:p-8 text-center no-print">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
              ✓
            </div>
            <h1 className="text-3xl font-extrabold text-stone-900 mb-1">Booking Confirmed!</h1>
            <p className="text-stone-600 text-sm max-w-md mx-auto mb-5">
              Thank you, <strong>{order.buyer_name}</strong>. Your tickets are confirmed and ready for gate check-in.
            </p>

            {order.previous_date_start && (
              <div className="mb-5 p-3.5 bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold rounded-xl max-w-md mx-auto flex items-center gap-2 text-left">
                <span className="text-base">📅</span>
                <span><strong>Date Rescheduled:</strong> The event date was updated. Your tickets remain 100% valid for the new date!</span>
              </div>
            )}

            {order.buyer_email && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl mb-6">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                <span>A copy of your tickets has been sent to <strong>{order.buyer_email}</strong></span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-sm shadow-sm transition flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Save as PDF / Print</span>
              </button>

              <Link
                href="/account/tickets"
                className="bg-stone-900 hover:bg-stone-800 text-white font-bold px-5 py-3 rounded-xl text-sm transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                <span>View All My Tickets</span>
              </Link>
              <Link
                href={`/events/${order.event_id}`}
                className="bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold px-5 py-3 rounded-xl text-sm transition"
              >
                View Event Page
              </Link>
            </div>
          </div>
        )}

        {/* Printable Ticket Passes */}
        <div className="space-y-6">
          {order.tickets.map((ticket, index) => (
            <div
              key={ticket.id}
              className="print-ticket-pass bg-white rounded-2xl shadow-md border border-stone-200 overflow-hidden print:shadow-none print:rounded-none"
            >
              {/* Ticket Brand Top Header */}
              <div className="bg-emerald-900 text-white px-6 py-3 flex justify-between items-center print:bg-stone-900 print:text-white">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-wide text-xs uppercase text-emerald-300 print:text-stone-300">
                    Highland Events Hub
                  </span>
                  <span className="text-xs opacity-60">•</span>
                  <span className="text-xs font-semibold text-stone-200">Official Event Pass</span>
                </div>
                <div className="font-mono text-xs font-bold text-emerald-200 print:text-stone-200">
                  Ref: {order.order_ref}
                </div>
              </div>

              {/* Event & Ticket Details Grid */}
              <div className="p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  {/* Left 2 Cols: Event, Venue, Date, Price */}
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md uppercase tracking-wider print:border print:border-emerald-800">
                          {ticket.tier_name}
                        </span>
                        {ticket.tier_price !== undefined && ticket.tier_price > 0 && (
                          <span className="text-xs font-bold text-gray-500">
                            Face Value: £{ticket.tier_price.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl md:text-3xl font-black text-stone-900 leading-tight">
                        {order.event_title}
                      </h2>
                      {order.organizer_name && (
                        <p className="text-xs text-stone-600 font-medium mt-1 flex items-center gap-1.5">
                          <span className="text-emerald-700 font-bold">Organizer:</span>
                          <span>{order.organizer_name}</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-stone-700 pt-1">
                      {/* Date & Time */}
                      <div className="flex items-start gap-2.5">
                        <span className="text-emerald-700 text-base leading-none mt-0.5">📅</span>
                        <div>
                          <p className="font-bold text-stone-900">{formattedDate}</p>
                        </div>
                      </div>

                      {/* Location / Venue */}
                      <div className="flex items-start gap-2.5">
                        <span className="text-emerald-700 text-base leading-none mt-0.5">📍</span>
                        <div>
                          <p className="font-bold text-stone-900">{order.venue_name || 'Event Location'}</p>
                          {(order.venue_address || order.venue_town) && (
                            <p className="text-xs text-stone-500">
                              {[order.venue_address, order.venue_town].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Sub-Bar */}
                    <div className="pt-3 border-t border-stone-200 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-stone-400 block uppercase font-medium text-[10px]">Attendee</span>
                        <span className="font-bold text-stone-900 truncate block">{order.buyer_name}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block uppercase font-medium text-[10px]">Price</span>
                        <span className="font-bold text-emerald-700 block">
                          {ticket.tier_price !== undefined && ticket.tier_price > 0
                            ? `£${ticket.tier_price.toFixed(2)}`
                            : order.total_amount > 0
                            ? `£${(order.total_amount / order.tickets.length).toFixed(2)}`
                            : 'Free'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block uppercase font-medium text-[10px]">Ticket</span>
                        <span className="font-bold text-stone-900 block">
                          {index + 1} of {order.tickets.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Col: High-Res QR Code */}
                  <div className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center print:bg-white relative overflow-hidden ${
                    order.is_cancelled || ticket.status === 'refunded' || ticket.status === 'cancelled'
                      ? 'bg-red-50/50 border-red-200'
                      : 'bg-stone-50 border-stone-200'
                  }`}>
                    <div className={`p-2.5 bg-white border border-stone-200 rounded-xl shadow-xs inline-block relative ${
                      order.is_cancelled || ticket.status === 'refunded' || ticket.status === 'cancelled' ? 'opacity-40 grayscale' : ''
                    }`}>
                      <QRCodeSVG value={ticket.qr_token} size={150} level="H" />
                    </div>
                    <p className="text-[10px] font-mono text-stone-400 mt-2 truncate max-w-[170px]">
                      {ticket.id}
                    </p>
                    {order.is_cancelled || ticket.status === 'refunded' || ticket.status === 'cancelled' ? (
                      <span className="mt-1.5 px-3 py-0.5 bg-red-100 text-red-800 font-black text-[11px] rounded-full uppercase tracking-wider border border-red-200">
                        🚫 Void / Refunded
                      </span>
                    ) : (
                      <span className="mt-1.5 px-3 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[11px] rounded-full uppercase tracking-wider">
                        {ticket.status === 'checked_in' ? 'Checked In' : 'Valid for Entry'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Ticket Footer Notice */}
              <div className="bg-stone-50 border-t border-stone-100 px-6 py-2.5 flex justify-between items-center text-[11px] text-stone-500 print:bg-white">
                <span>Please present this digital QR pass on arrival or bring a printed copy.</span>
                <span className="font-medium text-stone-400">highlandeventshub.co.uk</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
