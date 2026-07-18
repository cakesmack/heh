import React, { useState, useEffect } from 'react';
import { Venue, Category } from '@/types';
import { X, Trash2, Check, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import GooglePlacesAutocomplete from '@/components/common/GooglePlacesAutocomplete';
import { UnifiedVenueSelect } from '@/components/venues/UnifiedVenueSelect';

/**
 * Proxy external image URLs through our backend to bypass hotlink protection.
 * Only proxies non-Cloudflare external URLs; Cloudflare and local URLs pass through.
 */
function proxyImageUrl(url: string | undefined): string {
    if (!url) return '/images/event-placeholder.jpg';
    // Already a Cloudflare delivery URL or local path — no proxy needed
    if (url.includes('imagedelivery.net') || url.startsWith('/') || url.startsWith('data:')) return url;
    // External URL — route through backend proxy
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return `${base}/api/media/proxy-image?url=${encodeURIComponent(url)}&token=${token || ''}`;
}

interface StagedEvent {
    id: string; // Unique ID for tracking
    title: string;
    description: string;
    date_start: string;
    date_end?: string;
    image_url: string;
    ticket_url?: string;
    website_url?: string;
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
    address?: string; // Parsed from JSON
    latitude?: number;
    longitude?: number;
    tags?: string[];
}

interface ImportWizardProps {
    venues: Venue[];
    categories: Category[];
    organizers?: any[];
}

const STORAGE_KEY = 'import_wizard_session';

export const ImportWizard: React.FC<ImportWizardProps> = ({ venues, categories, organizers = [] }) => {
    const [stagedEvents, setStagedEvents] = useState<StagedEvent[]>([]);
    const [selectedOrganizerId, setSelectedOrganizerId] = useState<string>('');
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

                    const jsonVenueName = item.venue_name || item.location_name || item.venue || '';
                    const matchedVenue = findMatchingVenue(jsonVenueName);

                    // Smart Address Logic: Combine Venue Name + Address if not already present
                    const rawAddress = item.address || '';
                    let smartAddress = rawAddress;

                    if (jsonVenueName && rawAddress) {
                        const venueInAddress = rawAddress.toLowerCase().includes(jsonVenueName.toLowerCase());
                        if (!venueInAddress) {
                            smartAddress = `${jsonVenueName}, ${rawAddress}`;
                        }
                    } else if (jsonVenueName && !rawAddress) {
                        smartAddress = jsonVenueName;
                    }

                    return {
                        id: `${Date.now()}-${idx}`,
                        ...item,
                        title: item.title || "Untitled Event",
                        description: item.description || '',
                        location_name: item.location_name || item.venue || 'Unknown Location',
                        address: smartAddress, // Use smart address for search
                        raw_showtimes: typeof item.showtimes === 'string' ? [item.showtimes] : (item.showtimes || []),
                        status: 'pending' as const,
                        selectedCategoryId: matchedCategory?.id || '',
                        selectedVenueId: item.venue_id || matchedVenue?.id || null,
                        venue_name: jsonVenueName,
                        website_url: item.website_url || item.event_url || ''
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
                date_end: event.date_end || null,
                image_url: event.image_url,
                ticket_url: event.ticket_url || null,
                website_url: event.website_url || null,
                price_display: event.price_display || "Variable",
                min_price: event.min_price || 0,
                min_age: event.min_age || 0,
                venue_id: event.selectedVenueId,
                location_name: event.location_name,
                address: event.address || undefined,
                latitude: event.latitude || undefined,
                longitude: event.longitude || undefined,
                category_id: event.selectedCategoryId || categories[0]?.id,
                raw_showtimes: event.raw_showtimes || [],
                organizer_profile_id: selectedOrganizerId || undefined,
                tags: event.tags || []
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
                setImportError(`Duplicate detected: ${data.reason}. Verify manually if this is a new event.`);
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
                        className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold"
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
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold"
                        >
                            Resume Session
                        </button>
                        <button
                            onClick={clearSession}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
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

                    <div className="space-y-4 shadow-none">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                2. Select Organiser (Optional)
                            </label>
                            <select
                                value={selectedOrganizerId}
                                onChange={(e) => setSelectedOrganizerId(e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                            >
                                <option value="">None (Post as Admin)</option>
                                {organizers?.map((org: any) => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                                This will assign ALL imported events to this group.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                3. Bulk Set Venue (Optional)
                            </label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <UnifiedVenueSelect
                                        value={bulkVenueId}
                                        onChange={(id, venue) => setBulkVenueId(id)}
                                        placeholder="Search for a venue..."
                                    />
                                </div>
                                <button
                                    onClick={applyBulkVenue}
                                    disabled={!bulkVenueId || stagedEvents.length === 0}
                                    className="px-4 py-2 text-sm font-semibold rounded-md bg-gray-250 hover:bg-gray-350 disabled:opacity-50 text-gray-700"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats & Actions */}
            {stagedEvents.length > 0 && (
                <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex gap-4 text-sm font-medium">
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
                <div className="overflow-x-auto border rounded-lg max-h-[400px] overflow-y-auto shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Image</th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Event</th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Venue</th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stagedEvents.map((event, idx) => (
                                <tr key={event.id} className={
                                    event.status === 'imported' ? 'bg-emerald-50' :
                                        event.status === 'rejected' ? 'bg-red-50/50 opacity-60' :
                                            event.status === 'duplicate' ? 'bg-amber-50' : ''
                                }>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {event.status === 'pending' && <span className="text-amber-500">⏳</span>}
                                        {event.status === 'importing' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>}
                                        {event.status === 'imported' && <span className="text-emerald-600 font-bold">✅</span>}
                                        {event.status === 'rejected' && <span className="text-red-500">🗑️</span>}
                                        {event.status === 'duplicate' && <span className="text-amber-500">⚠️</span>}
                                        {event.status === 'error' && <span className="text-red-600 font-bold" title={event.message}>❌</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="relative h-8 w-12 rounded bg-gray-100 overflow-hidden border border-gray-200">
                                            <img
                                                src={proxyImageUrl(event.image_url)}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).src = '/images/event-placeholder.jpg'; }}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <p className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">{event.title}</p>
                                        <p className="text-xs text-gray-500">{new Date(event.date_start).toLocaleDateString()}</p>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-xs text-gray-600 truncate max-w-[120px] block font-medium">
                                            {event.selectedVenueId ? venues.find(v => v.id === event.selectedVenueId)?.name : event.location_name || '—'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        {event.status === 'pending' && (
                                            <button
                                                onClick={() => rejectEvent(idx)}
                                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
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

            {/* Redesigned Review Modal - Full Screen Workspace */}
            {reviewModalOpen && currentEvent && (
                <div key={currentEvent.id} className="fixed inset-0 bg-white z-50 flex flex-col animate-in fade-in duration-200">
                    
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <span>🛠️ Review & Approve Event</span>
                                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">staged</span>
                            </h3>
                            <p className="text-sm text-gray-500 font-medium">
                                Event {currentReviewIndex! + 1} of {stagedEvents.length} • <span className="text-amber-600 font-semibold">{pendingCount} remaining</span>
                            </p>
                        </div>
                        <button 
                            onClick={() => setReviewModalOpen(false)} 
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-gray-700"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Modal Body - Split Screen Layout */}
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                        
                        {/* Left Panel: Image & High-level status (Sticky left) */}
                        <div className="w-full md:w-1/3 bg-gray-50 border-r border-gray-200 p-6 flex flex-col overflow-y-auto space-y-6">
                            
                            {/* Import progress bar */}
                            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Import Progress</h4>
                                <div className="flex justify-between items-center text-sm font-bold text-gray-700">
                                    <span>Staged List</span>
                                    <span>{((stagedEvents.length - pendingCount) / stagedEvents.length * 100).toFixed(0)}% Done</span>
                                </div>
                                <div className="w-full bg-gray-200 h-2.5 rounded-full mt-3 overflow-hidden">
                                    <div 
                                        className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                                        style={{ width: `${((stagedEvents.length - pendingCount) / stagedEvents.length) * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Sticky Image Panel */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Event Image</h4>
                                {currentEvent.image_url ? (
                                    <div className="relative w-full aspect-[4/3] rounded-xl bg-gray-200 overflow-hidden border border-gray-300 shadow-sm group">
                                        <img
                                            src={proxyImageUrl(currentEvent.image_url)}
                                            alt="Staged Event"
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            onError={(e) => { (e.target as HTMLImageElement).src = '/images/event-placeholder.jpg'; }}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full aspect-[4/3] bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                                        <div className="text-center">
                                            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                            <span className="text-sm font-medium text-gray-500">No Image URL Found</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Raw Showtimes metadata display */}
                            {currentEvent.raw_showtimes && currentEvent.raw_showtimes.length > 0 && (
                                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Parsed Showtimes (Reference)</h4>
                                    <ul className="text-xs text-gray-600 space-y-1.5 max-h-48 overflow-y-auto">
                                        {currentEvent.raw_showtimes.map((st, i) => (
                                            <li key={i} className="py-1 border-b border-gray-100 last:border-0 font-mono text-[11px] leading-tight">
                                                {st}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Right Panel: Clean Workspace Form */}
                        <div className="flex-1 overflow-y-auto p-8 bg-white">
                            <div className="max-w-3xl mx-auto space-y-8">
                                
                                {/* Block 1: Core Info */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">1</span>
                                        Core Info
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Event Title</label>
                                            <input
                                                type="text"
                                                value={currentEvent.title || ''}
                                                onChange={(e) => updateCurrentEvent({ title: e.target.value })}
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-base font-semibold px-4 py-2.5"
                                                placeholder="Enter event title"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Description Workspace</label>
                                            <textarea
                                                value={currentEvent.description || ''}
                                                onChange={(e) => updateCurrentEvent({ description: e.target.value })}
                                                rows={10}
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm p-4 leading-relaxed font-sans focus:outline-none focus:ring-1"
                                                placeholder="No description provided. Double check the raw showtimes details and copy relevant info here..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Block 2: Logistics */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">2</span>
                                        Logistics
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Start Date/Time</label>
                                            <input
                                                type="datetime-local"
                                                value={currentEvent.date_start?.slice(0, 16) || ''}
                                                onChange={(e) => updateCurrentEvent({ date_start: e.target.value })}
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm px-4 py-2.5"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="block text-sm font-bold text-gray-700">End Date/Time</label>
                                                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={!currentEvent.date_end}
                                                        onChange={(e) => updateCurrentEvent({ date_end: e.target.checked ? undefined : currentEvent.date_start })}
                                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    No end time
                                                </label>
                                            </div>
                                            <input
                                                type="datetime-local"
                                                value={currentEvent.date_end?.slice(0, 16) || ''}
                                                onChange={(e) => updateCurrentEvent({ date_end: e.target.value })}
                                                disabled={!currentEvent.date_end}
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm px-4 py-2.5 disabled:bg-gray-100 disabled:text-gray-400"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Venue Location Selection</label>
                                        <UnifiedVenueSelect
                                            value={currentEvent.selectedVenueId || null}
                                            onChange={(id, venue) => updateCurrentEvent({
                                                selectedVenueId: id || null,
                                                location_name: venue ? '' : currentEvent.location_name,
                                                address: venue ? '' : currentEvent.address
                                            })}
                                            placeholder={currentEvent.location_name || "Search for an existing database venue..."}
                                        />
                                    </div>

                                    {/* Custom Location Inputs - Only show if NO venue selected */}
                                    {!currentEvent.selectedVenueId && (
                                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                                            <p className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
                                                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                                No database venue selected. Custom details will create a fallback location marker.
                                            </p>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Location Name (Custom)</label>
                                                <input
                                                    type="text"
                                                    value={currentEvent.location_name || ''}
                                                    onChange={e => updateCurrentEvent({ location_name: e.target.value })}
                                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm px-4 py-2.5"
                                                    placeholder="e.g. Inverness Castle"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Address Search (Google Places API)</label>
                                                <GooglePlacesAutocomplete
                                                    defaultValue={currentEvent.address || currentEvent.location_name || ''}
                                                    onPlaceSelect={(place) => {
                                                        const lat = place.geometry?.location?.lat();
                                                        const lng = place.geometry?.location?.lng();
                                                        updateCurrentEvent({
                                                            address: place.formatted_address || place.name || undefined,
                                                            latitude: lat,
                                                            longitude: lng,
                                                        });
                                                    }}
                                                    placeholder="Search for custom address coordinates..."
                                                    className="w-full"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Block 3: Links & Settings */}
                                <div className="space-y-6 pb-8">
                                    <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">3</span>
                                        Links & Settings
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Event Website URL (event_url)</label>
                                            <input
                                                type="url"
                                                value={currentEvent.website_url || ''}
                                                onChange={(e) => updateCurrentEvent({ website_url: e.target.value })}
                                                placeholder="https://example.com/main-page"
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm px-4 py-2.5"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Ticket URL (ticket_url)</label>
                                            <input
                                                type="url"
                                                value={currentEvent.ticket_url || ''}
                                                onChange={(e) => updateCurrentEvent({ ticket_url: e.target.value })}
                                                placeholder="https://example.com/tickets"
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm px-4 py-2.5"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Price Display</label>
                                            <input
                                                type="text"
                                                value={currentEvent.price_display || ''}
                                                onChange={(e) => updateCurrentEvent({ price_display: e.target.value })}
                                                placeholder="e.g. £15 / Free"
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm px-4 py-2.5"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Min Age (0+)</label>
                                            <input
                                                type="number"
                                                value={currentEvent.min_age || 0}
                                                onChange={(e) => updateCurrentEvent({ min_age: parseInt(e.target.value) || 0 })}
                                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm px-4 py-2.5"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Category Selection</label>
                                        <select
                                            value={currentEvent.selectedCategoryId || ''}
                                            onChange={(e) => updateCurrentEvent({ selectedCategoryId: e.target.value })}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm px-4 py-2.5"
                                        >
                                            <option value="">Select Category</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* Error message banner */}
                    {importError && (
                        <div className="px-6 py-3 bg-red-50 border-t border-b border-red-200 flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700 font-medium">{importError}</p>
                        </div>
                    )}

                    {/* Modal Footer (Actions) */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <button
                            onClick={rejectAndNext}
                            disabled={isImporting}
                            className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 font-bold transition-colors"
                        >
                            <Trash2 className="w-4 h-4" /> Reject / Skip Event
                        </button>
                        <button
                            onClick={approveAndImport}
                            disabled={isImporting || currentEvent.status === 'duplicate'}
                            className="px-8 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 font-bold transition-colors shadow-sm"
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
            )}
        </div>
    );
};
