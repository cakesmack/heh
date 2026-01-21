'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card } from '../../common/Card';
import { Button } from '../../common/Button';
import { EditVenueModal } from '../../venues/EditVenueModal';

interface UnverifiedVenue {
    id: string;
    name: string;
    address: string;
    event_count: number;
    created_at: string;
}

export default function RisingLocationsWidget() {
    const [venues, setVenues] = useState<UnverifiedVenue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVenue, setSelectedVenue] = useState<string | null>(null);

    const fetchVenues = async () => {
        try {
            const res: any = await api.get('/api/admin/venues/unverified');
            setVenues(Array.isArray(res) ? res : []);
        } catch (error) {
            console.error("Failed to fetch rising locations", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchVenues();
    }, []);

    const handleVerifySuccess = () => {
        setSelectedVenue(null);
        fetchVenues();
    };

    if (isLoading) {
        return (
            <Card className="h-full">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-12 bg-gray-100 rounded"></div>
                        ))}
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Rising Locations</h3>
                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-medium">
                    {venues.length} Pending
                </span>
            </div>

            {venues.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                    No unverified venues found.
                </div>
            ) : (
                <div className="space-y-4">
                    {venues.map((venue) => (
                        <div key={venue.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="min-w-0 flex-1 mr-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-gray-900 truncate">{venue.name}</h4>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        {venue.event_count} Events
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 truncate">{venue.address}</p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedVenue(venue.id)}
                            >
                                Verify
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {selectedVenue && (
                <EditVenueModal
                    venueId={selectedVenue}
                    isOpen={!!selectedVenue}
                    onClose={() => setSelectedVenue(null)}
                    onSuccess={handleVerifySuccess}
                />
            )}
        </Card>
    );
}
