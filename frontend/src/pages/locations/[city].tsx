import Head from 'next/head';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { eventsAPI } from '@/lib/api';
import { EventResponse } from '@/types';
import { Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';

export default function LocationPage() {
    const router = useRouter();
    const { city } = router.query;

    const [events, setEvents] = useState<EventResponse[]>([]);
    const [fallbackEvents, setFallbackEvents] = useState<EventResponse[]>([]);
    const [loading, setLoading] = useState(true);

    // Client-side data fetching
    useEffect(() => {
        if (!router.isReady || !city) return;

        const fetchCityEvents = async () => {
            setLoading(true);
            try {
                const cityStr = String(city);
                // Fetch City Events
                const cityEventsResponse = await eventsAPI.list({
                    // @ts-ignore - dynamic param added to backend
                    city_filter: cityStr,
                    limit: 50,
                    sort_by: 'date'
                });

                if (cityEventsResponse.events.length > 0) {
                    setEvents(cityEventsResponse.events);
                } else {
                    // Zero Results Strategy: Fetch "Just Added"
                    const fallbackResponse = await eventsAPI.list({
                        limit: 9,
                        sort_by: 'created', // Just Added
                        include_past: false
                    });
                    setFallbackEvents(fallbackResponse.events);
                }
            } catch (error) {
                console.error('Error fetching location page:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCityEvents();
    }, [router.isReady, city]);

    // Derived state
    const cityName = city ? String(city) : '';
    const capitalizedCity = cityName ? cityName.charAt(0).toUpperCase() + cityName.slice(1) : '...';
    const hasEvents = events.length > 0;

    // Use fallback events if no city events found
    const displayEvents = hasEvents ? events : fallbackEvents;

    // Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <Head>
                <title>{`Upcoming Events in ${capitalizedCity} | Highland Events Hub`}</title>
                <meta
                    name="description"
                    content={`Discover local gigs, festivals, and workshops in ${capitalizedCity}. Find the best things to do in the Scottish Highlands.`}
                />
                <link rel="canonical" href={`https://www.highlandeventshub.co.uk/locations/${cityName.toLowerCase()}`} />
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
                                        loading="lazy"
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
