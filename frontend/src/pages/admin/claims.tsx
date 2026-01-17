import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { venueClaimsAPI, eventClaimsAPI } from '@/lib/api';
import { VenueClaim } from '@/types';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import { Badge } from '@/components/common/Badge';
import Link from 'next/link';

interface MergedClaim {
    id: number;
    type: 'venue' | 'event';
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    reason?: string | null;
    user?: { email?: string; id?: string };
    user_id: string;
    // Venue specific
    venue_id?: string;
    venue?: { name: string; id: string };
    venue_name?: string;
    // Event specific
    event_id?: string;
    event_title?: string;
    user_email?: string;
}

export default function ClaimsManager() {
    const [claims, setClaims] = useState<MergedClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

    useEffect(() => {
        fetchClaims();
    }, [filter]);

    const fetchClaims = async () => {
        try {
            setLoading(true);
            const statusArg = filter === 'all' ? undefined : filter;

            const [venueData, eventData] = await Promise.all([
                venueClaimsAPI.list(statusArg),
                eventClaimsAPI.list(statusArg)
            ]);

            // Normalize and merge
            const mergedVenue: MergedClaim[] = venueData.map(c => ({
                ...c,
                type: 'venue',
                venue_name: c.venue?.name
            }));

            const mergedEvent: MergedClaim[] = eventData.map(c => ({
                ...c,
                type: 'event',
                user: { email: c.user_email, id: c.user_id }
            }));

            const allCalls = [...mergedVenue, ...mergedEvent].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setClaims(allCalls);
        } catch (err) {
            console.error('Failed to load claims:', err);
            setError('Failed to load claims');
        } finally {
            setLoading(false);
        }
    };

    const handleProcess = async (claim: MergedClaim, action: 'approve' | 'reject') => {
        if (!confirm(`Are you sure you want to ${action} this ${claim.type} claim?`)) return;

        try {
            if (claim.type === 'venue') {
                await venueClaimsAPI.process(claim.id, action);
            } else {
                await eventClaimsAPI.process(claim.id, action);
            }
            fetchClaims();
        } catch (err) {
            console.error(`Failed to ${action} claim:`, err);
            alert(`Failed to ${action} claim`);
        }
    };

    return (
        <AdminGuard>
            <AdminLayout title="Ownership Claims (Venues & Events)">
                <div className="mb-6 flex gap-2">
                    {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
                        <Button
                            key={status}
                            variant={filter === status ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => setFilter(status)}
                            className="capitalize"
                        >
                            {status}
                        </Button>
                    ))}
                </div>

                {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>}

                {loading ? (
                    <Spinner />
                ) : claims.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No claims found.</div>
                ) : (
                    <div className="grid gap-4">
                        {claims.map((claim) => (
                            <Card key={`${claim.type}-${claim.id}`} className="p-6">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge variant={claim.type === 'venue' ? 'info' : 'warning'} className="uppercase text-xs">
                                                {claim.type}
                                            </Badge>
                                            <h3 className="font-bold text-lg">
                                                {claim.type === 'venue' ? (
                                                    <Link href={`/venues/${claim.venue_id}`} className="hover:underline">
                                                        {claim.venue_name || claim.venue?.name || 'Unknown Venue'}
                                                    </Link>
                                                ) : (
                                                    <Link href={`/events/${claim.event_id}`} className="hover:underline">
                                                        {claim.event_title || 'Unknown Event'}
                                                    </Link>
                                                )}
                                            </h3>
                                            <Badge
                                                variant={
                                                    claim.status === 'approved' ? 'success' :
                                                        claim.status === 'rejected' ? 'danger' : 'warning'
                                                }
                                            >
                                                {claim.status}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-1">
                                            User: <span className="font-medium">{claim.user?.email || claim.user_email || claim.user_id}</span>
                                        </p>
                                        <p className="text-sm text-gray-600 mb-2">
                                            Submitted: {new Date(claim.created_at).toLocaleString()}
                                        </p>
                                        {claim.reason && (
                                            <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 italic border-l-4 border-gray-300">
                                                "{claim.reason}"
                                            </div>
                                        )}
                                    </div>

                                    {claim.status === 'pending' && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => handleProcess(claim, 'approve')}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() => handleProcess(claim, 'reject')}
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </AdminLayout>
        </AdminGuard>
    );
}
