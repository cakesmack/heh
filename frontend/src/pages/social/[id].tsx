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

        // Capture specific 1080x1080 size ignoring screen scale
        toPng(posterRef.current, {
            width: 1080,
            height: 1080,
            pixelRatio: 1,
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
    const categoryName = event.category?.name || 'Event';

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
                <h1 className="text-xl font-bold text-gray-900 mb-2">Poster Generator</h1>
                <p className="text-sm text-gray-500 mb-4">Preview scaled to 50%. Download is 1080x1080 grid layout.</p>

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
        PREVIEW WRAPPER
        Centers the poster and scales it down for viewing 
      */}
            <div className="flex items-center justify-center overflow-hidden w-full pb-20">

                {/* Scale Container - Transforms the view but Ref is inside */}
                <div style={{ transform: 'scale(0.5)', transformOrigin: 'top center', marginBottom: '-540px' }}>

                    {/* 
                THE POSTER (Target Ref) 
                Strict 1080x1080
                Flex Column Layout
              */}
                    <div
                        ref={posterRef}
                        style={{
                            width: '1080px',
                            height: '1080px',
                            backgroundColor: '#111',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >

                        {/* 
                   TOP SECTION: IMAGE (75%)
                */}
                        <div style={{ height: '75%', width: '100%', position: 'relative' }}>
                            <img
                                src={imageUrl}
                                alt="Event"
                                crossOrigin="anonymous"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                            {/* Optional subtle gradient at bottom of image to blend */}
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: '150px',
                                background: 'linear-gradient(to bottom, transparent, #1a1a1a)'
                            }} />
                        </div>

                        {/* 
                   BOTTOM SECTION: FOOTER (25%)
                   Gradient Background
                */}
                        <div style={{
                            height: '25%',
                            width: '100%',
                            background: 'linear-gradient(to bottom, #1a1a1a, #000000)',
                            padding: '40px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            position: 'relative'
                        }}>

                            {/* Category Pill */}
                            <div style={{ marginBottom: '16px' }}>
                                <span className="bg-emerald-500 text-black font-bold px-4 py-1 rounded-full uppercase tracking-wider text-xl inline-block">
                                    {categoryName}
                                </span>
                            </div>

                            {/* Title */}
                            <h1 style={{
                                fontSize: '60px',
                                fontWeight: '900',
                                color: 'white',
                                lineHeight: '1.1',
                                marginBottom: '10px',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                            }}>
                                {event.title}
                            </h1>

                            {/* Date & Venue */}
                            <p style={{ fontSize: '30px', color: '#9ca3af', fontWeight: '500' }}>
                                <span className="text-emerald-400 font-bold">{dateStr}</span>
                                <span className="mx-3">•</span>
                                {venueName}
                            </p>

                            {/* Watermark Logo (Bottom Right of Footer) */}
                            <div style={{ position: 'absolute', bottom: '30px', right: '40px', opacity: 0.6, textAlign: 'right' }}>
                                <p className="text-emerald-500 font-bold text-xl uppercase tracking-[0.2em] leading-none">Highland</p>
                                <p className="text-white font-bold text-xl uppercase tracking-[0.2em] leading-none">Events Hub</p>
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
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8003';
        const res = await fetch(`${backendUrl}/api/events/${id}`);

        if (!res.ok) {
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
