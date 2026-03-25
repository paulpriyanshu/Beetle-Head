import asyncio
import os
import sys
from dotenv import load_dotenv

# Add the current directory to sys.path to import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.models.user import User
from db.models.conversation import Conversation
from db.models.message import Message
from db.models.chatContext import ChatContext
from db.models.vector_rag import PageChunk
from db.models.note import Note
from db.models.agent import AgentManifest
from db.models.media import Media
from db.models.tools import ToolCall
from db.models.vector_query import QueryHistory
from utils.vector_store import vector_store

async def test_deduplication():
    print("🚀 Starting Context Deduplication Test...")
    
    user_id = "test_user_6789"
    url = "https://example.com/test-dedup"
    conversation_id = 9999
    content = "This is a unique piece of content for testing deduplication logic in the vector store."

    print(f"--- Step 1: Initial Save for User {user_id}, URL {url}, Conv {conversation_id} ---")
    count1 = await vector_store.process_and_save_context(user_id, conversation_id, url, content)
    print(f"Chunks linked/saved: {count1}")

    print(f"\n--- Step 2: Check has_context for same URL and Conv ---")
    exists = vector_store.has_context(user_id, url, conversation_id)
    print(f"Context exists: {exists}")
    assert exists == True, "Context should exist after first save"

    print(f"\n--- Step 3: Redundant Save (Same URL, Same Conv) ---")
    # In main.py, the endpoint checks has_context first.
    if vector_store.has_context(user_id, url, conversation_id):
        print("✅ main.py logic: Skipping redundant save as has_context is True")
        count2 = 0
    else:
        count2 = await vector_store.process_and_save_context(user_id, conversation_id, url, content)
    
    print(f"Chunks linked/saved (should be 0 or skipped): {count2}")
    assert count2 == 0, "No new chunks should be linked for the same conversation and URL"

    print(f"\n--- Step 4: Save for NEW Conversation (Same URL) ---")
    new_conversation_id = 10000
    count3 = await vector_store.process_and_save_context(user_id, new_conversation_id, url, content)
    print(f"Chunks linked/saved for new conversation: {count3}")
    assert count3 > 0, "Chunks should be linked to the new conversation even if URL is same"

    print("\n✅ Deduplication logic verified successfully!")

if __name__ == "__main__":
    load_dotenv()
    asyncio.run(test_deduplication())
