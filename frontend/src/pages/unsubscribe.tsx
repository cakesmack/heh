/**
 * Unsubscribe Page
 * Handles one-click email unsubscribe via token
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Spinner } from '@/components/common/Spinner';
import { api } from '@/lib/api';

export default function UnsubscribePage() {
    const router = useRouter();
    const { token } = router.query;

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Wait for router to be ready and token to be available
        if (!router.isReady) return;

        // Handle both /unsubscribe?token=XXX and potentially /unsubscribe/[token]
        const unsubscribeToken = token || router.query.token;

        if (!unsubscribeToken || typeof unsubscribeToken !== 'string') {
            setStatus('error');
            setMessage('Invalid unsubscribe link. Missing token.');
            return;
        }

        const unsubscribe = async () => {
            try {
                const response = await api.preferences.unsubscribe(unsubscribeToken);
                setStatus('success');
                setMessage(response.message || 'You have been successfully unsubscribed from News & Updates.');
            } catch (err: any) {
                setStatus('error');
                setMessage(err.message || 'Invalid or expired unsubscribe link');
            }
        };

        unsubscribe();
    }, [router.isReady, token, router.query.token]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center">
                    {/* Brand Logo or Name */}
                    <div className="mb-8">
                        <Link href="/" className="text-2xl font-black tracking-tight text-emerald-600">
                            HIGHLAND<span className="text-gray-900">EVENTS</span>
                        </Link>
                    </div>

                    {status === 'loading' && (
                        <div className="py-8">
                            <Spinner size="lg" className="mx-auto mb-4" />
                            <p className="text-gray-600 font-medium">Unsubscribing you...</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg
                                    className="w-10 h-10 text-emerald-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2.5}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Unsubscribed</h2>
                            <p className="text-gray-600 mb-8 leading-relaxed">
                                {message}
                                <br />
                                <span className="block mt-2 text-sm">
                                    You can manage your preferences at any time in your{" "}
                                    <Link href="/account" className="text-emerald-600 font-semibold hover:underline">
                                        account settings
                                    </Link>.
                                </span>
                            </p>
                            <Link
                                href="/"
                                className="inline-flex items-center justify-center w-full bg-emerald-600 text-white px-6 py-3.5 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                            >
                                Back to Homepage
                            </Link>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg
                                    className="w-10 h-10 text-red-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2.5}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Request Failed</h2>
                            <p className="text-gray-600 mb-8 leading-relaxed">{message}</p>
                            <Link
                                href="/"
                                className="inline-flex items-center justify-center w-full bg-gray-900 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-md active:scale-[0.98]"
                            >
                                Back to Homepage
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
