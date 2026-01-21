import React, { useEffect, useState } from 'react';
import { EventResponse } from '@/types';
import { eventsAPI } from '@/lib/api';
import Modal from '@/components/admin/Modal';

interface DuplicateDiffModalProps {
    isOpen: boolean;
    onClose: () => void;
    newEvent: EventResponse;
    matchedEventId: string;
    onApprove: (id: string) => void;
    onReject: (id: string, reason: string) => void;
}

export default function DuplicateDiffModal({
    isOpen,
    onClose,
    newEvent,
    matchedEventId,
    onApprove,
    onReject
}: DuplicateDiffModalProps) {
    const [existingEvent, setExistingEvent] = useState<EventResponse | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && matchedEventId) {
            setLoading(true);
            eventsAPI.get(matchedEventId)
                .then(setExistingEvent)
                .catch(err => console.error("Failed to load matched event", err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, matchedEventId]);

    const ComparisonRow = ({ label, left, right, highlightDiff = false }: { label: string, left: any, right: any, highlightDiff?: boolean }) => {
        const isDiff = highlightDiff && left !== right;
        return (
            <div className="grid grid-cols-12 gap-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">{label}</div>
                <div className={`col-span-5 text-sm p-2 rounded ${isDiff ? 'bg-amber-50 text-amber-900' : 'text-gray-900'}`}>{left || '-'}</div>
                <div className={`col-span-5 text-sm p-2 rounded ${isDiff ? 'bg-amber-50 text-amber-900' : 'text-gray-900'}`}>{right || '-'}</div>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Duplicate Check: Side-by-Side Comparison" size="lg">
            <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-800">
                    <p><strong>Potential Duplicate Detected.</strong> Verify if these are the same event.</p>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading comparison...</div>
                ) : existingEvent ? (
                    <div>
                        <div className="grid grid-cols-12 gap-4 mb-2 px-2">
                            <div className="col-span-2"></div>
                            <div className="col-span-5 font-bold text-emerald-700 bg-emerald-50 p-2 rounded text-center">New Submission (Pending)</div>
                            <div className="col-span-5 font-bold text-gray-700 bg-gray-100 p-2 rounded text-center">Existing Event (Live)</div>
                        </div>

                        <div className="bg-white border rounded-lg p-2">
                            <ComparisonRow label="Title" left={newEvent.title} right={existingEvent.title} highlightDiff />
                            <ComparisonRow
                                label="Date"
                                left={new Date(newEvent.date_start).toLocaleString()}
                                right={new Date(existingEvent.date_start).toLocaleString()}
                                highlightDiff
                            />
                            <ComparisonRow label="Venue" left={newEvent.venue_name} right={existingEvent.venue_name} highlightDiff />
                            <ComparisonRow label="Organizer" left={newEvent.organizer_email} right={existingEvent.organizer_email} highlightDiff />
                            <ComparisonRow label="Logic"
                                left="This event was flagged instantly"
                                right={`Event ID: ${existingEvent.id}`}
                            />
                        </div>

                        <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button
                                onClick={() => onReject(newEvent.id, `Duplicate of ${existingEvent.id}`)}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 shadow-sm"
                            >
                                Reject (It's a Duplicate)
                            </button>
                            <button
                                onClick={() => onApprove(newEvent.id)}
                                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-sm"
                            >
                                Approve (Different Event)
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-8 text-red-500">Could not load the existing event data. It might have been deleted.</div>
                )}
            </div>
        </Modal>
    );
}
