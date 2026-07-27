import { GetServerSideProps } from 'next';
import { collectionsAPI, eventsAPI, locationsAPI } from '@/lib/api';

/**
 * Dynamic XML Sitemap Generator for Next.js (Pages Router)
 * Generates a valid sitemap.xml on the fly with static and dynamic routes.
 */

const EXTERNAL_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.highlandeventshub.co.uk';

function generateSiteMap(collections: any[], events: any[], locations: any[]) {
    return `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <!-- Static URLs -->
     <url>
       <loc>${EXTERNAL_URL}</loc>
       <changefreq>daily</changefreq>
       <priority>1.0</priority>
     </url>
     <url>
       <loc>${EXTERNAL_URL}/map</loc>
       <changefreq>daily</changefreq>
       <priority>0.9</priority>
     </url>

     <!-- Location Hub URLs (Base, /today, /this-weekend for DB Geographic Hubs) -->
     ${locations
            .map((loc) => {
                return `
       <url>
           <loc>${`${EXTERNAL_URL}/locations/${loc.slug}`}</loc>
           <changefreq>daily</changefreq>
           <priority>0.9</priority>
       </url>
       <url>
           <loc>${`${EXTERNAL_URL}/locations/${loc.slug}/today`}</loc>
           <changefreq>daily</changefreq>
           <priority>0.8</priority>
       </url>
       <url>
           <loc>${`${EXTERNAL_URL}/locations/${loc.slug}/this-weekend`}</loc>
           <changefreq>daily</changefreq>
           <priority>0.8</priority>
       </url>
     `;
            })
            .join('')}

     <!-- Dynamic Collection URLs -->
     ${collections
            .map((collection) => {
                return `
       <url>
           <loc>${`${EXTERNAL_URL}/collections/${collection.slug}`}</loc>
           <changefreq>weekly</changefreq>
           <priority>0.8</priority>
       </url>
     `;
            })
            .join('')}

     <!-- Dynamic Event URLs -->
     ${events
            .map((event) => {
                return `
       <url>
           <loc>${`${EXTERNAL_URL}/events/${event.slug || event.id}`}</loc>
           <changefreq>daily</changefreq>
           <priority>0.7</priority>
       </url>
     `;
            })
            .join('')}
   </urlset>
 `;
}

function SiteMap() {
    // getServerSideProps will handle the response directly.
    return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
    try {
        // Fetch data for dynamic routes
        const [collections, eventsResponse, locations] = await Promise.all([
            collectionsAPI.list().catch(() => []),
            eventsAPI.list({ limit: 1000, include_past: false }).catch(() => ({ events: [] })),
            locationsAPI.list().catch(() => []),
        ]);

        const events = eventsResponse.events || [];

        // Generate the XML sitemap with the data
        const sitemap = generateSiteMap(collections, events, locations);

        res.setHeader('Content-Type', 'text/xml');
        res.write(sitemap);
        res.end();
    } catch (error) {
        console.error('Error generating sitemap:', error);
        res.statusCode = 500;
        res.write('Error generating sitemap');
        res.end();
    }

    return {
        props: {},
    };
};

export default SiteMap;
