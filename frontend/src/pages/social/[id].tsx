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

        // Capture specific 1080x1080 size
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
                <h1 className="text-xl font-bold text-gray-900 mb-2">Social Poster</h1>
                <p className="text-sm text-gray-500 mb-4">Preview scaled to 50%. Download is 1080x1080.</p>

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
            <div className="flex items-center justify-center overflow-hidden w-full pb-20">

                <div style={{ transform: 'scale(0.5)', transformOrigin: 'top center', marginBottom: '-540px' }}>

                    {/* 
                THE POSTER (Target Ref) 
                Strict 1080x1080
              */}
                    <div
                        ref={posterRef}
                        style={{
                            width: '1080px',
                            height: '1080px',
                            position: 'relative',
                            overflow: 'hidden',
                            backgroundColor: '#000'
                        }}
                    >

                        {/* Layer 1: Blurred Background */}
                        <img
                            src={imageUrl}
                            alt="Background"
                            crossOrigin="anonymous"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                filter: 'blur(30px) brightness(0.5)'
                            }}
                        />

                        {/* Layer 2: Main Image (Contained) */}
                        <div style={{
                            position: 'absolute',
                            top: '5%',   // Slight top margin
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '90%',
                            height: '60%', // Fixed height to leave room for footer
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 10
                        }}>
                            <img
                                src={imageUrl}
                                alt="Event"
                                crossOrigin="anonymous"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    borderRadius: '8px',
                                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                                }}
                            />
                        </div>

                        {/* Layer 3: Footer Content */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '35%',
                            background: 'linear-gradient(to top, #000 20%, transparent 100%)',
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'space-between',
                            padding: '50px 60px', // Horizontal padding
                            zIndex: 20
                        }}>

                            {/* Left Side: Info */}
                            <div style={{ maxWidth: '65%' }}>
                                <p style={{
                                    color: '#22c55e',
                                    fontSize: '32px',
                                    fontWeight: 'bold',
                                    marginBottom: '10px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    {dateStr}
                                </p>
                                <h1 style={{
                                    color: 'white',
                                    fontSize: '56px',
                                    fontWeight: 'bold',
                                    lineHeight: '1.1',
                                    marginBottom: '16px'
                                }}>
                                    {event.title}
                                </h1>
                                <div style={{ display: 'flex', itemsAlign: 'center', color: '#9ca3af', fontSize: '28px', fontWeight: '500' }}>
                                    <svg style={{ width: '32px', height: '32px', marginRight: '10px', color: '#22c55e' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {venueName}
                                </div>
                            </div>

                            {/* Right Side: Branding */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                textAlign: 'right'
                            }}>
                                <p style={{
                                    color: '#22c55e',
                                    fontSize: '24px',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    marginBottom: '4px'
                                }}>
                                    HIGHLAND EVENTS HUB
                                </p>
                                <p style={{ color: '#d1d5db', fontSize: '16px' }}>
                                    highlandeventshub.co.uk
                                </p>
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
