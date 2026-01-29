import { useRef, useCallback } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { toPng } from 'html-to-image';
import { EventResponse } from '@/types';
import { api } from '@/lib/api';

interface SocialPosterPageProps {
    event: EventResponse | null;
    error?: string;
    baseUrl: string;
}

export default function SocialPosterPage({ event, error, baseUrl }: SocialPosterPageProps) {
    const posterRef = useRef<HTMLDivElement>(null);

    const downloadPoster = useCallback(() => {
        if (posterRef.current === null) {
            return;
        }

        toPng(posterRef.current, { cacheBust: true, })
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `event-${event?.id || 'poster'}.png`;
                link.href = dataUrl;
                link.click();
            })
            .catch((err) => {
                console.error('Error generating image', err);
            });
    }, [event?.id]);

    if (error || !event) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <p className="text-xl text-red-600 font-bold">{error || 'Event not found'}</p>
            </div>
        );
    }

    // Format Date: Fri 30 Jan
    const eventDate = new Date(event.date_start);
    const dateStr = eventDate.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });

    const venueName = event.venue_name || event.location_name || 'The Highlands';
    const categoryName = event.category?.name || 'Event';

    // Resolve image URL
    const imageUrl = event.image_url
        ? (event.image_url.startsWith('http') ? event.image_url : `${baseUrl}${event.image_url}`)
        : `${baseUrl}/images/og-default.jpg`;


    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center py-10">
            <Head>
                <title>Poster Generator: {event.title}</title>
                {/* SEO Security: No Index */}
                <meta name="robots" content="noindex" />
            </Head>

            <div className="bg-white p-4 rounded-xl shadow-2xl mb-8">
                <h1 className="text-xl font-bold text-gray-900 mb-2">Social Media Asset Generator</h1>
                <p className="text-sm text-gray-500 mb-4">Generates a 1080x1080 PNG for Instagram/Facebook posts.</p>

                <button
                    onClick={downloadPoster}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PNG
                </button>
            </div>

            {/* 
        THE CANVAS 
        Fixed 1080x1080 container
      */}
            <div
                ref={posterRef}
                className="relative w-[1080px] h-[1080px] bg-black overflow-hidden flex-shrink-0 shadow-2xl"
                style={{ transform: 'scale(0.5)', transformOrigin: 'top center', marginBottom: '-540px' }} // Preview scaled down
            >

                {/* Layer 1: The Backdrop (Blurred) */}
                <div className="absolute inset-0 z-0">
                    <img
                        src={imageUrl}
                        alt="Background"
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover"
                        style={{
                            filter: 'blur(40px) brightness(0.6)',
                            transform: 'scale(1.2)' // Scale up slightly to avoid blur edges
                        }}
                    />
                    {/* Gradient Overlay for Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />
                </div>

                {/* Layer 2: The Main Image (Contained) */}
                <div className="absolute top-0 left-0 right-0 h-[65%] z-10 flex items-center justify-center p-12">
                    <img
                        src={imageUrl}
                        alt="Event Flyer"
                        crossOrigin="anonymous"
                        className="max-h-full max-w-full object-contain rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10"
                    />
                </div>

                {/* Layer 3: The Info Footer */}
                <div className="absolute bottom-0 left-0 right-0 h-[35%] z-20 px-16 pb-16 flex flex-col justify-end">

                    {/* Category / Date Badge Row */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="bg-emerald-500 text-black font-bold px-4 py-2 rounded-full uppercase tracking-wider text-xl shadow-lg">
                            {dateStr}
                        </div>
                        <div className="bg-white/20 backdrop-blur-md text-white font-medium px-4 py-1.5 rounded-full uppercase tracking-wider text-lg border border-white/10">
                            {categoryName}
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-6xl font-black text-white leading-tight mb-4 drop-shadow-lg line-clamp-2">
                        {event.title}
                    </h1>

                    {/* Venue */}
                    <div className="flex items-center text-gray-300 text-3xl font-medium mb-12">
                        <svg className="w-8 h-8 mr-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {venueName}
                    </div>

                    {/* Branding Footer */}
                    <div className="absolute bottom-8 right-8 flex items-center opacity-80">
                        <div className="text-right">
                            <p className="text-emerald-500 font-bold text-xl uppercase tracking-widest">Highland Events Hub</p>
                            <p className="text-gray-400 text-sm">highlandeventshub.co.uk</p>
                        </div>
                    </div>

                </div>

            </div>
            <p className="mt-8 text-gray-500 text-sm">Preview scaled to 50%</p>
        </div>
    );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { id } = context.params as { id: string };
    const protocol = context.req.headers['x-forwarded-proto'] || 'http';
    const host = context.req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    try {
        // Fetch directly from API URL to avoid complex internal logic duplication if possible, 
        // or import the service. For simplicity and reliability in getServerSideProps,
        // we'll fetch from the external API endpoint if available, or duplicate basic fetch logic.
        // Given valid project structure, importing API lib logic is better if running server-side?
        // Actually, api.ts is client-side. We should use standard fetch to the backend.

        // IMPORTANT: This runs on the Next.js server. We need to hit the Backend API.
        // Assuming Backend is running on localhost:8000 or similar internal network.
        // For this environment, let's assume valid access to the public API url or internal.

        // Let's rely on standard fetch to the backend service.
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${backendUrl}/api/v1/events/${id}`);

        if (!res.ok) {
            throw new Error(`Failed to fetch event: ${res.statusText}`);
        }

        const event = await res.json();

        return {
            props: {
                event,
                baseUrl
            },
        };
    } catch (error) {
        console.error('Error fetching event for social poster:', error);
        return {
            props: {
                event: null,
                error: 'Could not load event data.',
                baseUrl
            },
        };
    }
};
