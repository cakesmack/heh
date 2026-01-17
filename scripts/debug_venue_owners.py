import sqlite3
import os

db_path = "backend/highland_events.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("\n--- Venues & Owners ---")
query = """
SELECT 
    v.name, 
    v.id, 
    v.owner_id, 
    u.email, 
    u.is_admin 
FROM venues v
LEFT JOIN users u ON v.owner_id = u.id
LIMIT 20
"""
cursor.execute(query)
rows = cursor.fetchall()

if not rows:
    print("No venues found.")
else:
    for r in rows:
        name = r[0]
        # Truncate ID for brevity
        vid = r[1][:8] + "..." if r[1] else "None"
        oid = r[2][:8] + "..." if r[2] else "None"
        email = r[3] if r[3] else "No Email"
        is_admin = r[4]
        
        print(f"Venue: {name[:20]:<20} | ID: {vid} | Owner: {oid} | Admin: {is_admin} | Email: {email}")

conn.close()
