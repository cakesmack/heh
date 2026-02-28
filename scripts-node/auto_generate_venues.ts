import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("Missing DATABASE_URL in environment");
    process.exit(1);
}

const client = new Client({
    connectionString: DATABASE_URL,
});

function generateSlug(text: string): string {
    // Generate a clean SEO string for the slug
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

async function main() {
    await client.connect();
    console.log("Connected to database...");

    try {
        // 1. Fetch orphaned locations using internal event coordinates
        // Group by location_name to ensure we only create one venue per name
        // Use MAX to pick a single coordinate pair if there are slight variations
        const orphansQuery = `
            SELECT 
                location_name, 
                MAX(latitude) as latitude, 
                MAX(longitude) as longitude
            FROM events
            WHERE venue_id IS NULL 
              AND location_name IS NOT NULL 
              AND latitude IS NOT NULL
            GROUP BY location_name
        `;
        const res = await client.query(orphansQuery);
        const locations = res.rows;

        console.log(`Found ${locations.length} distinct orphaned location names with coordinates.`);

        let successCount = 0;
        let failureCount = 0;

        // 2. Iterate and process
        for (const loc of locations) {
            const { location_name, latitude, longitude } = loc;
            console.log(`\nProcessing: ${location_name}`);

            try {
                // Generate a new UUID without hyphens (SQLite/PostgreSQL compatibility for this codebase)
                const newUuid = uuidv4().replace(/-/g, '');
                const slug = generateSlug(location_name);

                // Using location_name as a fallback address since we don't have Google Maps data
                const addressFallback = location_name;

                // 3. Venue Generation: insert a new record
                const insertVenueQuery = `
                    INSERT INTO venues (
                        id, name, slug, status, address, latitude, longitude, formatted_address, 
                        is_dog_friendly, has_wheelchair_access, has_parking, serves_food, is_dismissed,
                        created_at
                    )
                    VALUES ($1, $2, $3, 'UNVERIFIED', $4, $5, $6, $7, false, false, false, false, false, NOW())
                `;
                await client.query(insertVenueQuery, [
                    newUuid,
                    location_name,
                    slug,
                    addressFallback,
                    latitude,
                    longitude,
                    addressFallback
                ]);

                // 4. Reconnection: SET venue_id = <new_uuid> WHERE location_name = <current_location_name> AND venue_id IS NULL
                const updateEventsQuery = `
                    UPDATE events 
                    SET venue_id = $1 
                    WHERE location_name = $2 AND venue_id IS NULL
                `;
                const updateRes = await client.query(updateEventsQuery, [newUuid, location_name]);

                console.log(`✅ Success: Generated venue ${newUuid} ('${slug}') and linked ${updateRes.rowCount} events.`);
                successCount++;
            } catch (err) {
                console.error(`❌ Error processing ${location_name}:`, err);
                failureCount++;
            }
        }

        console.log(`\n--- Summary ---`);
        console.log(`Successfully generated and linked venues: ${successCount}`);
        console.log(`Failed to process: ${failureCount}`);

    } catch (err) {
        console.error("Script execution failed:", err);
    } finally {
        await client.end();
        console.log("Database connection closed.");
    }
}

main().catch(console.error);
