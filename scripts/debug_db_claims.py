import sqlite3
import os
from datetime import datetime

db_path = "backend/highland_events.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print(f"--- Venue Claims Check ({datetime.now()}) ---")

# Count total
cursor.execute("SELECT count(*) FROM venue_claims")
total = cursor.fetchone()[0]
print(f"Total Claims: {total}")

# List 2026 claims
print("\n--- Claims from 2026 ---")
cursor.execute("SELECT id, venue_id, user_id, status, created_at FROM venue_claims WHERE created_at > '2026-01-01' ORDER BY created_at DESC")
claims = cursor.fetchall()
if not claims:
    print("NO CLAIMS FOUND FROM 2026.")
else:
    for c in claims:
        print(f"ID: {c[0]} | Venue: {c[1]} | User: {c[2]} | Status: {c[3]} | Created: {c[4]}")

conn.close()
