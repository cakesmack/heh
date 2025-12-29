/**
 * DiscoveryBar Component
 * A responsive search filter bar for discovering events.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useCategories } from '@/hooks/useCategories';
import { useSearch } from '@/context/SearchContext';
import { searchAPI } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';

interface DiscoveryBarProps {
    onSearch: (filters: {
        q?: string;
        location?: string;
        date?: string;
        dateFrom?: string;
        dateTo?: string;
        category?: string;
    }) => void;
    isLoading?: boolean;
    initialFilters?: {
        q?: string;
        location?: string;
        date?: string;
        dateFrom?: string;
        dateTo?: string;
        category?: string;
    };
    mode?: 'floating' | 'embedded';
    hideCategory?: boolean;
}

export default function DiscoveryBar({
    onSearch,
    isLoading = false,
    initialFilters,
    mode = 'floating',
    hideCategory = false
}: DiscoveryBarProps) {
    const [q, setQ] = useState<string>('');
    const [location, setLocation] = useState<string>('');
    const [date, setDate] = useState<string>('');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [category, setCategory] = useState<string>('');

    const { categories, isLoading: isCategoriesLoading } = useCategories();
    const { isMobileSearchOpen, closeMobileSearch } = useSearch();

    // Autocomplete State
    const [suggestions, setSuggestions] = useState<Array<{ term: string; type: string }>>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeInput, setActiveInput] = useState<'q' | 'location' | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [locationInputError, setLocationInputError] = useState(false);

    // GPS Mode State
    const [gpsMode, setGpsMode] = useState(false);
    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedRadius, setSelectedRadius] = useState<string>('10'); // Default 10 miles

    const router = useRouter();
    const debouncedQ = useDebounce(q, 300);
    const debouncedLocation = useDebounce(location, 300);

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (activeInput === 'q' && debouncedQ.length >= 2) {
                try {
                    const res = await searchAPI.suggest(debouncedQ, 'topic');
                    setSuggestions(res.suggestions);
                    setShowSuggestions(true);
                } catch (err) {
                    console.error('Failed to fetch suggestions:', err);
                }
            } else if (activeInput === 'location' && debouncedLocation.length >= 2) {
                try {
                    const res = await searchAPI.suggest(debouncedLocation, 'location');
                    setSuggestions(res.suggestions);
                    setShowSuggestions(true);
                } catch (err) {
                    console.error('Failed to fetch suggestions:', err);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        };

        fetchSuggestions();
    }, [debouncedQ, debouncedLocation, activeInput]);

    // Initialize state from initialFilters when they change (or on mount)
    useEffect(() => {
        if (initialFilters) {
            setQ(initialFilters.q || '');
            setLocation(initialFilters.location || '');
            setDate(initialFilters.date || '');
            setDateFrom(initialFilters.dateFrom || '');
            setDateTo(initialFilters.dateTo || '');
            setCategory(initialFilters.category || '');
        }
    }, [initialFilters]);

    const handleSearch = () => {
        onSearch({
            q: q || undefined,
            location: location || undefined,
            date: date || undefined,
            dateFrom: date === 'custom' ? dateFrom : undefined,
            dateTo: date === 'custom' ? dateTo : undefined,
            category: category || undefined,
        });
        closeMobileSearch();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                handleSuggestionClick(suggestions[selectedIndex]);
            } else {
                handleSearch();
                setShowSuggestions(false);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (suggestion: { term: string; type: string }) => {
        if (activeInput === 'q') {
            setQ(suggestion.term);
        } else if (activeInput === 'location') {
            setLocation(suggestion.term);
        }
        setShowSuggestions(false);
        setSuggestions([]);
        setSelectedIndex(-1);
    };

    const handleNearMeClick = () => {
        if (!navigator.geolocation) {
            setLocationInputError(true);
            setTimeout(() => setLocationInputError(false), 2000);
            alert('Geolocation is not supported by your browser');
            return;
        }

        setIsGettingLocation(true);
        setLocationInputError(false);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setIsGettingLocation(false);
                setUserCoords({ lat: latitude, lng: longitude });
                setGpsMode(true);
                setLocation('');
                closeMobileSearch();
                // Navigate to events page with location params and default radius (in miles)
                router.push({
                    pathname: '/events',
                    query: {
                        latitude: latitude.toFixed(6),
                        longitude: longitude.toFixed(6),
                        radius: selectedRadius,
                        location: 'Near Me'
                    }
                });
            },
            (error) => {
                setIsGettingLocation(false);
                setLocationInputError(true);
                setTimeout(() => setLocationInputError(false), 2000);
                alert('Unable to get your location. Please check your browser permissions.');
                console.warn('Geolocation error:', error.message);
            },
            {
                enableHighAccuracy: false,
                timeout: 15000,
                maximumAge: 600000
            }
        );
    };

    const handleRadiusChange = (newRadius: string) => {
        setSelectedRadius(newRadius);
        if (userCoords) {
            router.push({
                pathname: '/events',
                query: {
                    latitude: userCoords.lat.toFixed(6),
                    longitude: userCoords.lng.toFixed(6),
                    radius: newRadius,
                    location: 'Near Me'
                }
            });
        }
    };

    const exitGpsMode = () => {
        setGpsMode(false);
        setUserCoords(null);
        setLocation('');
        // Remove geo params from URL
        const { latitude, longitude, radius, ...rest } = router.query;
        router.push({ pathname: '/events', query: rest }, undefined, { shallow: true });
    };

    const handleClear = () => {
        setQ('');
        setLocation('');
        setDate('');
        setDateFrom('');
        setDateTo('');
        setCategory('');
        setGpsMode(false);
        setUserCoords(null);
    };

    // Radius options in miles
    const radiusOptions = [
        { value: '2', label: 'Within 2 miles' },
        { value: '5', label: 'Within 5 miles' },
        { value: '10', label: 'Within 10 miles' },
        { value: '20', label: 'Within 20 miles' },
        { value: '50', label: 'Within 50 miles' },
    ];

    // Dynamic classes based on mode
    const containerClasses = mode === 'floating'
        ? "hidden md:block bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40"
        : "hidden md:block bg-white border-b border-gray-200 mb-8"; // Embedded mode: no sticky, no shadow, margin bottom

    const innerClasses = mode === 'floating'
        ? "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4"
        : "w-full py-4"; // Embedded: full width of parent

    return (
        <>
            {/* Desktop View */}
            <div className={containerClasses}>
                <div className={innerClasses}>
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">

                        {/* Keyword Search */}
                        <div className="w-full md:flex-1">
                            <label htmlFor="search" className="sr-only">Search</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    id="search"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    onFocus={() => setActiveInput('q')}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Search events, venues, or towns..."
                                    className="block w-full pl-10 pr-3 py-3 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-lg bg-gray-50 hover:bg-white transition-colors"
                                    autoComplete="off"
                                />

                                {/* Topic Suggestions Dropdown */}
                                {showSuggestions && activeInput === 'q' && suggestions.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Suggested Topics</span>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto">
                                            {suggestions.map((s, i) => (
                                                <button
                                                    key={`${s.term}-${i}`}
                                                    onClick={() => handleSuggestionClick(s)}
                                                    onMouseEnter={() => setSelectedIndex(i)}
                                                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${i === selectedIndex ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                                >
                                                    <svg className={`w-4 h-4 ${i === selectedIndex ? 'text-emerald-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                    </svg>
                                                    <span className="text-sm font-medium">{s.term}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Distance Select - Static Dropdown */}
                        <div className="w-auto flex-shrink-0">
                            <div className="relative">
                                {/* Left Icon: Map Pin */}
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    {isGettingLocation ? (
                                        <svg className="h-5 w-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <svg className={`h-5 w-5 ${gpsMode ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    )}
                                </div>
                                {/* Select Element */}
                                <select
                                    value={gpsMode ? selectedRadius : ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '') {
                                            // "Distance: Any" selected - clear GPS mode
                                            exitGpsMode();
                                        } else {
                                            // Distance selected - get location and search
                                            setSelectedRadius(value);
                                            if (userCoords) {
                                                // Already have coords, just update radius
                                                handleRadiusChange(value);
                                            } else {
                                                // Need to get GPS location first
                                                handleNearMeClick();
                                            }
                                        }
                                    }}
                                    disabled={isGettingLocation}
                                    className={`block w-full pl-10 pr-8 py-3 text-base sm:text-sm rounded-lg cursor-pointer appearance-none transition-colors ${gpsMode
                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 font-medium focus:ring-emerald-500 focus:border-emerald-500'
                                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-emerald-500 focus:border-emerald-500'
                                        } ${locationInputError ? 'border-red-500 ring-2 ring-red-500' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    <option value="">Distance: Any</option>
                                    {radiusOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                {/* Right Icon: Chevron Down */}
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <svg className={`h-4 w-4 ${gpsMode ? 'text-emerald-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Date Select & Custom Range */}
                        <div className="w-full md:flex-[1.5] flex flex-col sm:flex-row gap-2">
                            <div className="w-full relative">
                                <label htmlFor="date" className="sr-only">Date</label>
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <select
                                    id="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-lg bg-gray-50 hover:bg-white transition-colors cursor-pointer appearance-none"
                                >
                                    <option value="">Any Date</option>
                                    <option value="today">Today</option>
                                    <option value="tomorrow">Tomorrow</option>
                                    <option value="weekend">This Weekend</option>
                                    <option value="week">Next 7 Days</option>
                                    <option value="month">This Month</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>

                            {date === 'custom' && (
                                <div className="flex gap-2 w-full animate-fade-in">
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="block w-full px-3 py-3 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-lg bg-gray-50"
                                        placeholder="From"
                                    />
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="block w-full px-3 py-3 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-lg bg-gray-50"
                                        placeholder="To"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Category Select */}
                        {!hideCategory && (
                            <div className="w-full md:flex-1">
                                <label htmlFor="category" className="sr-only">Category</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        </svg>
                                    </div>
                                    <select
                                        id="category"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        disabled={isCategoriesLoading}
                                        className="block w-full pl-10 pr-3 py-3 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm rounded-lg bg-gray-50 hover:bg-white transition-colors cursor-pointer appearance-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        <option value="">{isCategoriesLoading ? 'Loading...' : 'All Categories'}</option>
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.slug}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Search Actions */}
                        <div className="w-full md:w-auto flex gap-2">
                            <button
                                onClick={handleClear}
                                className="px-4 py-3 bg-white text-gray-700 font-semibold rounded-lg shadow-sm border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                title="Clear all filters"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            <button
                                onClick={handleSearch}
                                disabled={isLoading}
                                className="flex-1 md:flex-none px-8 py-3 bg-emerald-600 text-white font-semibold rounded-lg shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Searching...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <span>Search</span>
                                    </>
                                )}
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            {/* Mobile Modal - Visible when isMobileSearchOpen is true */}
            {isMobileSearchOpen && (
                <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col animate-slide-up">
                    {/* Modal Header */}
                    <div className="flex justify-between items-center px-4 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
                        <h2 className="text-lg font-bold text-gray-900">Search Events</h2>
                        <button
                            onClick={closeMobileSearch}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Modal Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
                        {/* Keyword Search */}
                        <div>
                            <label htmlFor="mobile-search" className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    id="mobile-search"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search events..."
                                    className="block w-full pl-10 pr-3 py-3 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 rounded-lg bg-gray-50"
                                />
                            </div>
                        </div>

                        {/* Distance Select - Static Dropdown (Mobile) */}
                        <div>
                            <label htmlFor="mobile-distance" className="block text-sm font-medium text-gray-700 mb-1">Distance</label>
                            <div className="relative">
                                {/* Left Icon: Map Pin */}
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    {isGettingLocation ? (
                                        <svg className="h-5 w-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <svg className={`h-5 w-5 ${gpsMode ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    )}
                                </div>
                                {/* Select Element */}
                                <select
                                    id="mobile-distance"
                                    value={gpsMode ? selectedRadius : ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '') {
                                            exitGpsMode();
                                        } else {
                                            setSelectedRadius(value);
                                            if (userCoords) {
                                                handleRadiusChange(value);
                                            } else {
                                                handleNearMeClick();
                                            }
                                        }
                                    }}
                                    disabled={isGettingLocation}
                                    className={`block w-full pl-10 pr-8 py-3 text-base rounded-lg cursor-pointer appearance-none transition-colors ${gpsMode
                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 font-medium focus:ring-emerald-500 focus:border-emerald-500'
                                            : 'border-gray-300 bg-gray-50 text-gray-700 focus:ring-emerald-500 focus:border-emerald-500'
                                        } ${locationInputError ? 'border-red-500 ring-2 ring-red-500' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    <option value="">Distance: Any</option>
                                    {radiusOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                {/* Right Icon: Chevron Down */}
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <svg className={`h-4 w-4 ${gpsMode ? 'text-emerald-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Date Select */}
                        <div>
                            <label htmlFor="mobile-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <select
                                id="mobile-date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 rounded-lg bg-gray-50"
                            >
                                <option value="">Any Date</option>
                                <option value="today">Today</option>
                                <option value="tomorrow">Tomorrow</option>
                                <option value="weekend">This Weekend</option>
                                <option value="week">Next 7 Days</option>
                                <option value="month">This Month</option>
                                <option value="custom">Custom Range</option>
                            </select>
                            {date === 'custom' && (
                                <div className="flex gap-2 mt-2">
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="block w-full px-3 py-3 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 rounded-lg bg-gray-50"
                                    />
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="block w-full px-3 py-3 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 rounded-lg bg-gray-50"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Category Select */}
                        {!hideCategory && (
                            <div>
                                <label htmlFor="mobile-category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <select
                                    id="mobile-category"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    disabled={isCategoriesLoading}
                                    className="block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 rounded-lg bg-gray-50 disabled:bg-gray-100"
                                >
                                    <option value="">{isCategoriesLoading ? 'Loading...' : 'All Categories'}</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.slug}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                    </div>

                    {/* Modal Footer - Actions */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50 sticky bottom-0 flex gap-3">
                        <button
                            onClick={handleClear}
                            className="flex-1 px-4 py-3 bg-white text-gray-700 font-bold rounded-xl border border-gray-300 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
                        >
                            Clear
                        </button>
                        <button
                            onClick={handleSearch}
                            className="flex-[2] px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Searching...' : 'Show Results'}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
