import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/common/Spinner';
import { Card } from '@/components/common/Card';

export default function FeaturedSuccessPage() {
    const router = useRouter();
    const { refreshUser } = useAuth();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verifying your promotion...');

    useEffect(() => {
        if (!router.isReady) return;

        const verifyPayment = async () => {
            const { session_id, booking_id } = router.query;

            if (!session_id && !booking_id) {
                setStatus('error');
                setMessage('No payment session found.');
                return;
            }

            try {
                // Use the verifySession call which should now correctly use apiFetch with headers
                const response = await api.featured.verifySession(
                    (session_id as string) || undefined,
                    (booking_id as string) || undefined
                );

                if (response.success) {
                    setStatus('success');
                    setMessage(response.message || 'Payment verified! Your event is now featured.');
                    // Refresh user state to ensure they stay logged in and see updated status
                    await refreshUser();
                } else {
                    setStatus('error');
                    setMessage(response.message || 'Failed to verify payment.');
                }
            } catch (err: any) {
                console.error('Verification error:', err);
                setStatus('error');
                setMessage(err.message || 'An unexpected error occurred during verification.');
            }
        };

        verifyPayment();
    }, [router.isReady, router.query, refreshUser]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <Card className="max-w-md w-full p-8 text-center shadow-xl">
                {status === 'loading' && (
                    <div className="flex flex-col items-center">
                        <Spinner size="lg" className="mb-4" />
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing...</h1>
                        <p className="text-gray-600">{message}</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="animate-fade-in">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">Brilliant!</h1>
                        <p className="text-gray-600 mb-8">{message}</p>
                        <div className="space-y-3">
                            <Link
                                href="/account"
                                className="block w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                            >
                                Go to My Account
                            </Link>
                            <Link
                                href="/"
                                className="block w-full py-3 text-gray-600 font-medium hover:text-emerald-600 transition-colors"
                            >
                                Back to Home
                            </Link>
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="animate-fade-in">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Verification Issue</h1>
                        <p className="text-gray-600 mb-8">{message}</p>
                        <Link
                            href="/account"
                            className="block w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all"
                        >
                            Return to Account
                        </Link>
                    </div>
                )}
            </Card>
        </div>
    );
}
