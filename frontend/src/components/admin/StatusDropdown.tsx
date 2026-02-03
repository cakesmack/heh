import React, { useState } from 'react';
import { eventsAPI } from '@/lib/api';

interface StatusDropdownProps {
    eventId: string;
    currentStatus: string;
    onStatusChange?: (newStatus: string) => void;
}

const STATUS_OPTIONS = [
    { value: 'published', label: 'Published', color: 'bg-emerald-100 text-emerald-800' },
    { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'pending_moderation', label: 'Pending Moderation', color: 'bg-orange-100 text-orange-800' },
    { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' },
    { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800' },
    { value: 'archived', label: 'Archived', color: 'bg-gray-300 text-gray-700' },
];

export default function StatusDropdown({ eventId, currentStatus, onStatusChange }: StatusDropdownProps) {
    const [status, setStatus] = useState(currentStatus);
    const [loading, setLoading] = useState(false);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value;
        if (newStatus === status) return;

        setStatus(newStatus); // Optimistic update
        setLoading(true);

        try {
            await eventsAPI.update(eventId, { status: newStatus });
            if (onStatusChange) onStatusChange(newStatus);
            // Optional: Success toast here
        } catch (error) {
            console.error("Failed to update status", error);
            setStatus(status); // Revert
            alert("Failed to update status. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const currentOption = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];

    return (
        <div className="relative inline-block w-full">
            <select
                value={status}
                onChange={handleChange}
                disabled={loading}
                className={`appearance-none w-full px-3 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-50 ${currentOption.color}`}
                style={{ textAlignLast: 'center' }}
            >
                {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-white text-gray-900">
                        {option.label}
                    </option>
                ))}
            </select>
            {loading && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className="animate-spin h-3 w-3 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            )}
        </div>
    );
}
