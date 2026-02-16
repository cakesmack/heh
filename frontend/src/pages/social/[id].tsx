import { useRef, useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { toPng } from 'html-to-image';
import { EventResponse } from '@/types';
import Link from 'next/link';
import { eventsAPI } from '@/lib/api';
import { optimizeImage } from '@/utils/imageOptimizer';

export default function SocialPosterPage() {
    const router = useRouter();
    const { id } = router.query;
    const posterRef = useRef<HTMLDivElement>(null);

    const [event, setEvent] = useState<EventResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [baseUrl, setBaseUrl] = useState('');

    useEffect(() => {
        // Set base URL client-side
        if (typeof window !== 'undefined') {
            setBaseUrl(window.location.origin);
        }
    }, []);

    useEffect(() => {
        if (!router.isReady || !id) return;

        const fetchEvent = async () => {
            setLoading(true);
            try {
                // Use the API client instead of raw fetch
                const eventData = await eventsAPI.get(String(id));
                setEvent(eventData);
            } catch (err) {
                console.error('Error fetching event for social poster:', err);
                setError('Could not load event data.');
            } finally {
                setLoading(false);
            }
        };

        fetchEvent();
    }, [router.isReady, id]);


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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p className="text-xl font-bold">{error || 'Event not found'}</p>
            </div>
        );
    }

    // Format Date Range
    const formatDateRange = (start: string, end: string) => {
        const d1 = new Date(start);
        const d2 = new Date(end);
        // Check if dates are different (ignoring time, or if > 24 hours)
        // Simple check: are they on the same day?
        const isSameDay = d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();

        if (!isSameDay && d2 > d1) {
            const f1 = d1.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const f2 = d2.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            return `${f1} - ${f2}`;
        }
        return d1.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    const venueName = event.venue_name || event.location_name || 'The Highlands';
    const categoryName = event.category?.name || 'Event';

    // Resolve image URL
    // For social poster, we want high quality (hero)
    const rawImageUrl = event.image_url
        ? (event.image_url.startsWith('http') ? event.image_url : `${baseUrl}${event.image_url}`)
        : `${baseUrl}/images/og-default.jpg`;

    const imageUrl = optimizeImage(rawImageUrl, 'hero');

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
                            height: '60%', // Fixed height as requested
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

                        {/* Layer 3: Footer Content - UPDATED LAYOUT */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '35%',
                            background: 'linear-gradient(to top, #000 20%, transparent 100%)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            padding: '40px',
                            zIndex: 20
                        }}>

                            {/* Row 1: Badges */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                                {/* Date Badge - ROUNDED FULL */}
                                <div className="bg-white text-black rounded-full px-4 py-1 font-bold uppercase text-xl">
                                    {formatDateRange(event.date_start, event.date_end)}
                                </div>
                                {/* Category Badge - ROUNDED FULL */}
                                <div
                                    className="text-white rounded-full px-4 py-1 font-bold uppercase text-xl"
                                    style={{ backgroundColor: (event.category as any)?.gradient_color || '#22c55e' }}
                                >
                                    {categoryName}
                                </div>
                            </div>

                            {/* Row 2: Title (Full Width) */}
                            <h1 style={{
                                color: 'white',
                                fontSize: '3rem', // Approx 48px
                                fontWeight: 'bold',
                                lineHeight: '1.1',
                                marginTop: '16px', // mt-4
                                width: '100%',
                            }}>
                                {event.title}
                            </h1>

                            {/* Row 3: Venue */}
                            <div style={{
                                color: '#9ca3af', // text-gray-400
                                fontSize: '1.5rem',
                                marginTop: '8px',
                                fontWeight: '500'
                            }}>
                                {venueName}
                            </div>

                            {/* Row 4: Logo (Bottom Right Anchor) - SIMPLIFIED */}
                            <div style={{
                                position: 'absolute',
                                bottom: '40px',
                                right: '40px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                textAlign: 'right'
                            }}>
                                {/* Removed HIGHLAND EVENTS HUB text, kept only URL */}
                                <p style={{
                                    color: '#22c55e', // Brand Green
                                    fontSize: '18px', // text-lg
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    marginBottom: '0px'
                                }}>
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
