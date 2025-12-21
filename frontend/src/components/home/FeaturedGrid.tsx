import Link from 'next/link';
import { EventResponse } from '@/types';
import { EventCard } from '@/components/events/EventCard';
import { Button } from '@/components/common/Button';

interface FeaturedGridProps {
    events: EventResponse[];
    title?: string;
    subtitle?: string;
}

export default function FeaturedGrid({ events, title = "Trending Now", subtitle = "Don't miss out on these popular events" }: FeaturedGridProps) {
    if (!events || events.length === 0) return null;

    return (
        <section className="py-16 md:py-24 bg-warm-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold text-stone-dark tracking-tight">{title}</h2>
                        <p className="text-lg text-stone-medium mt-2 font-light">{subtitle}</p>
                    </div>
                    <Link href="/events">
                        <span className="text-highland-green hover:text-moss-green font-medium flex items-center gap-1 group">
                            View all events
                            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </span>
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {events.map((event) => (
                        <div key={event.id} className="hover-card">
                            <EventCard event={event} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
