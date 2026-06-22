import Link from 'next/link';
import OptimizedImage from '@/components/ui/OptimizedImage';
import { EventResponse } from '@/types';

interface PromotedEventsProps {
    events: EventResponse[];
    isLoading: boolean;
}

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function PromotedEvents({ events, isLoading }: PromotedEventsProps) {
    if (isLoading) {
        return (
            <section className="py-12 bg-stone-50 border-b border-stone-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                    <div className="h-4 bg-stone-200 rounded w-24 mb-3 animate-pulse" />
                    <div className="h-8 bg-stone-200 rounded w-64 mb-2 animate-pulse" />
                    <div className="h-4 bg-stone-200 rounded w-96 animate-pulse" />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-stone-200 rounded-2xl aspect-[16/9] animate-pulse" />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (events.length === 0) return null;

    const colsClass = events.length === 1 
        ? 'grid-cols-1' 
        : events.length === 2 
            ? 'grid-cols-1 md:grid-cols-2' 
            : 'grid-cols-1 md:grid-cols-3';

    return (
        <section className="py-12 bg-stone-50 border-b border-stone-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-widest">
                        Promoted
                    </span>
                </div>
                <h2 className="text-3xl font-extrabold text-stone-900 tracking-tight mt-2">
                    Featured Events
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                    Special spotlight events happening across the Highlands
                </p>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className={`grid ${colsClass} gap-6`}>
                    {events.map((event) => (
                        <div key={event.id} className="w-full">
                            <Link 
                                href={`/events/${event.slug || event.id}`} 
                                className="group relative block aspect-[16/9] w-full overflow-hidden rounded-2xl shadow-md border border-stone-200 hover:shadow-lg hover:border-stone-300 transition-all duration-300"
                            >
                                {/* Image */}
                                {event.image_url ? (
                                    <OptimizedImage
                                        src={event.image_url}
                                        variant="card"
                                        alt={event.title}
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 to-teal-950" />
                                )}
                                
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent" />
                                
                                {/* Promoted Badge */}
                                <div className="absolute top-4 left-4 z-20">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400 text-stone-950 uppercase tracking-wider shadow-sm">
                                        ⚡ Promoted
                                    </span>
                                </div>
                                
                                {/* Content Overlay */}
                                <div className="absolute bottom-0 left-0 right-0 p-6 z-20 flex flex-col justify-end text-white">
                                    {/* Category */}
                                    {event.category && (
                                        <span 
                                            className="text-[10px] font-bold uppercase tracking-wider mb-2 self-start px-2 py-0.5 rounded bg-white/10 backdrop-blur-sm"
                                            style={{ color: event.category.gradient_color || '#10b981' }}
                                        >
                                            {event.category.name}
                                        </span>
                                    )}
                                    
                                    {/* Title */}
                                    <h3 className="text-lg sm:text-xl font-bold line-clamp-2 leading-snug group-hover:text-emerald-300 transition-colors duration-200">
                                        {event.title}
                                    </h3>
                                    
                                    {/* Metadata */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-stone-300 font-medium">
                                        <div className="flex items-center gap-1">
                                            <span>📅</span>
                                            <span>{formatDate(event.date_start)} · {formatTime(event.date_start)}</span>
                                        </div>
                                        {event.venue_name && (
                                            <div className="flex items-center gap-1">
                                                <span>📍</span>
                                                <span>{event.venue_name}</span>
                                            </div>
                                        )}
                                        <div className="ml-auto font-bold text-amber-300 text-sm">
                                            {event.price_display || (event.price === 0 ? 'Free' : `£${event.price.toFixed(2)}`)}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
