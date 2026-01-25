import { useState, useMemo, useRef, useEffect } from 'react';
// Removed Headless UI import as it is not installed
import { UserProfile, Organizer } from '@/types';

interface OrganizerSelectorProps {
    user: any; // UserProfile type is missing fields in current definition, using any for now to avoid blocking
    organizers: Organizer[];
    selectedId: string;
    onChange: (id: string) => void;
    error?: string;
}

export default function OrganizerSelector({
    user,
    organizers,
    selectedId,
    onChange,
    error
}: OrganizerSelectorProps) {

    // 1. Combine Options
    const options = useMemo(() => {
        if (!user) return [];

        const myself = {
            id: '', // Empty string usually represents "Myself" / no profile ID
            name: user.name || user.email || 'Myself',
            image_url: user.image_url,
            type: 'user'
        };

        const groups = organizers.map(org => ({
            id: org.id,
            name: org.name,
            image_url: org.logo_url,
            type: 'group'
        }));

        return [myself, ...groups];
    }, [user, organizers]);

    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredOptions = query === ''
        ? options
        : options.filter((person) =>
            person.name.toLowerCase().includes(query.toLowerCase())
        );

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (id: string) => {
        onChange(id);
        setIsOpen(false);
        setQuery('');
    };

    // 2. Threshold Check
    const isLargeList = options.length > 6;

    if (!user) return null;

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6 scroll-mt-24" id="organizer-selector">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Who is hosting this event?</h2>

            {/* GRID LAYOUT (<= 6 Options) */}
            {!isLargeList && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {options.map((option) => {
                        const isSelected = selectedId === option.id;
                        return (
                            <button
                                key={option.id || 'myself'}
                                type="button"
                                onClick={() => onChange(option.id)}
                                className={`relative flex items-center p-4 rounded-lg border-2 text-left transition-all ${isSelected
                                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500 ring-opacity-20'
                                        : 'border-gray-200 hover:border-emerald-200 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-200 shrink-0 border border-gray-200">
                                    {option.image_url ? (
                                        <img src={option.image_url} alt={option.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center bg-emerald-100 text-emerald-600 font-bold">
                                            {option.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="ml-4 overflow-hidden">
                                    <p className={`font-medium truncate ${isSelected ? 'text-emerald-900' : 'text-gray-900'}`}>
                                        {option.name}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {option.id === '' ? 'Personal Profile' : 'Group / Organization'}
                                    </p>
                                </div>
                                {isSelected && (
                                    <div className="absolute top-2 right-2 text-emerald-600">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* COMBOBOX LAYOUT (> 6 Options) */}
            {isLargeList && (
                <div className="max-w-md relative" ref={containerRef}>
                    <div className="relative">
                        <input
                            type="text"
                            className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                            placeholder="Search for an organizer..."
                            value={isOpen ? query : (options.find(o => o.id === selectedId)?.name || '')}
                            onFocus={() => {
                                setIsOpen(true);
                                setQuery('');
                            }}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setIsOpen(true);
                            }}
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>

                    {isOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                            {filteredOptions.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
                            ) : (
                                filteredOptions.map((option) => (
                                    <button
                                        key={option.id || 'myself'}
                                        type="button"
                                        onClick={() => handleSelect(option.id)}
                                        className={`w-full text-left px-4 py-3 flex items-center space-x-3 hover:bg-gray-50 transition-colors ${selectedId === option.id ? 'bg-emerald-50' : ''
                                            }`}
                                    >
                                        <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0 border border-gray-200">
                                            {option.image_url ? (
                                                <img src={option.image_url} alt={option.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center bg-gray-100 text-gray-500 text-xs font-bold">
                                                    {option.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-medium ${selectedId === option.id ? 'text-emerald-900' : 'text-gray-900'}`}>
                                                {option.name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {option.id === '' ? 'Personal Profile' : 'Group'}
                                            </p>
                                        </div>
                                        {selectedId === option.id && (
                                            <div className="ml-auto text-emerald-600">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            </div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}
            {error && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    {error}
                </p>
            )}
        </div>
    );
}
