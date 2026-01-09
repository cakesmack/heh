/**
 * AccommodationMap.tsx
 * Stay22 Affiliate Map Widget with Lazy Loading
 * Shows nearby hotels/Airbnbs around event location
 */

import { useState, useEffect, useRef } from 'react';

interface AccommodationMapProps {
    latitude: number;
    longitude: number;
    eventName: string;
    startDate: string; // ISO date string
    endDate?: string;  // ISO date string (optional, defaults to day after start)
}

// Format date to YYYY-MM-DD for Stay22 API
function formatDateForStay22(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

export default function AccommodationMap({
    latitude,
    longitude,
    eventName,
    startDate,
    endDate
}: AccommodationMapProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Get affiliate ID from environment
    const affiliateId = process.env.NEXT_PUBLIC_STAY22_AID;

    // Gracefully return null if no coordinates or affiliate ID
    if (!latitude || !longitude || !affiliateId) {
        return null;
    }

    // Calculate checkout date (day after end date, or day after start if no end)
    const checkinDate = formatDateForStay22(startDate);
    const checkoutDate = endDate
        ? formatDateForStay22(endDate)
        : formatDateForStay22(new Date(new Date(startDate).getTime() + 86400000).toISOString());

    // Construct Stay22 iframe URL
    const stay22Url = new URL('https://www.stay22.com/embed/gm');
    stay22Url.searchParams.set('aid', affiliateId);
    stay22Url.searchParams.set('lat', latitude.toString());
    stay22Url.searchParams.set('lng', longitude.toString());
    stay22Url.searchParams.set('title', eventName);
    stay22Url.searchParams.set('checkin', checkinDate);
    stay22Url.searchParams.set('checkout', checkoutDate);
    stay22Url.searchParams.set('maincolor', '10b981'); // Brand emerald green (without #)

    // IntersectionObserver for lazy loading
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !hasLoaded) {
                        setIsVisible(true);
                        setHasLoaded(true);
                    }
                });
            },
            {
                rootMargin: '200px', // Start loading 200px before visible
                threshold: 0.01
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [hasLoaded]);

    return (
        <section className="py-12 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Find accommodation nearby</h2>
                    <p className="text-gray-600 mt-1">Hotels and rentals near this event</p>
                </div>

                {/* Map Container with Lazy Loading */}
                <div
                    ref={containerRef}
                    className="relative w-full h-[400px] md:h-[500px] rounded-xl overflow-hidden bg-gray-200"
                >
                    {isVisible ? (
                        <iframe
                            src={stay22Url.toString()}
                            title={`Accommodation near ${eventName}`}
                            className="absolute inset-0 w-full h-full border-0"
                            loading="lazy"
                            allow="geolocation"
                        />
                    ) : (
                        /* Skeleton Placeholder */
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 animate-pulse">
                            {/* Map Icon */}
                            <svg
                                className="w-16 h-16 mb-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                            </svg>
                            <span className="text-sm font-medium">Loading accommodation map...</span>
                        </div>
                    )}
                </div>

                {/* Affiliate Disclosure */}
                <p className="text-xs text-gray-400 mt-3 text-center">
                    Powered by Stay22. We may earn a commission from bookings.
                </p>
            </div>
        </section>
    );
}
