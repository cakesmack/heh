/**
 * Accept Venue Invite Page
 * Handles token-based venue ownership transfer
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { venueInvitesAPI } from '@/lib/api';

export default function AcceptVenueInvite() {
    const router = useRouter();
    const { token } = router.query;

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [venueName, setVenueName] = useState('');
    const [venueId, setVenueId] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!token || typeof token !== 'string') return;

        const acceptInvite = async () => {
            try {
                const result = await venueInvitesAPI.accept(token);
                setStatus('success');
                setVenueName(result.venue_name);
                setVenueId(result.venue_id);
            } catch (err: any) {
                setStatus('error');
                setErrorMessage(err.message || 'Failed to accept invite');
            }
        };

        acceptInvite();
    }, [token]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                {status === 'loading' && (
                    <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">Accepting Invitation...</h1>
                        <p className="text-gray-600">Please wait while we process your venue ownership invitation.</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome, Venue Owner!</h1>
                        <p className="text-gray-600 mb-6">
                            You are now the owner of <strong className="text-emerald-600">{venueName}</strong>.
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                            You can now edit venue details, manage events, run promotions, and add staff members.
                        </p>
                        <Link
                            href={`/venues/${venueId}`}
                            className="inline-block w-full px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                            View Your Venue
                        </Link>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Accept Invite</h1>
                        <p className="text-gray-600 mb-6">{errorMessage}</p>
                        <p className="text-sm text-gray-500 mb-6">
                            The invite link may have expired or already been used. Please contact the administrator for a new invite.
                        </p>
                        <Link
                            href="/"
                            className="inline-block w-full px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            Return Home
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
