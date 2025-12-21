import { useState, useRef, useEffect } from 'react';

interface AddToCalendarProps {
    event: {
        title: string;
        description?: string;
        date_start: string;
        date_end: string;
        location_name?: string;
        venue?: {
            name: string;
            address?: string;
            city?: string;
            postcode?: string;
        };
    };
    className?: string;
}

export default function AddToCalendar({ event, className = '' }: AddToCalendarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatGoogleDate = (dateString: string) => {
        return new Date(dateString).toISOString().replace(/-|:|\.\d+/g, '');
    };

    const getLocation = () => {
        if (event.venue) {
            const parts = [event.venue.name, event.venue.address, event.venue.city, event.venue.postcode];
            return parts.filter(Boolean).join(', ');
        }
        return event.location_name || '';
    };

    const getGoogleUrl = () => {
        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: event.title,
            dates: `${formatGoogleDate(event.date_start)}/${formatGoogleDate(event.date_end)}`,
            details: event.description || '',
            location: getLocation(),
        });
        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    };

    const getOutlookUrl = () => {
        const params = new URLSearchParams({
            path: '/calendar/action/compose',
            rru: 'addevent',
            startdt: event.date_start,
            enddt: event.date_end,
            subject: event.title,
            body: event.description || '',
            location: getLocation(),
        });
        return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
    };

    const downloadIcs = () => {
        const formatDate = (dateString: string) => {
            return new Date(dateString).toISOString().replace(/-|:|\.\d+/g, '');
        };

        const content = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'BEGIN:VEVENT',
            `DTSTART:${formatDate(event.date_start)}`,
            `DTEND:${formatDate(event.date_end)}`,
            `SUMMARY:${event.title}`,
            `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
            `LOCATION:${getLocation()}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\n');

        const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-sm transition-colors"
            >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Add to Calendar
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50 py-1">
                    <a
                        href={getGoogleUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        onClick={() => setIsOpen(false)}
                    >
                        Google Calendar
                    </a>
                    <a
                        href={getOutlookUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                        onClick={() => setIsOpen(false)}
                    >
                        Outlook
                    </a>
                    <button
                        onClick={downloadIcs}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    >
                        Download .ics
                    </button>
                </div>
            )}
        </div>
    );
}
