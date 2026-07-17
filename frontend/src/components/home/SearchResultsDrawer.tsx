/**
 * SearchResultsDrawer Component
 * A collapsible drawer displaying search results in a grid.
 */
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { EventResponse } from '@/types';
import SmallEventCard from '@/components/events/SmallEventCard';
import FilterBar from '@/components/search/FilterBar';

interface SearchResultsDrawerProps {
    isOpen: boolean;
    isLoading: boolean;
    results: EventResponse[];
    venues?: any[];
    total: number;
    page: number;
    onClose: () => void;
    onPageChange: (page: number) => void;
    searchParams?: any;
    sort?: string;
    onSortChange?: (sort: string) => void;
    itemsPerPage?: number;
    onFilterChange?: (filters: { date?: string; radius?: string; category?: string }) => void;
}

export default function SearchResultsDrawer({
    isOpen,
    isLoading,
    results,
    venues = [],
    total,
    page,
    onClose,
    onPageChange,
    searchParams,
    sort = 'date_asc',
    onSortChange,
    itemsPerPage = 8,
    onFilterChange
}: SearchResultsDrawerProps) {
    const drawerRef = useRef<HTMLDivElement>(null);
    const totalPages = Math.ceil(total / itemsPerPage);

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
                <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
                    <div className="flex items-center gap-6">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                            {isLoading ? 'SEARCHING...' : `FOUND ${total} EVENT${total !== 1 ? 'S' : ''}`}
                        </h2>
                        {!isLoading && total > 0 && onSortChange && (
                            <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
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
                </div>

                {/* Sticky Filter Bar */}
                <FilterBar
                    activeDate={searchParams?.date}
                    activeRadius={searchParams?.radius}
                    activeCategory={searchParams?.category}
                    onFilterChange={(newFilters) => onFilterChange?.(newFilters)}
                />

                {/* Content */}
                {isLoading ? (
                    <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="aspect-[4/3] bg-gray-200 rounded-xl" />
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Matching Venues Section */}
                        {venues.length > 0 && (
                            <div className="mb-8 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                                    Matching Venues
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {venues.slice(0, 3).map((venue) => (
                                        <Link
                                            key={venue.id}
                                            href={`/venues/${venue.slug || venue.id}`}
                                            className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 hover:bg-emerald-100/70 text-emerald-800 text-sm font-semibold transition-all shadow-sm"
                                        >
                                            <svg className="w-4 h-4 mr-1.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span>{venue.name}</span>
                                            {venue.city && (
                                                <span className="text-emerald-600/70 font-normal ml-1.5 border-l border-emerald-200/60 pl-1.5 text-xs">
                                                    {venue.city}
                                                </span>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.length > 0 ? (
                            <>
                                <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                            href={`/search?q=${encodeURIComponent(searchParams?.q || '')}`}
                                            className="inline-flex items-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                                        >
                                            View All Results
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
                    </>
                )}
            </div>
        </div>
    );
}
