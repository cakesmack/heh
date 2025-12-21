import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { venueClaimsAPI } from '@/lib/api';
import { VenueClaim } from '@/types';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import { Badge } from '@/components/common/Badge';

export default function VenueClaimsManager() {
    const [claims, setClaims] = useState<VenueClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

    useEffect(() => {
        fetchClaims();
    }, [filter]);

    const fetchClaims = async () => {
        try {
            setLoading(true);
            const data = await venueClaimsAPI.list(filter === 'all' ? undefined : filter);
            setClaims(data);
        } catch (err) {
            console.error('Failed to load claims:', err);
            setError('Failed to load venue claims');
        } finally {
            setLoading(false);
        }
    };

    const handleProcess = async (claimId: number, action: 'approve' | 'reject') => {
        if (!confirm(`Are you sure you want to ${action} this claim?`)) return;

        try {
            await venueClaimsAPI.process(claimId, action);
            fetchClaims();
        } catch (err) {
            console.error(`Failed to ${action} claim:`, err);
            alert(`Failed to ${action} claim`);
        }
    };

    return (
        <AdminGuard>
            <AdminLayout title="Venue Ownership Claims">
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
                            <Card key={claim.id} className="p-6">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-bold text-lg">
                                                {claim.venue?.name || 'Unknown Venue'}
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
                                            User: <span className="font-medium">{claim.user?.email || claim.user_id}</span>
                                        </p>
                                        <p className="text-sm text-gray-600 mb-2">
                                            Submitted: {new Date(claim.created_at).toLocaleString()}
                                        </p>
                                        {claim.reason && (
                                            <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 italic">
                                                "{claim.reason}"
                                            </div>
                                        )}
                                    </div>

                                    {claim.status === 'pending' && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => handleProcess(claim.id, 'approve')}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() => handleProcess(claim.id, 'reject')}
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
