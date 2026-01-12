import React, { useState } from 'react';
import { api } from '@/lib/api';
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
    category_name?: string; // Used for auto-mapping
    raw_showtimes?: string[];

    // UI State
    status: 'idle' | 'pending' | 'success' | 'skipped' | 'error';
    message?: string;
    selectedCategoryId?: string; // Can be overridden row-by-row
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ venues, categories }) => {
    const [file, setFile] = useState<File | null>(null);
    const [stagedEvents, setStagedEvents] = useState<StagedEvent[]>([]);
    const [globalVenueId, setGlobalVenueId] = useState<string>('');
    const [isImporting, setIsImporting] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);

    // 1. File Parsing
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

                // Map JSON to StagedEvent with auto-category mapping
                const staged: StagedEvent[] = json.map((item: any) => {
                    // Auto-map category
                    const normalizedCatName = (item.category_name || '').toLowerCase();
                    const matchedCategory = categories.find(c =>
                        c.name.toLowerCase() === normalizedCatName ||
                        c.slug === normalizedCatName
                    );

                    return {
                        ...item,
                        title: item.title || "Untitled Event",
                        description: item.description || "",
                        status: 'idle',
                        selectedCategoryId: matchedCategory?.id || ''
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

    // 2. The Import Loop
    const startImport = async () => {
        if (!globalVenueId) {
            alert("Please select a global venue first.");
            return;
        }

        setIsImporting(true);

        // Iterate sequentially to prevent Cloudinary rate limits
        for (let i = 0; i < stagedEvents.length; i++) {
            const event = stagedEvents[i];

            // Skip already processed
            if (event.status === 'success' || event.status === 'skipped') continue;

            // Update status to pending
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
                    venue_id: globalVenueId,
                    category_id: event.selectedCategoryId || categories[0]?.id, // Fallback to first cat
                    raw_showtimes: event.raw_showtimes || []
                };

                // Call the Python Backend Endpoint
                // Using fetch directly or api helper. 
                // Assuming api.post is available, otherwise fetch.
                // Using fetch for simplicity with the custom endpoint path
                const token = localStorage.getItem('token');
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

                {/* Global Venue Selector */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        2. Select Global Venue
                    </label>
                    <select
                        value={globalVenueId}
                        onChange={(e) => setGlobalVenueId(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                    >
                        <option value="">-- Choose Venue --</option>
                        {venues.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Main Actions */}
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                    {stagedEvents.length > 0 ? `${stagedEvents.length} events loaded ready for import.` : 'No events loaded.'}
                </p>
                <button
                    onClick={startImport}
                    disabled={isImporting || stagedEvents.length === 0 || !globalVenueId}
                    className={`px-6 py-2 rounded-lg font-bold text-white transition-colors ${isImporting || stagedEvents.length === 0 || !globalVenueId
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Details</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stagedEvents.map((event, idx) => (
                                <tr key={idx} className={event.status === 'success' ? 'bg-emerald-50/30' : ''}>
                                    {/* Status Column */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {event.status === 'idle' && <span className="text-gray-400">Ready</span>}
                                        {event.status === 'pending' && (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
                                        )}
                                        {event.status === 'success' && <span className="text-emerald-600 text-lg">✅</span>}
                                        {event.status === 'skipped' && <span className="text-amber-500 font-medium" title={event.message}>⚠️ Skipped</span>}
                                        {event.status === 'error' && <span className="text-red-600 font-medium" title={event.message}>❌ Error</span>}

                                        {event.message && event.status !== 'success' && (
                                            <p className="text-xs text-gray-500 mt-1 max-w-[150px] truncate">{event.message}</p>
                                        )}
                                    </td>

                                    {/* Image Preview */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <img src={event.image_url} alt="" className="h-12 w-16 object-cover rounded shadow-sm bg-gray-100" />
                                    </td>

                                    {/* Details */}
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-gray-900">{event.title}</p>
                                        <p className="text-xs text-gray-500">{new Date(event.date_start).toLocaleDateString()}</p>
                                    </td>

                                    {/* Category Select */}
                                    <td className="px-6 py-4 whitespace-nowrap">
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
                                            className="block w-full text-xs rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                        >
                                            <option value="">Select Category</option>
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
