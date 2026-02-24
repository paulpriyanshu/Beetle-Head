import os
import sys
from utils.vector_store import vector_store

# Mocking database interaction would be ideal but since we have a dev DB, let's try a real but isolated test
# if possible. If not, we check imports and split logic.

def test_split_logic():
    print("Testing Text Splitter Config...")
    splitter = vector_store.text_splitter
    assert splitter._chunk_size == 500
    assert splitter._chunk_overlap == 100
    print("✅ Splitter config correct.")
    
    long_text = "word " * 1000
    chunks = splitter.split_text(long_text)
    print(f"✅ Split text into {len(chunks)} chunks.")
    if len(chunks) > 0:
        print(f"Sample chunk size: {len(chunks[0])}")

def main():
    try:
        test_split_logic()
        # process_and_save_context requires DB access.
        # We can try to run it if DB is accessible.
        # print("Testing Vector Save/Retrieve...")
        # vector_store.process_and_save_context("test_user_v1", 123, "http://test.com", "This is a test content for verifying vector store.")
        # res = vector_store.get_relevant_context("test_user_v1", "test content")
        # print(f"Retrieved: {res}")
    except Exception as e:
        print(f"❌ Test Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
