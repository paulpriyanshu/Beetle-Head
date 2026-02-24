from db.database import engine
from db.base import Base
# Import all models to ensure they are registered
from db.models.user import User
from db.models.conversation import Conversation
from db.models.message import Message
from db.models.note import Note
from db.models.agent import AgentManifest
from db.models.media import Media
from sqlalchemy import text

def reset_messages_table():
    print("Resetting messages table...")
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS messages CASCADE"))
        conn.commit()
    
    print("Recreating tables...")
    Base.metadata.create_all(bind=engine)
    print("Done.")

if __name__ == "__main__":
    reset_messages_table()
