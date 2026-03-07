import { useEffect, useState } from 'react';
import Head from 'next/head';
import { AuthGuard } from '@/components/common/AuthGuard';
import AdminLayout from '@/components/admin/AdminLayout';
import { adminAPI } from '@/lib/api';

export default function CampaignsPage() {
    return (
        <AuthGuard requireAdmin>
            <CampaignsContent />
        </AuthGuard>
    );
}

function CampaignsContent() {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [testLoading, setTestLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [lastCampaignId, setLastCampaignId] = useState<string | null>(null);

    useEffect(() => {
        const fetchCount = async () => {
            try {
                const data = await adminAPI.getSubscriberCount();
                setSubscriberCount(data.subscriber_count);
            } catch (err) {
                console.error('Failed to fetch subscriber count:', err);
            }
        };
        fetchCount();
    }, []);

    const clearFeedback = () => {
        setTimeout(() => setFeedback(null), 8000);
    };

    const handleTestSend = async () => {
        if (!subject.trim() || !body.trim()) {
            setFeedback({ type: 'error', message: 'Subject and body are required.' });
            clearFeedback();
            return;
        }

        setTestLoading(true);
        setFeedback(null);
        try {
            const result = await adminAPI.sendTestCampaign(subject, body);
            setFeedback({ type: 'success', message: result.message });
        } catch (err: any) {
            setFeedback({ type: 'error', message: err?.detail || 'Failed to send test email.' });
        } finally {
            setTestLoading(false);
            clearFeedback();
        }
    };

    const handleBatchSend = async () => {
        setShowConfirm(false);
        setLoading(true);
        setFeedback(null);
        try {
            const result = await adminAPI.sendCampaign(subject, body);
            setLastCampaignId(result.campaign_id);
            setFeedback({
                type: 'success',
                message: `Campaign "${result.campaign_id}" started. Sending to ${result.recipient_count} subscribers in the background.`,
            });
        } catch (err: any) {
            setFeedback({ type: 'error', message: err?.detail || 'Failed to start campaign.' });
        } finally {
            setLoading(false);
            clearFeedback();
        }
    };

    return (
        <AdminLayout title="Email Campaigns">
            <Head>
                <title>Email Campaigns | Admin</title>
            </Head>

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Subscriber Count Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-100 rounded-xl">
                                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Active Subscribers</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {subscriberCount !== null ? subscriberCount : '—'}
                                </p>
                            </div>
                        </div>
                        <div className="text-xs text-gray-400 text-right">
                            Users with<br />"News & Updates" enabled
                        </div>
                    </div>
                </div>

                {/* Compose Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Compose Campaign
                    </h2>

                    {/* Subject */}
                    <div>
                        <label htmlFor="campaign-subject" className="block text-sm font-medium text-gray-700 mb-1">
                            Subject Line
                        </label>
                        <input
                            id="campaign-subject"
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="e.g. What's On This Week in the Highlands"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>

                    {/* Body */}
                    <div>
                        <label htmlFor="campaign-body" className="block text-sm font-medium text-gray-700 mb-1">
                            Message Body <span className="text-gray-400 font-normal">(HTML supported)</span>
                        </label>
                        <textarea
                            id="campaign-body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={14}
                            placeholder="<p>Hi there,</p><p>Here's what's happening this week...</p>"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-y"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                            This HTML will be injected into the branded email template. Include &lt;p&gt;, &lt;h3&gt;, &lt;a&gt; tags as needed.
                        </p>
                    </div>

                    {/* Feedback */}
                    {feedback && (
                        <div
                            className={`p-4 rounded-xl text-sm font-medium ${feedback.type === 'success'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                    : 'bg-rose-50 text-rose-800 border border-rose-100'
                                }`}
                        >
                            {feedback.message}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            onClick={handleTestSend}
                            disabled={testLoading || !subject.trim() || !body.trim()}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {testLoading ? (
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            )}
                            Send Test to Me
                        </button>

                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={loading || !subject.trim() || !body.trim()}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? (
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            )}
                            Send to All Subscribers
                        </button>
                    </div>

                    {/* Last Campaign ID */}
                    {lastCampaignId && (
                        <p className="text-xs text-gray-500">
                            Last Campaign ID: <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-700">{lastCampaignId}</code>
                            — Check server logs for delivery progress.
                        </p>
                    )}
                </div>

                {/* Info Card */}
                <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
                    <div className="flex gap-3">
                        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm text-amber-800 space-y-1">
                            <p className="font-semibold">How it works</p>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                                <li>"Send Test" delivers one email to your admin address immediately.</li>
                                <li>"Send to All" runs as a background task — your browser won't time out.</li>
                                <li>Emails are sent at ~1 per second to respect SES rate limits.</li>
                                <li>Each email includes a unique unsubscribe link per user.</li>
                                <li>All sends are logged to the <code className="bg-amber-100 px-1 rounded">campaign_logs</code> table for audit.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-xl">
                                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Confirm Batch Send</h3>
                        </div>
                        <p className="text-sm text-gray-600">
                            Are you sure you want to send this campaign to{' '}
                            <strong className="text-gray-900">{subscriberCount ?? '?'} subscribers</strong>?
                        </p>
                        <p className="text-xs text-gray-500">
                            Subject: <strong>{subject}</strong>
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBatchSend}
                                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all"
                            >
                                Yes, Send to All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
