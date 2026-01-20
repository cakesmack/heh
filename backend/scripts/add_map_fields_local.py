
import sqlite3
import os

DB_FILE = "../highland_events.db"

def run_migration():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found!")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    columns = [
        ("map_display_lat", "FLOAT"),
        ("map_display_lng", "FLOAT"),
        ("map_display_label", "VARCHAR(255)")
    ]

    for col_name, col_type in columns:
        try:
            print(f"Adding column {col_name}...")
            cursor.execute(f"ALTER TABLE events ADD COLUMN {col_name} {col_type}")
            print("Success.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Column {col_name} already exists.")
            else:
                print(f"Error adding {col_name}: {e}")
    
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    run_migration()
