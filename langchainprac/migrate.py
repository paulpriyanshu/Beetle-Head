import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from db.database import engine
from db.base import Base

# Import models
from db.models.user import User
from db.models.conversation import Conversation
from db.models.message import Message
from db.models.note import Note
from db.models.agent import AgentManifest
from db.models.tools import RecordedVideo, ScreenShots
from db.models.vector_rag import PageChunk
from db.models.chatContext import ChatContext


def run_migration():
    print("🚀 Starting database migration...")

    try:
        with engine.connect() as conn:

            # Enable vector_rag extension
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

            # Rename chat_id → conversation_id if exists
            conn.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name='chat_context'
                        AND column_name='chat_id'
                    )
                    THEN
                        ALTER TABLE chat_context
                        RENAME COLUMN chat_id TO conversation_id;
                    END IF;
                END$$;
            """))

            # Convert conversation_id TEXT → BIGINT if needed
            conn.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name='chat_context'
                        AND column_name='conversation_id'
                        AND data_type='text'
                    )
                    THEN
                        ALTER TABLE chat_context
                        ALTER COLUMN conversation_id TYPE BIGINT
                        USING conversation_id::BIGINT;
                    END IF;
                END$$;
            """))

            # Convert chunk_id TEXT → BIGINT if needed
            conn.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name='chat_context'
                        AND column_name='chunk_id'
                        AND data_type='text'
                    )
                    THEN
                        ALTER TABLE chat_context
                        ALTER COLUMN chunk_id TYPE BIGINT
                        USING chunk_id::BIGINT;
                    END IF;
                END$$;
            """))

            conn.commit()

        # Create missing tables
        Base.metadata.create_all(bind=engine)

        print("✅ Tables created and migrated successfully!")

    except Exception as e:
        print(f"❌ Error during migration: {e}")


if __name__ == "__main__":
    run_migration()