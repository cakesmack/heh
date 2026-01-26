import { MetadataRoute } from 'next';
import { eventsAPI, venuesAPI } from '@/lib/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://www.highlandeventshub.co.uk';

    // 1. Static Routes
    const staticRoutes: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${baseUrl}/events`,
            lastModified: new Date(),
            changeFrequency: 'hourly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/venues`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/groups`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/map`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
        },
    ];

    // 2. Dynamic Events
    // Fetch up to 1000 active/upcoming events
    // Note: We might want to filter by status='active' if the API supports it, 
    // but list() default usually returns available events.
    let eventRoutes: MetadataRoute.Sitemap = [];
    try {
        const eventsData = await eventsAPI.list({
            limit: 1000,
            // Optional: time_range: 'all' to include past events if you want them indexed
            // For now, let's stick to default (which likely shows upcoming or all valid)
        });

        eventRoutes = eventsData.events.map((event) => ({
            url: `${baseUrl}/events/${event.id}`,
            lastModified: new Date(event.updated_at || event.created_at),
            changeFrequency: 'daily',
            priority: 0.6,
        }));
    } catch (error) {
        console.error('Failed to generate event sitemap routes:', error);
    }

    // 3. Dynamic Venues
    let venueRoutes: MetadataRoute.Sitemap = [];
    try {
        const venuesData = await venuesAPI.list({ limit: 1000 });

        venueRoutes = venuesData.venues.map((venue) => ({
            url: `${baseUrl}/venues/${venue.id}`,
            lastModified: new Date(venue.updated_at || venue.created_at),
            changeFrequency: 'weekly',
            priority: 0.6,
        }));
    } catch (error) {
        console.error('Failed to generate venue sitemap routes:', error);
    }

    return [...staticRoutes, ...eventRoutes, ...venueRoutes];
}
