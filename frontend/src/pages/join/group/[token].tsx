import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/common/Spinner';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';

export default function JoinGroupPage() {
    const router = useRouter();
    const { token } = router.query;
    const { user, isAuthenticated } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [groupId, setGroupId] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;
        // We don't auto-join, we wait for user confirmation
    }, [token]);

    const handleJoin = async () => {
        if (!isAuthenticated) {
            router.push(`/login?redirect=/join/group/${token}`);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await api.groups.join(token as string);
            setSuccess(true);
            setGroupId(response.group_id);
            toast.success('Joined group successfully!');

            // Redirect after a short delay
            setTimeout(() => {
                router.push(`/groups/${response.group_id}`); // Note: This assumes we can redirect to ID, but usually we use slug. 
                // The API returns group_id. We might need to fetch the group to get the slug, or just redirect to account/organizers
                router.push('/account');
            }, 2000);
        } catch (err) {
            console.error('Failed to join group:', err);
            setError(err instanceof Error ? err.message : 'Failed to join group. The invite may be invalid or expired.');
            toast.error('Failed to join group');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <Spinner size="lg" />
                    <p className="mt-4 text-gray-600">Joining group...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Join Group
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    You have been invited to join an organizer group on Highland Events Hub.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {success ? (
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">Successfully Joined!</h3>
                            <p className="mt-2 text-sm text-gray-500">
                                You are now a member of the group. Redirecting...
                            </p>
                            <div className="mt-6">
                                <Link href="/account" className="text-emerald-600 hover:text-emerald-500 font-medium">
                                    Go to Dashboard &rarr;
                                </Link>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">Invitation Failed</h3>
                            <p className="mt-2 text-sm text-gray-500">{error}</p>
                            <div className="mt-6">
                                <Link href="/" className="text-emerald-600 hover:text-emerald-500 font-medium">
                                    Return Home &rarr;
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="text-center">
                                <p className="text-sm text-gray-500 mb-6">
                                    Click the button below to accept the invitation and become a member of this group.
                                </p>
                                <Button
                                    onClick={handleJoin}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                                >
                                    Accept Invitation
                                </Button>
                            </div>
                            {!isAuthenticated && (
                                <div className="text-center mt-4">
                                    <p className="text-xs text-gray-500">
                                        You will be asked to sign in or register first.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
