import { Client } from "pg";
import Fuse from "fuse.js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables (from backend/.env if it exists, or local env)
dotenv.config({ path: path.resolve(__dirname, "../../backend/.env") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
});

async function runRecovery() {
  await client.connect();
  console.log("Connected to the database.");

  try {
    // 1. Fetch all venues
    console.log("Fetching venues...");
    const venuesResult = await client.query("SELECT id, name FROM venues");
    const venues = venuesResult.rows;
    console.log(`Found ${venues.length} venues.`);

    if (venues.length === 0) {
      console.log("No venues available to match. Exiting.");
      return;
    }

    // Initialize Fuse.js for fuzzy matching
    // Threshold 0.3 means a fairly strong match requirement.
    const fuse = new Fuse(venues, {
      keys: ["name"],
      threshold: 0.3,
      includeScore: true,
    });

    // 2. Fetch all events where venue_id IS NULL but location_name is populated
    console.log("Fetching orphaned events...");
    const eventsResult = await client.query(
      `SELECT id, title, location_name FROM events 
       WHERE venue_id IS NULL AND location_name IS NOT NULL`
    );
    const orphanedEvents = eventsResult.rows;
    console.log(`Found ${orphanedEvents.length} orphaned events to process.`);

    let matchCount = 0;
    const unmatched = [];

    // 3. Process each event
    for (const event of orphanedEvents) {
      // Find the best match
      const results = fuse.search(event.location_name);

      if (results.length > 0) {
        // The first result is the best match
        const bestMatch = results[0];
        
        // Let's enforce a strict enough threshold (score closer to 0 is better in fuse)
        if (bestMatch.score && bestMatch.score <= 0.4) {
          const venueId = bestMatch.item.id;
          const venueName = bestMatch.item.name;

          console.log(`[MATCH] Event: "${event.title}" | Location: "${event.location_name}" --> Venue: "${venueName}"`);

          // Execute UPDATE
          await client.query(
            `UPDATE events SET venue_id = $1 WHERE id = $2`,
            [venueId, event.id]
          );

          matchCount++;
          continue;
        }
      }

      // No confident match
      unmatched.push(event);
    }

    // 4. Report
    console.log("\n--- RECOVERY COMPLETE ---");
    console.log(`Successfully matched and updated ${matchCount} events.`);
    console.log(`Failed to match ${unmatched.length} events.`);

    if (unmatched.length > 0) {
      console.log("\n[UNMATCHED ORPHANS] Please review manually:");
      unmatched.forEach(e => {
        console.log(` - Event: "${e.title}" | location_name: "${e.location_name}"`);
      });
    }

  } catch (error) {
    console.error("An error occurred during recovery:", error);
  } finally {
    await client.end();
  }
}

runRecovery();
