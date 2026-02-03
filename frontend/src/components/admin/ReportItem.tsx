import React, { useEffect, useState } from 'react';
import { Report, EventResponse } from '@/types';
import Link from 'next/link';
import { eventsAPI } from '@/lib/api';

interface ReportItemProps {
    report: Report;
    onResolve: (id: number) => void;
    onDismiss: (id: number) => void;
    onReviewConflict: (report: Report) => void;
}

export default function ReportItem({ report, onResolve, onDismiss, onReviewConflict }: ReportItemProps) {
    const [targetEvent, setTargetEvent] = useState<EventResponse | null>(null);
    const [parsedDetails, setParsedDetails] = useState<any>(null);

    // Parse details safely
    useEffect(() => {
        if (report.details) {
            try {
                setParsedDetails(JSON.parse(report.details));
            } catch (e) {
                console.error("Failed to parse report details", e);
            }
        }
    }, [report.details]);

    // Parse specific reasons (Profanity, Duplicate)
    const renderContent = () => {
        if (report.reason === 'Potential Duplicate' && parsedDetails) {
            const { matched_title, risk_score, reasons } = parsedDetails;
            const isHighRisk = risk_score > 90;

            return (
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        {isHighRisk && (
                            <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200">
                                ⚡ High Probability ({risk_score}%)
                            </span>
                        )}
                        {!isHighRisk && (
                            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-200">
                                ⚠️ Potential Match ({risk_score}%)
                            </span>
                        )}
                    </div>

                    <div className="text-gray-900 font-medium">
                        Conflict with event: <span className="font-bold text-gray-800">"{matched_title}"</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {reasons?.map((r: string, idx: number) => (
                            <span key={idx} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded border border-gray-200">
                                {r}
                            </span>
                        ))}
                    </div>
                </div>
            );
        }

        if (report.reason === 'Profanity Detected' && parsedDetails) {
            const { detected_word, field } = parsedDetails;
            return (
                <div className="space-y-2">
                    <div className="text-gray-900">
                        Detected offensive language in <span className="font-semibold">{field}</span>
                    </div>
                    <div className="inline-block group">
                        <span className="text-xs text-gray-500 mr-2">Trigger Word:</span>
                        <span className="px-2 py-1 bg-red-50 border border-red-100 rounded text-red-600 font-mono text-sm filter blur-sm group-hover:blur-none transition-all cursor-crosshair select-none">
                            {detected_word}
                        </span>
                    </div>
                </div>
            );
        }

        // Default / Fallback
        return (
            <div className="text-gray-600 bg-gray-50 p-3 rounded text-sm break-all font-mono">
                {report.details ? JSON.stringify(parsedDetails || report.details, null, 2) : "No details provided."}
            </div>
        );
    };

    // Load Event details for context
    useEffect(() => {
        if (report.target_type === 'event' && report.target_id) {
            eventsAPI.get(report.target_id)
                .then(setTargetEvent)
                .catch(() => { }); // Fail silently if not found or error
        }
    }, [report.target_id, report.target_type]);


    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${report.target_type === 'event' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'
                            }`}>
                            {report.target_type}
                        </span>
                        <span className="text-xs text-gray-400">
                            Reported {new Date(report.created_at).toLocaleDateString()}
                        </span>
                    </div>

                    {/* Context (Event Title) */}
                    {targetEvent && (
                        <div className="mb-4 pb-4 border-b border-gray-50">
                            <div className="text-sm text-gray-500 mb-1">Target Event</div>
                            <Link href={`/events/${targetEvent.id}`} target="_blank" className="font-bold text-lg text-gray-900 hover:text-emerald-600 transition-colors">
                                {targetEvent.title}
                            </Link>
                            <div className="text-xs text-gray-400 mt-1">
                                By {targetEvent.organizer_email || "Unknown Organizer"}
                            </div>
                        </div>
                    )}

                    {/* Main Reason Info */}
                    <div className="mb-4">
                        <h3 className="text-md font-bold text-gray-900 mb-2 flex items-center gap-2">
                            {report.reason === 'Potential Duplicate' && '👯'}
                            {report.reason === 'Profanity Detected' && '🤬'}
                            {report.reason}
                        </h3>
                        {renderContent()}
                    </div>

                    <div className="text-xs text-gray-400 font-mono mt-2">
                        ID: {report.target_id}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 ml-4">
                    <button
                        onClick={() => onDismiss(report.id)}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Dismiss
                    </button>

                    {report.reason === 'Potential Duplicate' ? (
                        <button
                            onClick={() => onReviewConflict(report)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                        >
                            Review Conflict
                        </button>
                    ) : (
                        <button
                            onClick={() => onResolve(report.id)}
                            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition-colors"
                        >
                            Resolve
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
