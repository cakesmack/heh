import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth, isApprovedSeller } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

interface ScannerEvent {
  event_id: string;
  title: string;
  date_start: string | null;
  date_end: string | null;
  venue_name?: string;
  image_url?: string;
  sales_frozen: boolean;
  is_scanner_active: boolean;
  scanner_access_key?: string | null;
  scanner_url?: string | null;
  total_tickets_sold: number;
  total_checked_in: number;
}

export default function OrganizerScannerHubPage() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [events, setEvents] = useState<ScannerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeQrModal, setActiveQrModal] = useState<ScannerEvent | null>(null);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  const fetchEvents = () => {
    apiFetch<{ events: ScannerEvent[] }>('/api/ticketing/organizer/scanner/events')
      .then(res => {
        setEvents(res.events || []);
      })
      .catch(err => {
        setError(err.message || 'Failed to load ticketed events for scanning.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.replace('/login?redirect=/organizers/scanner');
      } else if (!isApprovedSeller(user)) {
        router.replace('/403');
      } else {
        fetchEvents();
      }
    }
  }, [isAuthenticated, authLoading, user, router]);

  const handleActivate = async (eventId: string) => {
    setActionLoading(eventId);
    try {
      await apiFetch(`/api/ticketing/organizer/events/${eventId}/activate-scanner`, {
        method: 'POST'
      });
      fetchEvents();
    } catch (err: any) {
      alert(err.message || 'Failed to activate scanner.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (eventId: string) => {
    if (!confirm('Are you sure you want to deactivate the scanner for this event? Active door scanning sessions will be disconnected.')) {
      return;
    }
    setActionLoading(eventId);
    try {
      await apiFetch(`/api/ticketing/organizer/events/${eventId}/deactivate-scanner`, {
        method: 'POST'
      });
      fetchEvents();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate scanner.');
    } finally {
      setActionLoading(null);
    }
  };

  const getFullScannerUrl = (scannerUrl: string) => {
    if (typeof window === 'undefined') return scannerUrl;
    return `${window.location.origin}${scannerUrl}`;
  };

  const handleCopyLink = (event: ScannerEvent) => {
    if (!event.scanner_url) return;
    const fullUrl = getFullScannerUrl(event.scanner_url);
    navigator.clipboard.writeText(fullUrl);
    setCopiedEventId(event.event_id);
    setTimeout(() => setCopiedEventId(null), 3000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Date TBA';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[65vh] flex flex-col items-center justify-center p-12 text-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-stone-600 font-medium">Loading Scanner Hub...</p>
      </div>
    );
  }

  const scannerEligibleEvents = React.useMemo(() => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    return events
      .filter(ev => {
        if ((ev as any).is_cancelled || (ev as any).status === 'cancelled') return false;
        const endDate = ev.date_end ? new Date(ev.date_end) : (ev.date_start ? new Date(ev.date_start) : new Date(0));
        return endDate.getTime() >= twelveHoursAgo.getTime();
      })
      .sort((a, b) => {
        const aDate = a.date_start ? new Date(a.date_start).getTime() : 0;
        const bDate = b.date_start ? new Date(b.date_start).getTime() : 0;
        return aDate - bDate;
      });
  }, [events]);

  const activeCount = scannerEligibleEvents.filter(e => e.is_scanner_active).length;
  const totalSold = scannerEligibleEvents.reduce((acc, e) => acc + e.total_tickets_sold, 0);
  const totalCheckedIn = scannerEligibleEvents.reduce((acc, e) => acc + e.total_checked_in, 0);

  return (
    <div className="min-h-screen bg-stone-50 py-10 px-4">
      <Head>
        <title>Ticket Scanner Hub - Highland Events Hub</title>
      </Head>

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/account" className="text-xs font-bold text-stone-500 hover:text-stone-800">
                ← My Account
              </Link>
              <span className="text-stone-400 text-xs">•</span>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Door Operations</span>
            </div>
            <h1 className="text-3xl font-extrabold text-stone-900">Ticket Scanner & Check-In Hub</h1>
            <p className="text-sm text-stone-600 mt-1">
              Activate your events on event day to enable barcode scanning and manage attendee gate admissions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchEvents}
              className="text-xs font-bold bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <span>↻ Refresh Stats</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-stone-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Active / Upcoming Events</span>
            <p className="text-2xl font-black text-stone-900 mt-1">{scannerEligibleEvents.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-stone-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Active Scanners</span>
            <p className="text-2xl font-black text-emerald-700 mt-1 flex items-center gap-2">
              {activeCount}
              {activeCount > 0 && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>}
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-stone-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Overall Gate Admissions</span>
            <p className="text-2xl font-black text-stone-900 mt-1">
              {totalCheckedIn} <span className="text-sm font-normal text-stone-500">/ {totalSold} tickets</span>
            </p>
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-6">
          {scannerEligibleEvents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
              <span className="text-5xl block mb-3">📷</span>
              <h3 className="text-xl font-bold text-gray-900">No Events for Scanning</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                No active or upcoming events available for door scanning. Past events older than 12 hours and cancelled events are excluded.
              </p>
              <Link
                href="/submit-event"
                className="mt-6 inline-flex items-center px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm transition-all shadow-sm"
              >
                + Create New Event
              </Link>
            </div>
          ) : (
            scannerEligibleEvents.map(event => {
            const isProcessing = actionLoading === event.event_id;
            const percent = event.total_tickets_sold > 0 
              ? Math.min(100, Math.round((event.total_checked_in / event.total_tickets_sold) * 100))
              : 0;

            return (
              <div
                key={event.event_id}
                className={`bg-white rounded-2xl shadow-sm border transition ${
                  event.is_scanner_active ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-stone-200'
                }`}
              >
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: Event Info */}
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center gap-2">
                        {event.is_scanner_active ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
                            Scanner Active & Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 bg-stone-100 text-stone-600 text-xs font-bold rounded-full uppercase tracking-wider">
                            Scanner Inactive
                          </span>
                        )}

                        <span className="text-xs text-stone-400 font-mono">ID: {event.event_id.slice(0, 8)}</span>
                      </div>

                      <h2 className="text-xl md:text-2xl font-extrabold text-stone-900 leading-snug">
                        {event.title}
                      </h2>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600 pt-1">
                        <span>📅 {formatDate(event.date_start)}</span>
                        {event.venue_name && <span>📍 {event.venue_name}</span>}
                      </div>

                      {/* Check-in Progress Bar */}
                      <div className="pt-2">
                        <div className="flex justify-between text-xs font-bold text-stone-700 mb-1.5">
                          <span>Gate Check-Ins</span>
                          <span className="text-emerald-700">
                            {event.total_checked_in} / {event.total_tickets_sold} ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end gap-2.5 shrink-0">
                      {event.is_scanner_active ? (
                        <>
                          <Link
                            href={event.scanner_url || `/scan/${event.event_id}?token=${event.scanner_access_key}`}
                            target="_blank"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-xl text-sm shadow-sm transition flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            <span>📷 Launch Camera Scanner</span>
                          </Link>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveQrModal(event)}
                              className="flex-1 text-center bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                              title="Show QR code for door staff to scan and join instantly"
                            >
                              <span>📱 Staff QR</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyLink(event)}
                              className="flex-1 text-center bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>{copiedEventId === event.event_id ? '✓ Copied!' : '🔗 Copy Link'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeactivate(event.event_id)}
                              disabled={isProcessing}
                              className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3.5 py-2 rounded-xl text-xs border border-red-200 transition disabled:opacity-50 cursor-pointer"
                              title="Deactivate check-in session"
                            >
                              {isProcessing ? 'Stopping...' : '⏹ Stop'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleActivate(event.event_id)}
                          disabled={isProcessing}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-6 py-3 rounded-xl text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                          </svg>
                          <span>{isProcessing ? 'Activating Scanner...' : '⚡ Activate Event Scanner'}</span>
                        </button>
                      )}

                      <Link
                        href={`/organizers/events/${event.event_id}/ticketing`}
                        className="text-center text-xs text-stone-500 hover:text-stone-800 font-bold py-1"
                      >
                        Ticketing Dashboard →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* Staff Access QR Modal */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">
              📱
            </div>
            <h3 className="text-xl font-extrabold text-stone-900 mb-1">Door Staff Scanner Pass</h3>
            <p className="text-xs text-stone-500 mb-6">
              Have your door volunteers or gate staff point their phone camera at this QR code to launch the scanner immediately.
            </p>

            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl inline-block mb-6">
              <QRCodeSVG
                value={getFullScannerUrl(activeQrModal.scanner_url || '')}
                size={200}
                level="H"
              />
            </div>

            <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl mb-6 truncate">
              {activeQrModal.title}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleCopyLink(activeQrModal)}
                className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-2.5 rounded-xl text-xs transition"
              >
                {copiedEventId === activeQrModal.event_id ? '✓ Link Copied' : 'Copy Staff Link'}
              </button>
              <button
                type="button"
                onClick={() => setActiveQrModal(null)}
                className="flex-1 bg-stone-900 hover:bg-stone-800 text-white font-bold py-2.5 rounded-xl text-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
