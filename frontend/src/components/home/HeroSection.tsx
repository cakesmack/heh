import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api'; // Ensure this path matches your project structure

// Simple types based on your setup
interface HeroSlot {
    id: number;
    position: number;
    title?: string;
    subtitle?: string;
    image_url?: string;
    link_url?: string;
    event_id?: number;
}

interface FeaturedEvent {
    id: number;
    title: string;
    image_url: string;
    slug: string; // Assuming you have a slug for linking
    venue?: string;
    start_date?: string;
    // Add other event fields as needed
}

export default function HeroCarousel() {
    const [slides, setSlides] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            // 1. Fetch the Static Welcome Slide (Slot 1)
            let welcomeSlide = null;
            try {
                const slotsData = await api.get<HeroSlot[]>('/api/hero');
                welcomeSlide = slotsData.find((s: HeroSlot) => s.position === 1);
            } catch (err) {
                console.warn("Failed to fetch welcome slide:", err);
            }

            // 2. Fetch the Paid "Hero Carousel" Bookings DIRECTLY
            let paidBookings = [];
            try {
                paidBookings = await api.featured.getActive('hero_home');
            } catch (err) {
                console.warn("Failed to fetch paid bookings:", err);
            }

            // 3. Build the Master List
            const finalSlides = [];

            // Always add Welcome Slide first
            if (welcomeSlide) {
                finalSlides.push({
                    type: 'welcome',
                    id: 'welcome-1',
                    image: welcomeSlide.image_url,
                    title: welcomeSlide.title,
                    subtitle: welcomeSlide.subtitle,
                    link: welcomeSlide.link_url || '/events',
                });
            }

            // Add Paid Events (Map them to the slide format)
            // This ensures Hamza Yassin shows up immediately without "Slot Assignment"
            if (paidBookings && paidBookings.length > 0) {
                const eventSlides = paidBookings.map((booking: any) => {
                    // Handle structure variations (depending on if API returns 'event' object nested)
                    // ActiveFeaturedResponse is flat: { event_title, event_image_url, event_id ... }
                    const evt = booking.event || booking;
                    return {
                        type: 'event',
                        id: evt.id,
                        image: evt.event_image_url || evt.image_url || evt.main_image_url,
                        title: evt.event_title || evt.title,
                        subtitle: evt.custom_subtitle || evt.venue?.name || 'Featured Event',
                        link: `/events/${evt.event_id || evt.slug || evt.id}`,
                        date: evt.start_date
                    };
                });
                finalSlides.push(...eventSlides);
            }

            setSlides(finalSlides);
            setLoading(false);
        }

        fetchData();
    }, []);

    if (loading) return <div className="h-[400px] w-full bg-gray-900 animate-pulse" />;
    if (slides.length === 0) return null;

    return (
        <div className="relative w-full h-[400px] md:h-[500px]">
            <Swiper
                modules={[Navigation, Pagination, Autoplay]}
                navigation
                pagination={{ clickable: true }}
                autoplay={{ delay: 5000 }}
                className="h-full w-full"
            >
                {slides.map((slide) => (
                    <SwiperSlide key={slide.id}>
                        <div className="relative w-full h-full">
                            {/* Background Image */}
                            {slide.image && (
                                <Image
                                    src={slide.image}
                                    alt={slide.title}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            )}

                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                            {/* Text Content */}
                            <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 text-white">
                                <div className="container mx-auto">
                                    {slide.type === 'event' && (
                                        <span className="inline-block px-2 py-1 mb-3 text-xs font-bold uppercase tracking-wider bg-yellow-500 text-black rounded">
                                            Featured Event
                                        </span>
                                    )}
                                    <h2 className="text-3xl md:text-5xl font-bold mb-2">{slide.title}</h2>
                                    <p className="text-lg md:text-xl text-gray-200 mb-6">{slide.subtitle}</p>

                                    <Link
                                        href={slide.link}
                                        className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-full transition-colors"
                                    >
                                        {slide.type === 'welcome' ? 'Find an Event' : 'View Details'}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
}