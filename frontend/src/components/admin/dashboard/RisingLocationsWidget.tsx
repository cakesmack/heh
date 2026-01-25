'use client';

import { Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import Modal from '../Modal';
import { Card } from '../../common/Card';
import { Button } from '../../common/Button';
import { EditVenueModal } from '../../venues/EditVenueModal';
import { toast } from 'react-hot-toast';

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
    const [allVenues, setAllVenues] = useState<UnverifiedVenue[]>([]);
    const [isViewAllOpen, setIsViewAllOpen] = useState(false);
    const [isLoadingAll, setIsLoadingAll] = useState(false);

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

    const fetchAllVenues = async () => {
        setIsLoadingAll(true);
        try {
            // Fetch up to 100 unverified venues for the modal view
            const res: any = await api.get('/api/admin/venues/unverified?limit=100');
            setAllVenues(Array.isArray(res) ? res : []);
            setIsViewAllOpen(true);
        } catch (error) {
            console.error("Failed to fetch all venues", error);
        } finally {
            setIsLoadingAll(false);
        }
    };

    useEffect(() => {
        fetchVenues();
    }, []);

    const handleVerifySuccess = () => {
        setSelectedVenue(null);
        fetchVenues();
        // If we were viewing all, refresh that list too
        if (isViewAllOpen) {
            fetchAllVenues();
        }
    };

    const handleDismiss = async (venueId: string) => {
        try {
            await api.post(`/api/admin/venues/${venueId}/dismiss`, {});

            // Optimistic update
            setVenues(prev => prev.filter(v => v.id !== venueId));
            setAllVenues(prev => prev.filter(v => v.id !== venueId));

            toast.success('Venue dismissed from list');
        } catch (error) {
            console.error('Failed to dismiss venue', error);
            toast.error('Failed to dismiss venue');
        }
    };

    const handleVerifyClick = (venueId: string) => {
        // We keep the View All modal open in the background, OR close it. 
        // Let's keep it open but maybe we need to manage z-indices or just simple stacking.
        // For simplicity, let's just open the edit modal on top.
        setSelectedVenue(venueId);
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
                <div className="flex items-center gap-3">
                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-medium">
                        {venues.length} Pending
                    </span>
                    <button
                        onClick={fetchAllVenues}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
                        disabled={isLoadingAll}
                    >
                        {isLoadingAll ? 'Loading...' : 'View All'}
                    </button>
                </div>
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
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 h-8 w-8"
                                    onClick={() => handleDismiss(venue.id)}
                                    title="Dismiss from list"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedVenue(venue.id)}
                                >
                                    Verify
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* View All Modal */}
            {isViewAllOpen && (
                <Modal
                    isOpen={isViewAllOpen}
                    onClose={() => setIsViewAllOpen(false)}
                    title="All Rising Locations"
                    size="lg"
                >
                    <div className="max-h-[60vh] overflow-y-auto space-y-4 p-1">
                        {allVenues.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">No unverified venues found.</div>
                        ) : (
                            allVenues.map((venue) => (
                                <div key={venue.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                                    <div className="min-w-0 flex-1 mr-4">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h4 className="font-medium text-gray-900 text-lg">{venue.name}</h4>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {venue.event_count} Active Events
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500">{venue.address}</p>
                                        <p className="text-xs text-gray-400 mt-1">Found: {new Date(venue.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2"
                                            onClick={() => handleDismiss(venue.id)}
                                            title="Dismiss from list"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            onClick={() => handleVerifyClick(venue.id)}
                                        >
                                            Verify
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Modal>
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
