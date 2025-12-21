/**
 * SearchResultsDrawer Component
 * A collapsible drawer displaying search results in a grid.
 */
import Link from 'next/link';

import { useEffect, useRef } from 'react';
import { EventResponse } from '@/types';
import SmallEventCard from '@/components/events/SmallEventCard';

interface SearchResultsDrawerProps {
    isOpen: boolean;
    isLoading: boolean;
    results: EventResponse[];
    total: number;
    page: number;
    onClose: () => void;
    onPageChange: (page: number) => void;
    searchParams?: any;
    sort?: string;
    onSortChange?: (sort: string) => void;
}

export default function SearchResultsDrawer({
    isOpen,
    isLoading,
    results,
    total,
    page,
    onClose,
    onPageChange,
    searchParams,
    sort = 'date_asc',
    onSortChange
}: SearchResultsDrawerProps) {
    const drawerRef = useRef<HTMLDivElement>(null);
    const ITEMS_PER_PAGE = 8;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    // Smooth scroll to top of drawer when results change or drawer opens
    useEffect(() => {
        if (isOpen && !isLoading && drawerRef.current) {
            const yOffset = -80; // Offset for sticky header
            const element = drawerRef.current;
            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;

            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }, [isOpen, isLoading, page]);

    return (
        <div
            ref={drawerRef}
            className={`bg-gray-50 border-b border-gray-200 transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                }`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

                {/* Header */}
                <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
                    <div className="flex items-center gap-6">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                            {isLoading ? 'SEARCHING...' : `FOUND ${total} EVENT${total !== 1 ? 'S' : ''}`}
                        </h2>
                        {!isLoading && total > 0 && onSortChange && (
                            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-gray-400">
                                <span>Sort by:</span>
                                <select
                                    value={sort}
                                    onChange={(e) => onSortChange(e.target.value)}
                                    className="bg-transparent border-none text-gray-600 font-medium focus:ring-0 cursor-pointer p-0 text-xs"
                                >
                                    <option value="date_asc">Date (Earliest)</option>
                                    <option value="date_desc">Date (Latest)</option>
                                    <option value="created_desc">Recently Added</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="group flex items-center gap-2 text-gray-400 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
                    >
                        <span className="text-xs font-bold uppercase tracking-wider">Close</span>
                        <div className="bg-gray-200 rounded-full p-1 group-hover:bg-gray-300 transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                    </button>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="aspect-[4/3] bg-gray-200 rounded-xl" />
                        ))}
                    </div>
                ) : results.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {results.map((event) => (
                                <SmallEventCard key={event.id} event={event} />
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 mt-8">
                                <button
                                    onClick={() => onPageChange(page - 1)}
                                    disabled={page === 1}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-gray-600">
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    onClick={() => onPageChange(page + 1)}
                                    disabled={page === totalPages}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}

                        {/* View All Button */}
                        {total > 0 && (
                            <div className="mt-8 text-center">
                                <Link
                                    href={{
                                        pathname: '/events',
                                        query: searchParams
                                    }}
                                    className="inline-flex items-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                                >
                                    View All {total} Events
                                </Link>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No events found</h3>
                        <p className="text-gray-500">Try adjusting your filters or search for something else.</p>
                        <button
                            onClick={onClose}
                            className="mt-4 text-emerald-600 font-medium hover:text-emerald-700"
                        >
                            Clear Search
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
