import { useState } from 'react';
import Modal from '@/components/admin/Modal';
import { moderationAPI } from '@/lib/api';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetType: 'event' | 'venue';
    targetId: string;
    targetName: string;
}

export default function ReportModal({ isOpen, onClose, targetType, targetId, targetName }: ReportModalProps) {
    const [reason, setReason] = useState('');
    const [details, setDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            await moderationAPI.createReport({
                target_type: targetType,
                target_id: targetId,
                reason,
                details: details || undefined,
            });
            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setReason('');
                setDetails('');
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to submit report');
        } finally {
            setSubmitting(false);
        }
    };

    const reasons = [
        'Inappropriate Content',
        'Spam or Misleading',
        'Incorrect Information',
        'Duplicate',
        'Other',
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Report ${targetType === 'event' ? 'Event' : 'Venue'}`}
        >
            {success ? (
                <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Report Submitted</h3>
                    <p className="text-gray-500 mt-2">Thank you for helping keep our community safe.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
                        Reporting: <span className="font-medium text-gray-900">{targetName}</span>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            required
                        >
                            <option value="">Select a reason</option>
                            {reasons.map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Details (Optional)</label>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            rows={3}
                            placeholder="Please provide more context..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !reason}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                            {submitting ? 'Submitting...' : 'Submit Report'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
