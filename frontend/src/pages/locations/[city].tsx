import Head from 'next/head';
import React from 'react';
import Link from 'next/link';
import { eventsAPI } from '@/lib/api';
import { EventResponse } from '@/types';
import { GetServerSideProps } from 'next';
import { LocationFeed } from '@/components/locations/LocationFeed';

interface LocationPageProps {
    city: string;
    events: EventResponse[];
}

// 1. Dynamic SEO & Data Fetching (Server Side)
// 1. Dynamic SEO & Data Fetching (Server Side)
export const getServerSideProps: GetServerSideProps<LocationPageProps> = async (context) => {
    const { city } = context.params as { city: string };

    // Convert "fort-william" -> "fort william"
    const slug = String(city);
    const cityFilter = decodeURIComponent(slug).replace(/-/g, ' ');

    let events: EventResponse[] = [];

    try {
        // Fetch Events using the CLEAN city name
        const res = await eventsAPI.list({
            // @ts-ignore - city_filter is now supported in API client
            city_filter: cityFilter,
            limit: 24, // Optimized initial load
            sort_by: 'date',
            time_range: 'upcoming'
        });
        // Flatten and reduce payload size
        events = res.events.map(event => ({
            ...event,
            description: event.description ? event.description.replace(/<[^>]*>?/gm, '').substring(0, 200) : '',
            participant_venues: undefined,
            organizer_profile: undefined,
            showtimes: event.showtimes ? event.showtimes.slice(0, 3) : undefined
        }));

    } catch (error) {
        console.error('Error fetching location events:', error);
    }

    return {
        props: {
            city: cityFilter, // Pass the CLEAN name to the client
            events,
        }
    };
};

export default function LocationPage({ city, events }: LocationPageProps) {
    // Capitalize Each Word (e.g. Fort William)
    const formattedCity = city.replace(/\b\w/g, c => c.toUpperCase());
    const hasEvents = events.length > 0;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <Head>
                <title>{`Events in ${formattedCity} | Highland Events Hub`}</title>
                <meta
                    name="description"
                    content={`Discover the best local events, gigs, and festivals in ${formattedCity}.`}
                />
            </Head>

            {/* Header Section */}
            <div className="bg-white border-b border-gray-200 py-12">
                <div className="container mx-auto px-4">
                    <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600 mb-4 capitalize">
                        Events in {formattedCity}
                    </h1>
                    <p className="text-gray-600 text-lg">
                        {hasEvents
                            ? `Upcoming events in ${formattedCity}.`
                            : `Checking for events in ${formattedCity}...`
                        }
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                {hasEvents ? (
                    <LocationFeed initialEvents={events} city={city} />
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            No events currently scheduled in {formattedCity}
                        </h2>
                        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                            Check back soon or broaden your search to see what's happening nearby.
                        </p>
                        <Link href="/events" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors">
                            Browse All Events
                        </Link>
                    </div>
                )}
            </div>

            {!hasEvents && (
                <section className="bg-emerald-50 border-y border-emerald-100 py-16 mt-12">
                    <div className="container mx-auto px-4 text-center">
                        <h2 className="text-2xl font-bold text-emerald-900 mb-4">Know of an event in {formattedCity}?</h2>
                        <Link href="/submit-event" className="inline-block bg-emerald-700 text-white font-bold py-3 px-8 rounded-full hover:bg-emerald-800 transition-colors shadow-lg">
                            List it for Free
                        </Link>
                    </div>
                </section>
            )}
        </div>
    );
}
