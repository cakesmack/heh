import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '@/lib/api';
import { PendingEvent } from '@/types';
import { Check, X, ExternalLink, Calendar, MapPin, RefreshCw, Trash2, CheckCheck, Eye, Clock } from 'lucide-react';
import { formatEventPrice } from '@/lib/formatPrice';

interface PendingEventsQueueProps {
  onCountChange?: (count: number) => void;
}

export default function PendingEventsQueue({ onCountChange }: PendingEventsQueueProps) {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchPendingEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminAPI.getPendingEvents();
      setEvents(data);
      if (onCountChange) {
        onCountChange(data.length);
      }
    } catch (err: any) {
      console.error('Failed to fetch pending events queue:', err);
      setError(err?.message || 'Failed to load pending events queue.');
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    fetchPendingEvents();
  }, [fetchPendingEvents]);

  const handleApprove = async (id: string, title: string) => {
    setActionLoading(id);
    setSuccessMessage(null);
    try {
      await adminAPI.approvePendingEvent(id);
      const updated = events.filter((e) => e.id !== id);
      setEvents(updated);
      if (onCountChange) onCountChange(updated.length);
      setSuccessMessage(`Approved and published "${title}".`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Failed to approve event: ${err?.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to reject and discard "${title}"?`)) return;
    setActionLoading(id);
    setSuccessMessage(null);
    try {
      await adminAPI.rejectPendingEvent(id);
      const updated = events.filter((e) => e.id !== id);
      setEvents(updated);
      if (onCountChange) onCountChange(updated.length);
      setSuccessMessage(`Rejected "${title}".`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Failed to reject event: ${err?.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAll = async () => {
    if (!confirm(`Are you sure you want to approve all ${events.length} pending events?`)) return;
    setBulkLoading(true);
    setSuccessMessage(null);
    let successCount = 0;
    try {
      for (const event of events) {
        try {
          await adminAPI.approvePendingEvent(event.id);
          successCount++;
        } catch (e) {
          console.error(`Failed to approve event ${event.id}:`, e);
        }
      }
      await fetchPendingEvents();
      setSuccessMessage(`Bulk approval complete: ${successCount} event(s) published.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(`Error during bulk approval: ${err?.message || 'Unknown error'}`);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm(`CAUTION: Are you sure you want to completely clear and reject all ${events.length} pending events?`)) return;
    setBulkLoading(true);
    setSuccessMessage(null);
    try {
      await adminAPI.clearAllPendingEvents();
      setEvents([]);
      if (onCountChange) onCountChange(0);
      setSuccessMessage('Cleared all pending events from staging.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Error clearing queue: ${err?.message || 'Unknown error'}`);
    } finally {
      setBulkLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-gray-500">Loading pending events staging queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl">
        <h4 className="font-bold text-red-900 mb-1">Failed to load Pending Events</h4>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchPendingEvents}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>Pending Events Staging Queue</span>
            <span className="px-2.5 py-0.5 text-xs font-extrabold rounded-full bg-emerald-100 text-emerald-800">
              {events.length} queued
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Review, verify, and approve incoming scraped and submitted events before publishing to the live catalog.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPendingEvents}
            disabled={loading || bulkLoading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            title="Refresh queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {events.length > 0 && (
            <>
              <button
                onClick={handleClearAll}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
              <button
                onClick={handleApproveAll}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Approve All ({events.length})</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Empty State */}
      {events.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900">Queue is Clear</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            There are no pending events requiring moderation approval at this time.
          </p>
        </div>
      ) : (
        /* Event Cards Grid / List */
        <div className="space-y-4">
          {events.map((event) => {
            const isExpanded = expandedId === event.id;
            const isProcessing = actionLoading === event.id || bulkLoading;

            const formattedDate = event.date_start
              ? new Date(event.date_start).toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'No date';

            return (
              <div
                key={event.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs hover:border-gray-300 transition-all"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Event Thumbnail & Basic Info */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {event.image_url ? (
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0 relative border border-gray-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
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
                      <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 border border-gray-200">
                        <Calendar className="w-8 h-8 opacity-40" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded-md bg-stone-100 text-stone-700">
                          {event.source || 'Scraper'}
                        </span>
                        {event.category_name && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-emerald-50 text-emerald-700">
                            {event.category_name}
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-50 text-amber-800">
                          {formatEventPrice(event as any)}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-gray-900 leading-snug truncate" title={event.title}>
                        {event.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-500 mt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{formattedDate}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span className="truncate max-w-[200px]">{event.venue_name || 'Unspecified Venue'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : event.id)}
                      className="px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isExpanded ? 'Hide' : 'Details'}</span>
                    </button>

                    <button
                      onClick={() => handleReject(event.id, event.title)}
                      disabled={isProcessing}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition-colors disabled:opacity-50"
                      title="Reject and delete"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleApprove(event.id, event.title)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                    >
                      {actionLoading === event.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Approve</span>
                    </button>
                  </div>
                </div>

                {/* Expandable Details Pane */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 border-t border-gray-100 bg-gray-50/50 space-y-3 text-xs text-gray-700">
                    {event.description && (
                      <div>
                        <span className="font-bold text-gray-900 block mb-1">Description:</span>
                        <p className="whitespace-pre-line bg-white p-3 rounded-xl border border-gray-200 leading-relaxed max-h-48 overflow-y-auto">
                          {event.description}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      {event.ticket_url && (
                        <a
                          href={event.ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-semibold"
                        >
                          <span>Ticket Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {event.website_url && (
                        <a
                          href={event.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline font-semibold"
                        >
                          <span>Official Website</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {event.age_restriction && (
                        <span className="text-gray-500">
                          <strong>Age Restriction:</strong> {event.age_restriction}
                        </span>
                      )}
                      {event.raw_showtimes && event.raw_showtimes.length > 0 && (
                        <span className="text-gray-500">
                          <strong>Showtimes:</strong> {event.raw_showtimes.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
