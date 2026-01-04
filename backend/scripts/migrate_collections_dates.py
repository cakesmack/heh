from sqlmodel import Session, text
from app.core.database import engine

def migrate():
    print("Migrating collections table...")
    with Session(engine) as session:
        # Check if column exists first to avoid errors
        try:
            session.exec(text("ALTER TABLE collections ADD COLUMN fixed_start_date DATE"))
            print("Added fixed_start_date column.")
        except Exception as e:
            print(f"fixed_start_date might already exist: {e}")
            session.rollback()

        try:
            session.exec(text("ALTER TABLE collections ADD COLUMN fixed_end_date DATE"))
            print("Added fixed_end_date column.")
        except Exception as e:
            print(f"fixed_end_date might already exist: {e}")
            session.rollback()
        
        session.commit()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
