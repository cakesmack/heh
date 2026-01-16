/**
 * Admin Email Testing Center
 * Test email templates with real database data
 */

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { useAuth } from '@/hooks/useAuth';
import { adminAPI, AdminUser, apiFetch } from '@/lib/api';

interface EmailTestResponse {
    success: boolean;
    message: string;
    events_count: number;
}

export default function AdminEmailTesting() {
    const { user } = useAuth();

    // Welcome Email State
    const [welcomeEmail, setWelcomeEmail] = useState('');
    const [welcomeName, setWelcomeName] = useState('Test User');
    const [welcomeLoading, setWelcomeLoading] = useState(false);
    const [welcomeResult, setWelcomeResult] = useState<EmailTestResponse | null>(null);

    // Weekly Digest State
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [digestEmail, setDigestEmail] = useState('');
    const [digestLoading, setDigestLoading] = useState(false);
    const [digestResult, setDigestResult] = useState<EmailTestResponse | null>(null);

    // System Alert State
    const [alertEmail, setAlertEmail] = useState('');
    const [alertSubject, setAlertSubject] = useState('System Alert');
    const [alertMessage, setAlertMessage] = useState('This is a test system alert message.');
    const [alertLoading, setAlertLoading] = useState(false);
    const [alertResult, setAlertResult] = useState<EmailTestResponse | null>(null);

    // Cron Trigger State
    const [cronLoading, setCronLoading] = useState(false);
    const [cronResult, setCronResult] = useState<any>(null);

    const handleTriggerCron = async () => {
        setCronLoading(true);
        setCronResult(null);
        try {
            const response = await apiFetch<any>('/api/cron/weekly-digest', {
                method: 'POST'
            });
            setCronResult({ success: true, message: response.message, processed: response.processed_users });
        } catch (err: any) {
            setCronResult({ success: false, message: err.message || 'Cron failed' });
        } finally {
            setCronLoading(false);
        }
    };

    // Initialize email fields with admin email
    useEffect(() => {
        if (user?.email) {
            setWelcomeEmail(user.email);
            setDigestEmail(user.email);
            setAlertEmail(user.email);
        }
    }, [user]);

    // Fetch users for digest dropdown
    const searchUsers = useCallback(async () => {
        if (!userSearch) return;
        setUsersLoading(true);
        try {
            const response = await adminAPI.listUsers({ q: userSearch, limit: 10 });
            setUsers(response.users);
        } catch (err) {
            console.error('Failed to search users:', err);
        } finally {
            setUsersLoading(false);
        }
    }, [userSearch]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (userSearch.length >= 2) searchUsers();
        }, 300);
        return () => clearTimeout(timer);
    }, [userSearch, searchUsers]);

    // Send Welcome Email
    const handleSendWelcome = async () => {
        setWelcomeLoading(true);
        setWelcomeResult(null);
        try {
            const response = await apiFetch<EmailTestResponse>('/api/admin/email-testing/welcome', {
                method: 'POST',
                body: JSON.stringify({
                    recipient_email: welcomeEmail,
                    mock_user_name: welcomeName,
                }),
            });
            setWelcomeResult(response);
        } catch (err: any) {
            setWelcomeResult({ success: false, message: err.message || 'Failed to send', events_count: 0 });
        } finally {
            setWelcomeLoading(false);
        }
    };

    // Send Weekly Digest
    const handleSendDigest = async () => {
        if (!selectedUserId) {
            setDigestResult({ success: false, message: 'Please select a user to simulate', events_count: 0 });
            return;
        }
        setDigestLoading(true);
        setDigestResult(null);
        try {
            const response = await apiFetch<EmailTestResponse>('/api/admin/email-testing/weekly-digest', {
                method: 'POST',
                body: JSON.stringify({
                    simulate_user_id: selectedUserId,
                    send_to_email: digestEmail,
                }),
            });
            setDigestResult(response);
        } catch (err: any) {
            setDigestResult({ success: false, message: err.message || 'Failed to send', events_count: 0 });
        } finally {
            setDigestLoading(false);
        }
    };

    // Send System Alert
    const handleSendAlert = async () => {
        setAlertLoading(true);
        setAlertResult(null);
        try {
            const response = await apiFetch<EmailTestResponse>('/api/admin/email-testing/system-alert', {
                method: 'POST',
                body: JSON.stringify({
                    recipient_email: alertEmail,
                    subject: alertSubject,
                    message_body: alertMessage,
                }),
            });
            setAlertResult(response);
        } catch (err: any) {
            setAlertResult({ success: false, message: err.message || 'Failed to send', events_count: 0 });
        } finally {
            setAlertLoading(false);
        }
    };

    const ResultBadge = ({ result }: { result: EmailTestResponse | null }) => {
        if (!result) return null;
        return (
            <div className={`mt-4 p-3 rounded-lg text-sm ${result.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                <div className="flex items-center gap-2">
                    {result.success ? (
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )}
                    <span>{result.message}</span>
                    {result.events_count > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-white rounded text-xs font-medium">
                            {result.events_count} events
                        </span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <AdminGuard>
            <AdminLayout title="Email Testing Center">
                <p className="text-gray-600 mb-8">
                    Test email templates with real database data. Emails will be sent from <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">noreply@highlandeventshub.co.uk</code>
                </p>

                <div className="space-y-6">
                    {/* Welcome Email Card */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <span className="text-xl">👋</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Test Welcome Email</h3>
                                <p className="text-sm text-gray-500">Includes 6 upcoming events</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
                                <input
                                    type="email"
                                    value={welcomeEmail}
                                    onChange={(e) => setWelcomeEmail(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mock User Name</label>
                                <input
                                    type="text"
                                    value={welcomeName}
                                    onChange={(e) => setWelcomeName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSendWelcome}
                            disabled={welcomeLoading || !welcomeEmail}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {welcomeLoading ? 'Sending...' : 'Send Test'}
                        </button>

                        <ResultBadge result={welcomeResult} />
                    </div>

                    {/* Weekly Digest Card */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-xl">📬</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Test Weekly Digest</h3>
                                <p className="text-sm text-gray-500">Simulates a user's personalized feed</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select User to Simulate</label>
                                <input
                                    type="text"
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    placeholder="Search by email..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                {users.length > 0 && (
                                    <div className="mt-2 border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                                        {users.map((u) => (
                                            <button
                                                key={u.id}
                                                onClick={() => {
                                                    setSelectedUserId(u.id);
                                                    setUserSearch(u.email);
                                                    setUsers([]);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b last:border-b-0 ${selectedUserId === u.id ? 'bg-blue-50' : ''}`}
                                            >
                                                <span className="font-medium">{u.email}</span>
                                                {(u as any).username && <span className="text-gray-500 ml-2">({(u as any).username})</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {usersLoading && <p className="text-xs text-gray-500 mt-1">Searching...</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Send To Address</label>
                                <input
                                    type="email"
                                    value={digestEmail}
                                    onChange={(e) => setDigestEmail(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">Override recipient (your email for testing)</p>
                            </div>
                        </div>

                        <button
                            onClick={handleSendDigest}
                            disabled={digestLoading || !selectedUserId || !digestEmail}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {digestLoading ? 'Generating...' : 'Generate & Send'}
                        </button>

                        <ResultBadge result={digestResult} />
                    </div>

                    {/* System Alert Card */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                <span className="text-xl">📢</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Test System Alert</h3>
                                <p className="text-sm text-gray-500">Custom subject and message</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
                                <input
                                    type="text"
                                    value={alertSubject}
                                    onChange={(e) => setAlertSubject(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Message Body</label>
                                <textarea
                                    value={alertMessage}
                                    onChange={(e) => setAlertMessage(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
                                <input
                                    type="email"
                                    value={alertEmail}
                                    onChange={(e) => setAlertEmail(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSendAlert}
                            disabled={alertLoading || !alertEmail || !alertSubject}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {alertLoading ? 'Sending...' : 'Send Alert'}
                        </button>

                        <ResultBadge result={alertResult} />
                    </div>

                    {/* Automation Center Card */}
                    <div className="bg-white rounded-lg shadow p-6 border-t-4 border-indigo-500">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <span className="text-xl">⚙️</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Automation Center</h3>
                                <p className="text-sm text-gray-500">Manually trigger scheduled jobs</p>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h4 className="font-medium text-gray-900 mb-2">Weekly Digest Blast</h4>
                            <p className="text-sm text-gray-600 mb-4">
                                This will identify all subscribed users, generate personalized matches for next week, and send emails via Resend.
                                <br />
                                <span className="text-xs text-orange-600 font-semibold">⚠️ Warning: This will send real emails to all subscribed users!</span>
                            </p>
                            <button
                                onClick={handleTriggerCron}
                                disabled={cronLoading}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {cronLoading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Running Job...
                                    </>
                                ) : (
                                    'Trigger Weekly Digest Now'
                                )}
                            </button>
                            {cronResult && (
                                <div className={`mt-4 p-3 rounded-lg text-sm ${cronResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                                    <span className="font-bold">{cronResult.success ? 'Success:' : 'Error:'}</span> {cronResult.message}
                                    {cronResult.processed !== undefined && (
                                        <div className="mt-1 text-xs">Processed {cronResult.processed} users.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </AdminLayout>
        </AdminGuard>
    );
}
