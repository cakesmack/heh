import React, { useState } from 'react';
import { Venue, Category } from '@/types';

interface ImportWizardProps {
    venues: Venue[];
    categories: Category[];
}

interface StagedEvent {
    // Extracted from JSON file
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
    venue_name?: string; // From JSON for smart matching
    raw_showtimes?: string[];

    // UI State
    status: 'idle' | 'pending' | 'success' | 'skipped' | 'error';
    message?: string;
    selectedCategoryId?: string;
    selectedVenueId: string | null; // null = custom location
    location_name: string; // Always keep the original text
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ venues, categories }) => {
    const [file, setFile] = useState<File | null>(null);
    const [stagedEvents, setStagedEvents] = useState<StagedEvent[]>([]);
    const [bulkVenueId, setBulkVenueId] = useState<string>('');
    const [isImporting, setIsImporting] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);

    // Smart venue matching (fuzzy, case-insensitive)
    const findMatchingVenue = (venueName: string): Venue | undefined => {
        if (!venueName) return undefined;
        const normalized = venueName.toLowerCase().trim();
        return venues.find(v =>
            v.name.toLowerCase().trim() === normalized ||
            v.name.toLowerCase().includes(normalized) ||
            normalized.includes(v.name.toLowerCase())
        );
    };

    // 1. File Parsing with Smart Matching
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setParseError(null);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (!Array.isArray(json)) {
                    throw new Error("JSON must be an array of event objects");
                }

                const staged: StagedEvent[] = json.map((item: any) => {
                    // Auto-map category
                    const normalizedCatName = (item.category_name || '').toLowerCase();
                    const matchedCategory = categories.find(c =>
                        c.name.toLowerCase() === normalizedCatName ||
                        c.slug === normalizedCatName
                    );

                    // Smart venue matching
                    const jsonVenueName = item.venue_name || item.location_name || '';
                    const matchedVenue = findMatchingVenue(jsonVenueName);

                    return {
                        ...item,
                        title: item.title || "Untitled Event",
                        description: item.description || "",
                        status: 'idle' as const,
                        selectedCategoryId: matchedCategory?.id || '',
                        selectedVenueId: matchedVenue?.id || null, // null if no match
                        location_name: jsonVenueName, // Always preserve original
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

    // Apply bulk venue to all pending rows
    const applyBulkVenue = () => {
        if (!bulkVenueId) return;
        setStagedEvents(prev => prev.map(event =>
            event.status === 'idle' || event.status === 'error'
                ? { ...event, selectedVenueId: bulkVenueId }
                : event
        ));
    };

    // 2. The Import Loop
    const startImport = async () => {
        setIsImporting(true);

        for (let i = 0; i < stagedEvents.length; i++) {
            const event = stagedEvents[i];

            if (event.status === 'success' || event.status === 'skipped') continue;

            updateRowStatus(i, 'pending');

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
                    venue_id: event.selectedVenueId, // Can be null
                    location_name: event.location_name, // Always send
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
                    updateRowStatus(i, 'skipped', data.reason);
                } else {
                    updateRowStatus(i, 'success');
                }

            } catch (err: any) {
                console.error(`Error importing row ${i}:`, err);
                updateRowStatus(i, 'error', err.message);
            }
        }

        setIsImporting(false);
    };

    const updateRowStatus = (index: number, status: StagedEvent['status'], message?: string) => {
        setStagedEvents(prev => {
            const next = [...prev];
            next[index] = { ...next[index], status, message };
            return next;
        });
    };

    // Count stats
    const customLocationCount = stagedEvents.filter(e => e.selectedVenueId === null).length;
    const venueMatchedCount = stagedEvents.filter(e => e.selectedVenueId !== null).length;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Event Import Wizard</h2>

            {/* Configuration Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-4 bg-gray-50 rounded-lg">
                {/* File Upload */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        1. Select JSON File
                    </label>
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500
               file:mr-4 file:py-2 file:px-4
               file:rounded-full file:border-0
               file:text-sm file:font-semibold
               file:bg-emerald-50 file:text-emerald-700
               hover:file:bg-emerald-100"
                    />
                    {parseError && <p className="text-red-600 text-xs mt-2">{parseError}</p>}
                </div>

                {/* Bulk Venue Selector */}
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
                            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Apply to All
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            {stagedEvents.length > 0 && (
                <div className="flex items-center gap-4 mb-4 text-sm">
                    <span className="text-gray-600">{stagedEvents.length} events loaded</span>
                    <span className="text-emerald-600">🏢 {venueMatchedCount} venue-matched</span>
                    <span className="text-gray-500">📍 {customLocationCount} custom locations</span>
                </div>
            )}

            {/* Main Actions */}
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                    {stagedEvents.length > 0 ? 'Ready for import.' : 'No events loaded.'}
                </p>
                <button
                    onClick={startImport}
                    disabled={isImporting || stagedEvents.length === 0}
                    className={`px-6 py-2 rounded-lg font-bold text-white transition-colors ${isImporting || stagedEvents.length === 0
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                >
                    {isImporting ? 'Importing...' : 'Start Import'}
                </button>
            </div>

            {/* Staged Events Table */}
            {stagedEvents.length > 0 && (
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venue</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stagedEvents.map((event, idx) => (
                                <tr key={idx} className={event.status === 'success' ? 'bg-emerald-50/30' : ''}>
                                    {/* Status */}
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        {event.status === 'idle' && <span className="text-gray-400">Ready</span>}
                                        {event.status === 'pending' && (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
                                        )}
                                        {event.status === 'success' && <span className="text-emerald-600 text-lg">✅</span>}
                                        {event.status === 'skipped' && <span className="text-amber-500 font-medium" title={event.message}>⚠️</span>}
                                        {event.status === 'error' && <span className="text-red-600 font-medium" title={event.message}>❌</span>}
                                    </td>

                                    {/* Image */}
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <img src={event.image_url} alt="" className="h-10 w-14 object-cover rounded shadow-sm bg-gray-100" />
                                    </td>

                                    {/* Event Details */}
                                    <td className="px-4 py-4">
                                        <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{event.title}</p>
                                        <p className="text-xs text-gray-500">{new Date(event.date_start).toLocaleDateString()}</p>
                                    </td>

                                    {/* Venue Dropdown */}
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {/* Icon */}
                                            {event.selectedVenueId ? (
                                                <span className="text-emerald-600" title="Database Venue">🏢</span>
                                            ) : (
                                                <span className="text-gray-400" title="Custom Location">📍</span>
                                            )}
                                            <select
                                                value={event.selectedVenueId || ''}
                                                onChange={(e) => {
                                                    const newVenueId = e.target.value || null;
                                                    setStagedEvents(prev => {
                                                        const next = [...prev];
                                                        next[idx] = { ...next[idx], selectedVenueId: newVenueId };
                                                        return next;
                                                    });
                                                }}
                                                className="block w-40 text-xs rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                            >
                                                <option value="">📍 Custom: {event.location_name || 'Unknown'}</option>
                                                {venues.map(v => (
                                                    <option key={v.id} value={v.id}>🏢 {v.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </td>

                                    {/* Category */}
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <select
                                            value={event.selectedCategoryId}
                                            onChange={(e) => {
                                                const newCatId = e.target.value;
                                                setStagedEvents(prev => {
                                                    const next = [...prev];
                                                    next[idx] = { ...next[idx], selectedCategoryId: newCatId };
                                                    return next;
                                                });
                                            }}
                                            className="block w-32 text-xs rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                        >
                                            <option value="">Select</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
