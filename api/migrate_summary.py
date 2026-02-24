from sqlalchemy import text
from db.database import engine

def migrate_summary():
    print("🚀 Starting summary migration...")
    with engine.connect() as conn:
        try:
            # Check if column exists
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='conversations' AND column_name='summary'"
            ))
            if result.fetchone():
                print("ℹ️ 'summary' column already exists.")
            else:
                print("➕ Adding 'summary' column to conversations table...")
                conn.execute(text("ALTER TABLE conversations ADD COLUMN summary TEXT"))
                conn.commit()
                print("✅ 'summary' column added successfully!")
        except Exception as e:
            print(f"❌ Error during migration: {e}")
            conn.rollback()

if __name__ == "__main__":
    migrate_summary()
