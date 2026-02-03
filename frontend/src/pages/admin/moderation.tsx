import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { moderationAPI } from '@/lib/api';
import { Report, EventResponse } from '@/types';
import Link from 'next/link';
import DuplicateDiffModal from '@/components/admin/DuplicateDiffModal';
import ReportItem from '@/components/admin/ReportItem';

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

    // Duplicate comparison state
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
    const [duplicateEvent, setDuplicateEvent] = useState<EventResponse | null>(null);
    const [duplicateMatchId, setDuplicateMatchId] = useState<string>('');

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

    // Report Resolution State
    const [resolveReportId, setResolveReportId] = useState<number | null>(null);

    const handleResolveReport = async (reportId: number, action: 'resolve' | 'dismiss') => {
        try {
            await moderationAPI.resolveReport(reportId, action);
            setReports(reports.filter(r => r.id !== reportId));
        } catch (err) {
            alert('Failed to update report');
        }
    };

    const handleReviewConflict = async (report: Report) => {
        if (!report.details) return;
        try {
            const details = JSON.parse(report.details);
            const matchedEventId = details.matched_event_id;

            // We need the NEW event details to show in the modal.
            // Check if it's already in pendingEvents
            let newEvent = pendingEvents.find(e => e.id === report.target_id);

            if (!newEvent) {
                // Fetch it if not in list
                // Note: The new endpoint for getting a single event might be needed if it's not pending?
                // Or acts as get(id). eventsAPI.get(id) should work.
                const { eventsAPI } = await import('@/lib/api');
                newEvent = await eventsAPI.get(report.target_id);
            }

            if (newEvent && matchedEventId) {
                setDuplicateEvent(newEvent);
                setDuplicateMatchId(matchedEventId);
                setResolveReportId(report.id); // Mark that we are resolving THIS report
                setDuplicateModalOpen(true);
            }
        } catch (e) {
            console.error("Failed to parse report details", e);
            alert("Could not load duplicate details.");
        }
    };

    const handleResolveDuplicateDecision = async (decision: 'KEEP_ORIGINAL' | 'REPLACE_WITH_NEW') => {
        if (!resolveReportId || !duplicateEvent || !duplicateMatchId) return;

        try {
            await moderationAPI.resolveDuplicate(
                resolveReportId,
                decision,
                duplicateEvent.id,
                duplicateMatchId
            );

            // Cleanup UI
            setReports(reports.filter(r => r.id !== resolveReportId));
            setPendingEvents(pendingEvents.filter(e => e.id !== duplicateEvent.id)); // If it was pending, it's represented

            setDuplicateModalOpen(false);
            setDuplicateEvent(null);
            setResolveReportId(null);

        } catch (err) {
            console.error(err);
            alert('Failed to resolve duplicate conflict.');
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

    const handleOpenDuplicateCheck = (event: EventResponse, matchId: string) => {
        setDuplicateEvent(event);
        setDuplicateMatchId(matchId);
        setResolveReportId(null); // Not resolving a report, just the event flow
        setDuplicateModalOpen(true);
    };

    const handleDuplicateDecision = async (eventId: string, action: 'approve' | 'reject', reason?: string) => {
        // Standard event moderation (not report resolution)
        await handleModerateEvent(eventId, action, reason);
        setDuplicateModalOpen(false);
        setDuplicateEvent(null);
    };

    // Helper to find duplicate report info
    const getDuplicateInfo = (eventId: string) => {
        const report = reports.find(r => r.target_id === eventId && r.reason === 'Potential Duplicate');
        if (!report || !report.details) return null;
        try {
            const details = JSON.parse(report.details);
            return details.matched_event_id;
        } catch (e) {
            return null;
        }
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
                                    <div className="space-y-4">
                                        {reports.map((report) => (
                                            <ReportItem
                                                key={report.id}
                                                report={report}
                                                onDismiss={(id) => handleResolveReport(id, 'dismiss')}
                                                onResolve={(id) => handleResolveReport(id, 'resolve')}
                                                onReviewConflict={handleReviewConflict}
                                            />
                                        ))}
                                    </div>
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
                                    pendingEvents.map((event) => {
                                        const duplicateMatchId = getDuplicateInfo(event.id);
                                        return (
                                            <div key={event.id} className="bg-white rounded-lg shadow p-6">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <h3 className="text-xl font-bold text-gray-900 mb-2">{event.title}</h3>
                                                        {/* Show moderation reason if flagged */}
                                                        {event.moderation_reason && (
                                                            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                                                                <span className="text-sm font-semibold text-red-700">
                                                                    ⚠️ Flagged: {event.moderation_reason}
                                                                </span>
                                                                {duplicateMatchId && (
                                                                    <button
                                                                        onClick={() => handleOpenDuplicateCheck(event, duplicateMatchId)}
                                                                        className="text-xs font-bold text-red-700 underline hover:text-red-900"
                                                                    >
                                                                        Review Duplicate Match &rarr;
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>
                                                        <div className="flex gap-4 text-sm text-gray-500">
                                                            <span>📅 {new Date(event.date_start).toLocaleDateString()}</span>
                                                            <span>📍 {event.venue_name || 'Unknown Venue'}</span>
                                                            <span>👤 {event.organizer_id}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2 ml-4">
                                                        {duplicateMatchId ? (
                                                            <button
                                                                onClick={() => handleOpenDuplicateCheck(event, duplicateMatchId)}
                                                                className="px-4 py-2 text-sm text-white bg-amber-500 rounded hover:bg-amber-600 shadow-sm"
                                                            >
                                                                Compare
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleModerateEvent(event.id, 'approve')}
                                                                className="px-4 py-2 text-sm text-white bg-emerald-600 rounded hover:bg-emerald-700"
                                                            >
                                                                Approve
                                                            </button>
                                                        )}
                                                        <Link href={`/events/${event.id}`} target="_blank" className="text-center px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                                                            Preview
                                                        </Link>
                                                        {!duplicateMatchId && (
                                                            <button
                                                                onClick={() => openRejectModal(event)}
                                                                className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                                                            >
                                                                Reject
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
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

                {/* Duplicate Comparison Modal */}
                {duplicateModalOpen && duplicateEvent && duplicateMatchId && (
                    <DuplicateDiffModal
                        isOpen={duplicateModalOpen}
                        onClose={() => setDuplicateModalOpen(false)}
                        newEvent={duplicateEvent}
                        matchedEventId={duplicateMatchId}
                        onApprove={(id) => handleDuplicateDecision(id, 'approve')}
                        onReject={(id, reason) => handleDuplicateDecision(id, 'reject', reason)}
                        onResolve={resolveReportId ? handleResolveDuplicateDecision : undefined}
                    />
                )}
            </AdminLayout>
        </AdminGuard>
    );
}
