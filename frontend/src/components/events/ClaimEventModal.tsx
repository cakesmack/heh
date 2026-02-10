import { useState } from 'react';
import Modal from '@/components/admin/Modal';
import { eventClaimsAPI } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface ClaimEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: string;
    eventTitle: string;
}

export default function ClaimEventModal({ isOpen, onClose, eventId, eventTitle }: ClaimEventModalProps) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            await eventClaimsAPI.create(eventId, reason);
            setSuccess(true);
            toast.success('Claim submitted successfully');
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setReason('');
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to submit claim');
            toast.error(err.message || 'Failed to submit claim');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Claim This Event"
        >
            {success ? (
                <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Claim Submitted</h3>
                    <p className="text-gray-500 mt-2">
                        Your request has been sent to our team for review. We will notify you once it has been processed.
                    </p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-amber-50 p-4 rounded-lg text-sm text-amber-800 border border-amber-100">
                        <p className="font-medium mb-1">claiming: {eventTitle}</p>
                        <p>
                            Are you the organizer of this event? Claiming will allow you to manage details, view stats, and more.
                            Proof of ownership may be required.
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 rounded text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Why are you claiming this event? *
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[100px]"
                            placeholder="e.g. I am the event organizer/promoter..."
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Please provide details to help us verify your request.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !reason.trim()}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                        >
                            {submitting ? 'Submitting...' : 'Submit Claim'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
