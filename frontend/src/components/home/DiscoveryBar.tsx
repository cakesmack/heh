/**
 * DiscoveryBar Component
 * A clean, single pill-shaped predictive search bar.
 */
import { useState, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
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
    };
    mode?: 'floating' | 'embedded';
    hideCategory?: boolean;
    variant?: 'light' | 'dark';
}

export default function DiscoveryBar({
    onSearch,
    isLoading = false,
    initialFilters,
    variant = 'dark',
}: DiscoveryBarProps) {
    const [q, setQ] = useState<string>('');
    const [suggestions, setSuggestions] = useState<Array<{ term: string; type: string }>>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [isInputFocused, setIsInputFocused] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const debouncedQ = useDebounce(q, 300);

    // Reset dropdown on route change
    useEffect(() => {
        setShowSuggestions(false);
        setSuggestions([]);
        setSelectedIndex(-1);
    }, [pathname, searchParams]);

    // Close suggestions dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Initialize q state from initialFilters if present
    useEffect(() => {
        if (initialFilters?.q) {
            setQ(initialFilters.q);
        }
    }, [initialFilters]);

    // Autocomplete fetch effect
    useEffect(() => {
        const fetchSuggestions = async () => {
            if (debouncedQ && debouncedQ.trim().length >= 2) {
                try {
                    const res = await searchAPI.suggest(debouncedQ.trim(), 'all');
                    if (res && res.suggestions) {
                        setSuggestions(res.suggestions);
                        setShowSuggestions(true);
                    }
                } catch (err) {
                    console.error('Failed to fetch search suggestions:', err);
                    setSuggestions([]);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        };

        fetchSuggestions();
    }, [debouncedQ]);

    const handleSearch = (searchTerm?: string) => {
        const queryToSubmit = searchTerm !== undefined ? searchTerm : q;
        setShowSuggestions(false);
        setSuggestions([]);
        setSelectedIndex(-1);
        if (inputRef.current) {
            inputRef.current.blur();
        }
        
        onSearch({ q: queryToSubmit || undefined });
    };

    const handleClear = () => {
        setQ('');
        setSuggestions([]);
        setShowSuggestions(false);
        setSelectedIndex(-1);
        if (inputRef.current) {
            inputRef.current.blur(); // Explicitly drop mobile keyboard
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                const selectedTerm = suggestions[selectedIndex].term;
                setQ(selectedTerm);
                handleSearch(selectedTerm);
            } else {
                handleSearch();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
            if (inputRef.current) {
                inputRef.current.blur();
            }
        }
    };

    const handleSuggestionClick = (term: string) => {
        setQ(term);
        setShowSuggestions(false);
        handleSearch(term);
    };

    return (
        <div ref={containerRef} className="w-full relative max-w-3xl mx-auto z-20">
            {/* Primary Pill-Shaped Search Input Container */}
            <div 
                className={`flex items-center w-full rounded-full p-1.5 transition-all focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent ${
                    variant === 'dark'
                        ? 'bg-black/40 backdrop-blur-md border border-white/20 shadow-2xl'
                        : 'bg-white border border-gray-200 shadow-md'
                }`}
            >
                {/* Magnifying Glass Icon */}
                <div className={`pl-4 pr-2 flex items-center pointer-events-none flex-shrink-0 ${
                    variant === 'dark' ? 'text-white/60' : 'text-gray-400'
                }`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                {/* Single Text Input */}
                <input
                    ref={inputRef}
                    type="text"
                    id="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onFocus={() => {
                        setIsInputFocused(true);
                        if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => {
                        setIsInputFocused(false);
                        setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search events, towns, or venues..."
                    className={`w-full bg-transparent py-3 px-2 text-base sm:text-lg focus:outline-none focus:ring-0 border-none [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[0_0_0px_1000px_rgba(0,0,0,0)_inset] ${
                        variant === 'dark'
                            ? 'text-white placeholder-gray-300 [&:-webkit-autofill]:[-webkit-text-fill-color:white]'
                            : 'text-gray-900 placeholder-gray-500 [&:-webkit-autofill]:[-webkit-text-fill-color:black]'
                    }`}
                    autoComplete="off"
                />

                {/* Clear / 'X' Button - visible when q is non-empty */}
                {Boolean(q) && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className={`p-2 rounded-full transition-colors flex-shrink-0 mr-1 ${
                            variant === 'dark'
                                ? 'text-white/60 hover:text-white'
                                : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title="Clear search"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}

                {/* Solid Green Search Button */}
                <button
                    type="button"
                    onClick={() => handleSearch()}
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full px-6 py-3 sm:px-8 sm:py-3.5 flex items-center justify-center gap-2 transition-all flex-shrink-0 shadow-md active:scale-95 disabled:opacity-50"
                >
                    {isLoading ? (
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    ) : (
                        <span>Search</span>
                    )}
                </button>
            </div>

            {/* Floating Light-Themed Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden text-gray-900 max-h-72 overflow-y-auto divide-y divide-gray-100 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Suggestions</span>
                        <span className="text-[10px] text-gray-400">Use ↑↓ to navigate</span>
                    </div>
                    <div className="py-1">
                        {suggestions.map((item, index) => (
                            <button
                                key={`${item.term}-${index}`}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSuggestionClick(item.term)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                                    index === selectedIndex ? 'bg-emerald-50 text-emerald-800 font-medium' : 'hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className={`w-4 h-4 ${index === selectedIndex ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <span className="text-sm">{item.term}</span>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 capitalize">
                                    {item.type}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
