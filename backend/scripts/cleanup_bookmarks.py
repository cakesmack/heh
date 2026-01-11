import sys
import os

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select, func
from app.core.database import engine
from app.models.bookmark import Bookmark

def cleanup_duplicates():
    with Session(engine) as session:
        print("Starting cleanup of duplicate bookmarks...")
        
        # 1. Find duplicates: user_id, event_id pairs with count > 1
        query = (
            select(Bookmark.user_id, Bookmark.event_id, func.count(Bookmark.id))
            .group_by(Bookmark.user_id, Bookmark.event_id)
            .having(func.count(Bookmark.id) > 1)
        )
        duplicates = session.exec(query).all()
        
        print(f"Found {len(duplicates)} pairs with duplicate entries.")
        
        total_deleted = 0
        
        for user_id, event_id, count in duplicates:
            # 2. For each duplicate pair, get all instances ordered by creation time
            # We will keep the NEWEST one (or oldest, doesn't matter much, but newest implies latest intent)
            instances = session.exec(
                select(Bookmark)
                .where(Bookmark.user_id == user_id)
                .where(Bookmark.event_id == event_id)
                .order_by(Bookmark.created_at.desc())
            ).all()
            
            # Keep the first one (newest), delete the rest
            to_delete = instances[1:] 
            for bookmark in to_delete:
                session.delete(bookmark)
                
            total_deleted += len(to_delete)
            print(f"  - User {user_id}, Event {event_id}: deleted {len(to_delete)} duplicates.")
            
        session.commit()
        print(f"Cleanup complete. Removed {total_deleted} duplicate entries.")

if __name__ == "__main__":
    cleanup_duplicates()
