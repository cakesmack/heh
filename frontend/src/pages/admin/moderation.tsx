import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { moderationAPI } from '@/lib/api';
import { Report, EventResponse } from '@/types';
import Link from 'next/link';

export default function AdminModeration() {
    const [reports, setReports] = useState<Report[]>([]);
    const [pendingEvents, setPendingEvents] = useState<EventResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'reports' | 'events'>('reports');

    // Rejection modal state
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectingEvent, setRejectingEvent] = useState<EventResponse | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [reportsData, eventsData] = await Promise.all([
                moderationAPI.getQueue(),
                moderationAPI.getPendingEvents(),
            ]);
            setReports(reportsData);
            setPendingEvents(eventsData);
        } catch (err) {
            console.error('Failed to fetch moderation data:', err);
            setError('Failed to load moderation queue');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleResolveReport = async (reportId: number, action: 'resolve' | 'dismiss') => {
        try {
            await moderationAPI.resolveReport(reportId, action);
            setReports(reports.filter(r => r.id !== reportId));
        } catch (err) {
            alert('Failed to update report');
        }
    };

    const handleModerateEvent = async (eventId: string, action: 'approve' | 'reject', reason?: string) => {
        try {
            await moderationAPI.moderateEvent(eventId, action, reason);
            setPendingEvents(pendingEvents.filter(e => e.id !== eventId));
        } catch (err) {
            alert('Failed to update event');
        }
    };

    // Open rejection modal
    const openRejectModal = (event: EventResponse) => {
        setRejectingEvent(event);
        setRejectionReason('');
        setRejectModalOpen(true);
    };

    // Confirm rejection with reason
    const confirmRejection = async () => {
        if (!rejectingEvent) return;
        if (!rejectionReason.trim()) {
            alert('Please provide a rejection reason');
            return;
        }
        await handleModerateEvent(rejectingEvent.id, 'reject', rejectionReason.trim());
        setRejectModalOpen(false);
        setRejectingEvent(null);
        setRejectionReason('');
    };

    return (
        <AdminGuard>
            <AdminLayout title="Moderation Queue">
                <div className="mb-6">
                    <div className="flex space-x-4 border-b border-gray-200">
                        <button
                            className={`py-2 px-4 font-medium text-sm ${activeTab === 'reports'
                                ? 'text-emerald-600 border-b-2 border-emerald-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                            onClick={() => setActiveTab('reports')}
                        >
                            User Reports ({reports.length})
                        </button>
                        <button
                            className={`py-2 px-4 font-medium text-sm ${activeTab === 'events'
                                ? 'text-emerald-600 border-b-2 border-emerald-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                            onClick={() => setActiveTab('events')}
                        >
                            Pending Events ({pendingEvents.length})
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading queue...</div>
                ) : error ? (
                    <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
                ) : (
                    <div className="space-y-6">
                        {activeTab === 'reports' && (
                            <>
                                {reports.length === 0 ? (
                                    <div className="text-center py-12 bg-white rounded-lg shadow text-gray-500">
                                        No pending reports. Good job!
                                    </div>
                                ) : (
                                    reports.map((report) => (
                                        <div key={report.id} className="bg-white rounded-lg shadow p-6">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${report.target_type === 'event' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                                            }`}>
                                                            {report.target_type}
                                                        </span>
                                                        <span className="text-sm text-gray-500">
                                                            Reported on {new Date(report.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                                                        Reason: {report.reason}
                                                    </h3>
                                                    {report.details && (
                                                        <p className="text-gray-600 mb-4 bg-gray-50 p-3 rounded text-sm">
                                                            "{report.details}"
                                                        </p>
                                                    )}
                                                    <div className="text-sm text-gray-500">
                                                        Target ID: <Link href={`/${report.target_type}s/${report.target_id}`} className="text-emerald-600 hover:underline" target="_blank">{report.target_id}</Link>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleResolveReport(report.id, 'dismiss')}
                                                        className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                                                    >
                                                        Dismiss
                                                    </button>
                                                    <button
                                                        onClick={() => handleResolveReport(report.id, 'resolve')}
                                                        className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                                                    >
                                                        Resolve (Take Action)
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </>
                        )}

                        {activeTab === 'events' && (
                            <>
                                {pendingEvents.length === 0 ? (
                                    <div className="text-center py-12 bg-white rounded-lg shadow text-gray-500">
                                        No pending events.
                                    </div>
                                ) : (
                                    pendingEvents.map((event) => (
                                        <div key={event.id} className="bg-white rounded-lg shadow p-6">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <h3 className="text-xl font-bold text-gray-900 mb-2">{event.title}</h3>
                                                    <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>
                                                    <div className="flex gap-4 text-sm text-gray-500">
                                                        <span>📅 {new Date(event.date_start).toLocaleDateString()}</span>
                                                        <span>📍 {event.venue_name || 'Unknown Venue'}</span>
                                                        <span>👤 {event.organizer_id}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 ml-4">
                                                    <Link href={`/events/${event.id}`} target="_blank" className="text-center px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                                                        Preview
                                                    </Link>
                                                    <button
                                                        onClick={() => handleModerateEvent(event.id, 'approve')}
                                                        className="px-4 py-2 text-sm text-white bg-emerald-600 rounded hover:bg-emerald-700"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => openRejectModal(event)}
                                                        className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Rejection Reason Modal */}
                {rejectModalOpen && rejectingEvent && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity"
                                onClick={() => setRejectModalOpen(false)}
                            />

                            {/* Modal */}
                            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 z-10">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">
                                    Reject Event
                                </h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Rejecting: <strong>{rejectingEvent.title}</strong>
                                </p>

                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Rejection Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Explain why this event is being rejected..."
                                    rows={4}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    required
                                />

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        onClick={() => setRejectModalOpen(false)}
                                        className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmRejection}
                                        className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                                    >
                                        Confirm Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </AdminLayout>
        </AdminGuard>
    );
}
