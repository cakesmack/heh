import { useRef, useCallback } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { toPng } from 'html-to-image';
import { EventResponse } from '@/types';
import Link from 'next/link';

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

        // Force exact dimensions to ignore the screen scaling/transform
        toPng(posterRef.current, {
            width: 1080,
            height: 1080,
            pixelRatio: 1,
            // Ensure cross-origin images are handled
            cacheBust: true,
        })
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `event-${event?.id || 'poster'}.png`;
                link.href = dataUrl;
                link.click();
            })
            .catch((err) => {
                console.error('Error generating image', err);
                alert('Error generating image. Check console.');
            });
    }, [event?.id]);

    if (error || !event) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p className="text-xl font-bold">{error || 'Event not found'}</p>
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

    // Resolve image URL
    const imageUrl = event.image_url
        ? (event.image_url.startsWith('http') ? event.image_url : `${baseUrl}${event.image_url}`)
        : `${baseUrl}/images/og-default.jpg`;

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center py-10">
            <Head>
                <title>Poster Generator: {event.title}</title>
                <meta name="robots" content="noindex" />
            </Head>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl shadow-2xl mb-8 w-full max-w-md z-50">
                <h1 className="text-xl font-bold text-gray-900 mb-2">Social Media Asset Generator</h1>
                <p className="text-sm text-gray-500 mb-4">Preview scaled to 50%. Download will be full 1080x1080 HD.</p>

                <button
                    onClick={downloadPoster}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 mb-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PNG
                </button>
                <Link href={`/events/${event.id}`} className="block text-center text-sm text-gray-500 hover:text-gray-900 mt-2">
                    Cancel / Back to Event
                </Link>
            </div>

            {/* 
        PREVIEW CONTAINER 
        Centers the scaled poster
      */}
            <div className="flex items-center justify-center p-10 overflow-hidden w-full h-full">

                {/* 
            THE POSTER (Target Ref) 
            Strict 1080x1080
          */}
                <div
                    ref={posterRef}
                    className="relative bg-black shadow-2xl overflow-hidden flex-shrink-0"
                    style={{
                        width: '1080px',
                        height: '1080px',
                        // This transform is ONLY for the preview on screen
                        transform: 'scale(0.5)',
                        transformOrigin: 'top center',
                        marginBottom: '-540px' // Compensate for scale
                    }}
                >

                    {/* Layer 1: Backdrop (Blurred) */}
                    <div className="absolute inset-0 z-0">
                        <img
                            src={imageUrl}
                            alt="Background"
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover"
                            style={{ filter: 'blur(40px) brightness(0.7)' }}
                        />
                    </div>

                    {/* Layer 2: Hero Image (Big & High) */}
                    <div
                        className="absolute z-10 flex items-center justify-center"
                        style={{
                            top: '45%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '90%',
                            height: '100%',
                            maxHeight: '75%'
                        }}
                    >
                        <img
                            src={imageUrl}
                            alt="Event Flyer"
                            crossOrigin="anonymous"
                            className="w-auto h-auto max-w-full max-h-full object-contain rounded-[20px]"
                            style={{
                                boxShadow: '0 30px 60px rgba(0,0,0,0.6)'
                            }}
                        />
                    </div>

                    {/* Layer 3: Gradient Footer */}
                    <div
                        className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
                        style={{
                            height: '40%',
                            background: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.8) 50%, transparent 100%)'
                        }}
                    />

                    {/* Layer 4: Text Info */}
                    <div className="absolute bottom-[40px] left-[60px] right-[60px] z-30 flex flex-col justify-end text-white">

                        {/* Date & Title */}
                        <div className="mb-4">
                            <p className="text-emerald-400 font-bold text-4xl uppercase tracking-wider mb-2 drop-shadow-md">
                                {dateStr}
                            </p>
                            <h1 className="text-[70px] font-black leading-[1.1] drop-shadow-lg line-clamp-2">
                                {event.title}
                            </h1>
                        </div>

                        {/* Venue */}
                        <div className="flex items-center text-gray-300 text-4xl font-medium mb-8">
                            <svg className="w-8 h-8 mr-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {venueName}
                        </div>

                        {/* Watermark Logo */}
                        <div className="absolute bottom-4 right-0 opacity-60">
                            <div className="text-right">
                                <p className="text-emerald-500 font-bold text-2xl uppercase tracking-[0.2em] leading-none">Highland</p>
                                <p className="text-white font-bold text-2xl uppercase tracking-[0.2em] leading-none">Events Hub</p>
                            </div>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { id } = context.params as { id: string };
    const protocol = context.req.headers['x-forwarded-proto'] || 'http';
    const host = context.req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    try {
        // Use backend API port 8003 as discovered
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8003';
        const res = await fetch(`${backendUrl}/api/events/${id}`);

        if (!res.ok) {
            // Fallback for docker internal or mismatched port scenarios, 
            // though 8003 should work based on previous error fix.
            // If this fails, we return generic error.
            console.error(`Failed to fetch event: ${res.statusText}`);
            throw new Error(`Failed to fetch event: ${res.status}`);
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
                error: 'Could not load event data. Backend may be unreachable.',
                baseUrl
            },
        };
    }
};
