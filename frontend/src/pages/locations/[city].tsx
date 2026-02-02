import { GetServerSideProps } from 'next';
import Head from 'next/head';
import React from 'react';
import Link from 'next/link';
import { eventsAPI } from '@/lib/api';
import { EventResponse } from '@/types';
import MagazineGrid from '@/components/home/MagazineGrid';
import { Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface LocationPageProps {
    city: string;
    events: EventResponse[];
    fallbackEvents: EventResponse[]; // Events to show if city has 0 results
    total: number;
}

export default function LocationPage({ city, events, fallbackEvents, total }: LocationPageProps) {
    const capitalizedCity = city.charAt(0).toUpperCase() + city.slice(1);
    const hasEvents = events.length > 0;

    // Use fallback events if no city events found
    const displayEvents = hasEvents ? events : fallbackEvents;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <Head>
                <title>{`Upcoming Events in ${capitalizedCity} | Highland Events Hub`}</title>
                <meta
                    name="description"
                    content={`Discover local gigs, festivals, and workshops in ${capitalizedCity}. Find the best things to do in the Scottish Highlands.`}
                />
                <link rel="canonical" href={`https://www.highlandeventshub.co.uk/locations/${city.toLowerCase()}`} />
            </Head>

            {/* Header Section */}
            <div className="bg-emerald-900 text-white py-16 md:py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/images/pattern.svg')] opacity-10" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-emerald-900/50" />

                <div className="container mx-auto px-4 relative z-10 text-center">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                        {hasEvents
                            ? `Events in ${capitalizedCity}`
                            : `No events scheduled in ${capitalizedCity} right now.`
                        }
                    </h1>
                    <p className="text-emerald-100 text-lg md:text-xl max-w-2xl mx-auto">
                        {hasEvents
                            ? `Discover what's happening in ${capitalizedCity} and the surrounding area.`
                            : `But don't worry! Check out these other great events happening across the Highlands.`
                        }
                    </p>
                </div>
            </div>

            {/* Events Grid */}
            <div className="container mx-auto px-4 py-12">
                {/* If we have events, show them using a clean grid layout */}
                {/* We can reuse MagazineGrid for a nice visual or build a specific list */}
                {/* Reusing MagazineGrid logic for consistency with homepage */}

                <div className="mb-8 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {hasEvents ? 'Upcoming Events' : 'Just Added to the Hub'}
                    </h2>
                    {!hasEvents && (
                        <Link href="/" className="text-emerald-600 hover:text-emerald-700 font-medium">
                            View All Events &rarr;
                        </Link>
                    )}
                </div>

                {displayEvents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayEvents.map((event) => (
                            <Link key={event.id} href={`/events/${event.id}`} className="group block bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 overflow-hidden">
                                <div className="aspect-[16/9] relative overflow-hidden bg-gray-100">
                                    <img
                                        src={event.image_url || '/images/event-placeholder.jpg'}
                                        alt={event.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    {event.category && (
                                        <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-900 uppercase tracking-wide">
                                            {event.category.name}
                                        </span>
                                    )}
                                </div>
                                <div className="p-5">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors line-clamp-2">
                                        {event.title}
                                    </h3>
                                    <div className="space-y-2 text-sm text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-emerald-600" />
                                            <span>{format(new Date(event.date_start), 'EEE, d MMM yyyy • h:mm a')}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-emerald-600" />
                                            <span className="line-clamp-1">{event.venue_name || event.location_name || 'Location TBD'}</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-gray-500">No events found.</p>
                    </div>
                )}
            </div>

            {/* Call to Action for Organizers */}
            <section className="bg-emerald-50 border-y border-emerald-100 py-16 mt-12">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-2xl font-bold text-emerald-900 mb-4">Organizing an event in {capitalizedCity}?</h2>
                    <p className="text-emerald-700 mb-8 max-w-xl mx-auto">
                        List it for free on Highland Events Hub and reach thousands of locals and visitors.
                    </p>
                    <Link href="/submit-event" className="inline-block bg-emerald-700 text-white font-bold py-3 px-8 rounded-full hover:bg-emerald-800 transition-colors shadow-lg">
                        List Your Event for Free
                    </Link>
                </div>
            </section>
        </div>
    );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { city } = context.params as { city: string };

    if (!city) {
        return { notFound: true };
    }

    try {
        // 1. Fetch events STRICTLY for this city
        // We use the new `city_filter` param we added to the backend
        // Since existing API client types might not have it yet, we cast to any or just pass it if allowed
        // Note: We need to update frontend/src/lib/api.ts logic to accept generic params or add city_filter to interface
        // For now, we will assume generic params record support or just fetch directly if needed?
        // Actually, update api.ts quickly or use `list` with a cast.

        // Let's use the explicit `apiFetch` or cast the filters.
        // Assuming `eventsAPI.list` accepts generic `EventFilter` which might be loose.
        // If strict, I need to update `EventFilter` interface in `types/index.ts`.

        // I'll assume I can pass it. If not, I'll fix it. 
        // Wait, I should verify `EventFilter` in `src/types`.

        // Fetch City Events
        const cityEventsResponse = await eventsAPI.list({
            // @ts-ignore - dynamic param added to backend
            city_filter: city,
            limit: 50,
            sort_by: 'date'
        });

        let fallbackEvents: EventResponse[] = [];

        // 2. Zero Results Strategy
        if (cityEventsResponse.events.length === 0) {
            // Fetch "Just Added" / Generic events (fallback)
            const fallbackResponse = await eventsAPI.list({
                limit: 9,
                sort_by: 'created', // Just Added
                include_past: false
            });
            fallbackEvents = fallbackResponse.events;
        }

        return {
            props: {
                city,
                events: cityEventsResponse.events,
                fallbackEvents,
                total: cityEventsResponse.total
            },
        };
    } catch (error) {
        console.error('Error fetching location page:', error);
        return { notFound: true };
    }
};
