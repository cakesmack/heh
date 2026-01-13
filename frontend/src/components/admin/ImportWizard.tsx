import React, { useState, useEffect } from 'react';
import { Venue, Category } from '@/types';
import { X, Trash2, Check, AlertTriangle, Image as ImageIcon } from 'lucide-react';

interface ImportWizardProps {
    venues: Venue[];
    categories: Category[];
}

interface StagedEvent {
    id: string; // Unique ID for tracking
    title: string;
    description: string;
    date_start: string;
    date_end?: string;
    image_url: string;
    ticket_url?: string;
    price_display?: string;
    min_price?: number;
    min_age?: number;
    category_name?: string;
    venue_name?: string;
    raw_showtimes?: string[];
    status: 'pending' | 'importing' | 'imported' | 'rejected' | 'error' | 'duplicate';
    message?: string;
    selectedCategoryId?: string;
    selectedVenueId: string | null;
    location_name: string;
}

const STORAGE_KEY = 'import_wizard_session';

export const ImportWizard: React.FC<ImportWizardProps> = ({ venues, categories }) => {
    const [stagedEvents, setStagedEvents] = useState<StagedEvent[]>([]);
    const [bulkVenueId, setBulkVenueId] = useState<string>('');
    const [parseError, setParseError] = useState<string | null>(null);
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [currentReviewIndex, setCurrentReviewIndex] = useState<number | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    // Check for saved session on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setShowResumePrompt(true);
                }
            } catch (e) {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, []);

    // Auto-save to localStorage whenever stagedEvents changes
    useEffect(() => {
        if (stagedEvents.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stagedEvents));
        }
    }, [stagedEvents]);

    const resumeSession = () => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            setStagedEvents(JSON.parse(saved));
        }
        setShowResumePrompt(false);
    };

    const clearSession = () => {
        localStorage.removeItem(STORAGE_KEY);
        setStagedEvents([]);
        setShowResumePrompt(false);
    };

    // Smart venue matching
    const findMatchingVenue = (venueName: string): Venue | undefined => {
        if (!venueName) return undefined;
        const normalized = venueName.toLowerCase().trim();
        return venues.find(v =>
            v.name.toLowerCase().trim() === normalized ||
            v.name.toLowerCase().includes(normalized) ||
            normalized.includes(v.name.toLowerCase())
        );
    };

    // File parsing
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setParseError(null);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (!Array.isArray(json)) {
                    throw new Error("JSON must be an array of event objects");
                }

                const staged: StagedEvent[] = json.map((item: any, idx: number) => {
                    const normalizedCatName = (item.category_name || '').toLowerCase();
                    const matchedCategory = categories.find(c =>
                        c.name.toLowerCase() === normalizedCatName ||
                        c.slug === normalizedCatName
                    );

                    const jsonVenueName = item.venue_name || item.location_name || '';
                    const matchedVenue = findMatchingVenue(jsonVenueName);

                    return {
                        id: `${Date.now()}-${idx}`,
                        ...item,
                        title: item.title || "Untitled Event",
                        description: item.description || "",
                        status: 'pending' as const,
                        selectedCategoryId: matchedCategory?.id || '',
                        selectedVenueId: matchedVenue?.id || null,
                        location_name: jsonVenueName,
                        venue_name: jsonVenueName
                    };
                });

                setStagedEvents(staged);
            } catch (err: any) {
                setParseError(`Failed to parse JSON: ${err.message}`);
                setStagedEvents([]);
            }
        };
        reader.readAsText(selectedFile);
    };

    // Bulk apply venue
    const applyBulkVenue = () => {
        if (!bulkVenueId) return;
        setStagedEvents(prev => prev.map(event =>
            event.status === 'pending'
                ? { ...event, selectedVenueId: bulkVenueId }
                : event
        ));
    };

    // Quick reject from table
    const rejectEvent = (index: number) => {
        setStagedEvents(prev => {
            const next = [...prev];
            next[index] = { ...next[index], status: 'rejected' };
            return next;
        });
    };

    // Start review - find first pending event
    const startReview = () => {
        const firstPendingIdx = stagedEvents.findIndex(e => e.status === 'pending');
        if (firstPendingIdx >= 0) {
            setCurrentReviewIndex(firstPendingIdx);
            setReviewModalOpen(true);
            setImportError(null);
        }
    };

    // Find next pending event
    const findNextPending = (startFrom: number = 0): number => {
        for (let i = startFrom; i < stagedEvents.length; i++) {
            if (stagedEvents[i].status === 'pending') return i;
        }
        return -1;
    };

    // Update current event being reviewed
    const updateCurrentEvent = (updates: Partial<StagedEvent>) => {
        if (currentReviewIndex === null) return;
        setStagedEvents(prev => {
            const next = [...prev];
            next[currentReviewIndex] = { ...next[currentReviewIndex], ...updates };
            return next;
        });
    };

    // Reject current and move to next
    const rejectAndNext = () => {
        if (currentReviewIndex === null) return;
        setStagedEvents(prev => {
            const next = [...prev];
            next[currentReviewIndex] = { ...next[currentReviewIndex], status: 'rejected' };
            return next;
        });

        const nextIdx = findNextPending(currentReviewIndex + 1);
        if (nextIdx >= 0) {
            setCurrentReviewIndex(nextIdx);
            setImportError(null);
        } else {
            setReviewModalOpen(false);
            setCurrentReviewIndex(null);
        }
    };

    // Approve and import current event
    const approveAndImport = async () => {
        if (currentReviewIndex === null) return;
        const event = stagedEvents[currentReviewIndex];

        setIsImporting(true);
        setImportError(null);

        // Update status to importing
        setStagedEvents(prev => {
            const next = [...prev];
            next[currentReviewIndex] = { ...next[currentReviewIndex], status: 'importing' };
            return next;
        });

        try {
            const payload = {
                title: event.title,
                description: event.description,
                date_start: event.date_start,
                date_end: event.date_end,
                image_url: event.image_url,
                ticket_url: event.ticket_url,
                price_display: event.price_display || "Variable",
                min_price: event.min_price || 0,
                min_age: event.min_age || 0,
                venue_id: event.selectedVenueId,
                location_name: event.location_name,
                category_id: event.selectedCategoryId || categories[0]?.id,
                raw_showtimes: event.raw_showtimes || []
            };

            const token = localStorage.getItem('auth_token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/admin/events/import-single`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || 'Import failed');
            }

            if (data.skipped) {
                // Duplicate detected
                setStagedEvents(prev => {
                    const next = [...prev];
                    next[currentReviewIndex] = { ...next[currentReviewIndex], status: 'duplicate', message: data.reason };
                    return next;
                });
                setImportError(`Duplicate detected: ${data.reason}. Click Reject to skip this event.`);
            } else {
                // Success - mark imported and move to next
                setStagedEvents(prev => {
                    const next = [...prev];
                    next[currentReviewIndex] = { ...next[currentReviewIndex], status: 'imported' };
                    return next;
                });

                const nextIdx = findNextPending(currentReviewIndex + 1);
                if (nextIdx >= 0) {
                    setCurrentReviewIndex(nextIdx);
                    setImportError(null);
                } else {
                    setReviewModalOpen(false);
                    setCurrentReviewIndex(null);
                }
            }
        } catch (err: any) {
            setStagedEvents(prev => {
                const next = [...prev];
                next[currentReviewIndex] = { ...next[currentReviewIndex], status: 'error', message: err.message };
                return next;
            });
            setImportError(err.message);
        } finally {
            setIsImporting(false);
        }
    };

    // Stats
    const pendingCount = stagedEvents.filter(e => e.status === 'pending').length;
    const importedCount = stagedEvents.filter(e => e.status === 'imported').length;
    const rejectedCount = stagedEvents.filter(e => e.status === 'rejected').length;

    const currentEvent = currentReviewIndex !== null ? stagedEvents[currentReviewIndex] : null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Event Import Wizard</h2>
                {stagedEvents.length > 0 && (
                    <button
                        onClick={clearSession}
                        className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                        <Trash2 className="w-4 h-4" /> Clear Session
                    </button>
                )}
            </div>

            {/* Resume Prompt */}
            {showResumePrompt && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-amber-800 font-medium mb-3">📂 Previous import session found</p>
                    <div className="flex gap-3">
                        <button
                            onClick={resumeSession}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                            Resume Session
                        </button>
                        <button
                            onClick={clearSession}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                            Start Fresh
                        </button>
                    </div>
                </div>
            )}

            {/* File Upload & Bulk Tools */}
            {!showResumePrompt && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            1. Select JSON File
                        </label>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                        />
                        {parseError && <p className="text-red-600 text-xs mt-2">{parseError}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            2. Bulk Set Venue (Optional)
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={bulkVenueId}
                                onChange={(e) => setBulkVenueId(e.target.value)}
                                className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                            >
                                <option value="">-- Choose Venue --</option>
                                {venues.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={applyBulkVenue}
                                disabled={!bulkVenueId || stagedEvents.length === 0}
                                className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                            >
                                Apply to All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats & Actions */}
            {stagedEvents.length > 0 && (
                <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex gap-4 text-sm">
                        <span className="text-gray-600">{stagedEvents.length} total</span>
                        <span className="text-amber-600">⏳ {pendingCount} pending</span>
                        <span className="text-emerald-600">✅ {importedCount} imported</span>
                        <span className="text-red-600">🗑️ {rejectedCount} rejected</span>
                    </div>
                    <button
                        onClick={startReview}
                        disabled={pendingCount === 0}
                        className={`px-6 py-2 rounded-lg font-bold text-white transition-colors ${pendingCount === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                    >
                        Start Review ({pendingCount})
                    </button>
                </div>
            )}

            {/* Events Table */}
            {stagedEvents.length > 0 && (
                <div className="overflow-x-auto border rounded-lg max-h-[400px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Image</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Venue</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stagedEvents.map((event, idx) => (
                                <tr key={event.id} className={
                                    event.status === 'imported' ? 'bg-emerald-50' :
                                        event.status === 'rejected' ? 'bg-red-50 opacity-50' :
                                            event.status === 'duplicate' ? 'bg-amber-50' : ''
                                }>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {event.status === 'pending' && <span className="text-amber-500">⏳</span>}
                                        {event.status === 'importing' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>}
                                        {event.status === 'imported' && <span className="text-emerald-600">✅</span>}
                                        {event.status === 'rejected' && <span className="text-red-500">🗑️</span>}
                                        {event.status === 'duplicate' && <span className="text-amber-500">⚠️</span>}
                                        {event.status === 'error' && <span className="text-red-600" title={event.message}>❌</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                        <img src={event.image_url} alt="" className="h-8 w-12 object-cover rounded bg-gray-100" />
                                    </td>
                                    <td className="px-3 py-2">
                                        <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{event.title}</p>
                                        <p className="text-xs text-gray-500">{new Date(event.date_start).toLocaleDateString()}</p>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-xs text-gray-600 truncate max-w-[120px] block">
                                            {event.selectedVenueId ? venues.find(v => v.id === event.selectedVenueId)?.name : event.location_name || '—'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        {event.status === 'pending' && (
                                            <button
                                                onClick={() => rejectEvent(idx)}
                                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                                title="Reject"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Review Modal */}
            {reviewModalOpen && currentEvent && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Review Event</h3>
                                <p className="text-sm text-gray-500">
                                    {currentReviewIndex! + 1} of {stagedEvents.length} • {pendingCount} pending
                                </p>
                            </div>
                            <button onClick={() => setReviewModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left: Image */}
                                <div>
                                    {currentEvent.image_url ? (
                                        <img src={currentEvent.image_url} alt="" className="w-full h-64 object-cover rounded-lg bg-gray-100" />
                                    ) : (
                                        <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <ImageIcon className="w-12 h-12 text-gray-400" />
                                        </div>
                                    )}
                                </div>

                                {/* Right: Form */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                        <input
                                            type="text"
                                            value={currentEvent.title}
                                            onChange={(e) => updateCurrentEvent({ title: e.target.value })}
                                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                        <textarea
                                            value={currentEvent.description}
                                            onChange={(e) => updateCurrentEvent({ description: e.target.value })}
                                            rows={4}
                                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date/Time</label>
                                            <input
                                                type="datetime-local"
                                                value={currentEvent.date_start?.slice(0, 16) || ''}
                                                onChange={(e) => updateCurrentEvent({ date_start: e.target.value })}
                                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date/Time</label>
                                            <input
                                                type="datetime-local"
                                                value={currentEvent.date_end?.slice(0, 16) || ''}
                                                onChange={(e) => updateCurrentEvent({ date_end: e.target.value })}
                                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                                        <select
                                            value={currentEvent.selectedVenueId || ''}
                                            onChange={(e) => updateCurrentEvent({ selectedVenueId: e.target.value || null })}
                                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                        >
                                            <option value="">📍 Custom: {currentEvent.location_name || 'Unknown'}</option>
                                            {venues.map(v => (
                                                <option key={v.id} value={v.id}>🏢 {v.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                        <select
                                            value={currentEvent.selectedCategoryId || ''}
                                            onChange={(e) => updateCurrentEvent({ selectedCategoryId: e.target.value })}
                                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                        >
                                            <option value="">Select Category</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Error Message */}
                            {importError && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700">{importError}</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                            <button
                                onClick={rejectAndNext}
                                disabled={isImporting}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" /> Reject / Skip
                            </button>
                            <button
                                onClick={approveAndImport}
                                disabled={isImporting || currentEvent.status === 'duplicate'}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isImporting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" /> Approve & Import
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
