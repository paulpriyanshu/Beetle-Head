
import asyncio
from db.database import SessionLocal
from db.models.conversation import Conversation
from db.models.message import Message
from db.models.user import User
from db.models.note import Note
from db.models.media import Media
from db.models.agent import AgentManifest
from db.models.vector_query import QueryHistory
import sys
import os

# Add the current directory to path so we can import modules
sys.path.append(os.getcwd())

async def verify_chat_saving():
    db = SessionLocal()
    try:
        # 1. Find a test conversation
        conversation = db.query(Conversation).first()
        if not conversation:
            print("❌ No conversations found in DB to test with.")
            return

        conv_id = conversation.id
        print(f"🔍 Testing with Conversation ID: {conv_id}")

        # 2. Mock save_message_and_summary call
        # We'll import it from main
        from main import save_message_and_summary
        
        test_query = f"Test Query {os.urandom(4).hex()}"
        test_response = "Test AI Response"
        
        print(f"💾 Saving test message: {test_query}")
        await save_message_and_summary(conv_id, test_query, test_response)
        
        # 3. Verify in DB
        # Re-fetch session to be sure
        db.close()
        db = SessionLocal()
        
        saved_msg = db.query(Message).filter(
            Message.conversation_id == conv_id,
            Message.user_query == test_query
        ).first()
        
        if saved_msg:
            print(f"✅ Success! Message saved to Message table with ID: {saved_msg.id}")
            print(f"   Content: {saved_msg.user_query}")
        else:
            print("❌ Failure: Message not found in Message table.")

    except Exception as e:
        print(f"❌ Error during verification: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(verify_chat_saving())
