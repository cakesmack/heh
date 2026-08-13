import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { moderationAPI, eventsAPI } from '@/lib/api';
import { Report, EventResponse } from '@/types';
import DuplicateDiffModal from '@/components/admin/DuplicateDiffModal';
import ReportItem from '@/components/admin/ReportItem';
import ClaimsManager from '@/components/admin/ClaimsManager';

export default function AdminModeration() {
    const router = useRouter();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const tabQuery = router.query.tab as string;
    const activeTab = tabQuery === 'claims' ? 'claims' : 'reports';

    const handleTabChange = (tab: string) => {
        router.push({
            pathname: router.pathname,
            query: { ...router.query, tab }
        }, undefined, { shallow: true });
    };

    // Report Resolution State
    const [resolveReportId, setResolveReportId] = useState<number | null>(null);

    // Duplicate comparison state
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
    const [duplicateEvent, setDuplicateEvent] = useState<EventResponse | null>(null);
    const [duplicateMatchId, setDuplicateMatchId] = useState<string>('');

    const fetchReports = async () => {
        setLoading(true);
        try {
            const reportsData = await moderationAPI.getQueue();
            setReports(reportsData);
        } catch (err) {
            console.error('Failed to fetch reports:', err);
            setError('Failed to load moderation queue');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'reports') {
            fetchReports();
        }
    }, [activeTab]);

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

            // Fetch the event for the modal
            const newEvent = await eventsAPI.get(report.target_id);

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
            setDuplicateModalOpen(false);
            setDuplicateEvent(null);
            setResolveReportId(null);
        } catch (err) {
            console.error(err);
            alert('Failed to resolve duplicate conflict.');
        }
    };

    return (
        <AdminGuard>
            <AdminLayout title="Moderation & Claims">
                <div className="mb-6">
                    <div className="flex space-x-4 border-b border-gray-200">
                        <button
                            className={`py-2 px-4 font-medium text-sm ${activeTab === 'reports'
                                ? 'text-emerald-600 border-b-2 border-emerald-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                            onClick={() => handleTabChange('reports')}
                        >
                            User Reports {activeTab === 'reports' && !loading && `(${reports.length})`}
                        </button>
                        <button
                            className={`py-2 px-4 font-medium text-sm ${activeTab === 'claims'
                                ? 'text-emerald-600 border-b-2 border-emerald-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                            onClick={() => handleTabChange('claims')}
                        >
                            Venue & Group Claims
                        </button>
                    </div>
                </div>

                {activeTab === 'reports' && (
                    <>
                        {loading ? (
                            <div className="text-center py-12 text-gray-500">Loading queue...</div>
                        ) : error ? (
                            <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
                        ) : reports.length === 0 ? (
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

                {activeTab === 'claims' && <ClaimsManager />}

                {/* Duplicate Comparison Modal */}
                {duplicateModalOpen && duplicateEvent && duplicateMatchId && (
                    <DuplicateDiffModal
                        isOpen={duplicateModalOpen}
                        onClose={() => setDuplicateModalOpen(false)}
                        newEvent={duplicateEvent}
                        matchedEventId={duplicateMatchId}
                        onApprove={() => {}} // Not used in report resolution
                        onReject={() => {}} // Not used in report resolution
                        onResolve={resolveReportId ? handleResolveDuplicateDecision : undefined}
                    />
                )}
            </AdminLayout>
        </AdminGuard>
    );
}
