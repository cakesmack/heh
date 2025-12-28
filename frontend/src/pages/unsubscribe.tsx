/**
 * Unsubscribe Page
 * Handles one-click email unsubscribe via token
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Spinner } from '@/components/common/Spinner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8003';

export default function UnsubscribePage() {
    const router = useRouter();
    const { token, type } = router.query;

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Wait for router to be ready and params to be available
        if (!router.isReady) return;
        if (!token || !type) return;

        const unsubscribe = async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/users/me/preferences/unsubscribe?token=${token}&type=${type}`
                );

                if (response.ok) {
                    setStatus('success');
                    const data = await response.json();
                    setMessage(data.message || 'Successfully unsubscribed');
                } else {
                    setStatus('error');
                    setMessage('Invalid or expired unsubscribe link');
                }
            } catch (err) {
                setStatus('error');
                setMessage('Something went wrong. Please try again.');
            }
        };

        unsubscribe();
    }, [router.isReady, token, type]);

    // Convert type to readable label (e.g., "weekly_digest" -> "weekly digest")
    const typeLabel = typeof type === 'string'
        ? type.replace(/_/g, ' ')
        : 'emails';

    return (
        <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
            <div className="max-w-md w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-2xl shadow-lg p-8">
                    {status === 'loading' && (
                        <div className="text-center py-8">
                            <Spinner size="lg" className="mb-4" />
                            <p className="text-gray-600">Processing your request...</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="text-center py-4">
                            {/* Success Icon */}
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg
                                    className="w-8 h-8 text-emerald-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribed</h1>
                            <p className="text-gray-600 mb-6">{message}</p>
                            <p className="text-sm text-gray-500 mb-6">
                                You will no longer receive {typeLabel} from us.
                            </p>
                            <Link
                                href="/"
                                className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                            >
                                Go to Homepage
                            </Link>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="text-center py-4">
                            {/* Error Icon */}
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg
                                    className="w-8 h-8 text-red-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
                            <p className="text-gray-600 mb-6">{message}</p>
                            <Link
                                href="/account/preferences"
                                className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                            >
                                Manage Preferences
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
