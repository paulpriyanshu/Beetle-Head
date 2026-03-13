# ============================================================
# vector_store.py
# ============================================================

import os
import hashlib
from typing import Optional
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from db.database import SessionLocal
from db.models.vector_rag import PageChunk
from db.models.chatContext import ChatContext
from sqlalchemy import select
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()


class VectorStoreService:

    def __init__(self):
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=100,
            separators=["\n\n", "\n", " ", ""]
        )

    def has_context(self, user_id: str, url: str, conversation_id: int) -> bool:
        """Quick check if this URL is already embedded and linked to the conversation"""
        db: Session = SessionLocal()
        try:
            exists = db.query(PageChunk).join(ChatContext, PageChunk.id == ChatContext.chunk_id).filter(
                PageChunk.user_id == str(user_id),
                PageChunk.url == url,
                ChatContext.conversation_id == conversation_id
            ).first()
            return exists is not None
        except Exception as e:
            print(f"Error checking context: {e}")
            return False
        finally:
            db.close()

    # --------------------------------------------------------
    # INGEST: Split, embed, save chunks, link to conversation
    # --------------------------------------------------------
    async def process_and_save_context(
        self,
        user_id: str,
        conversation_id: int,
        url: str,
        content: str
    ) -> int:

        if not content:
            return 0

        chunks = self.text_splitter.split_text(content)
        if not chunks:
            return 0

        db: Session = SessionLocal()
        saved_count = 0

        try:
            # 1. Calculate hashes for all chunks
            chunk_hashes = [hashlib.md5(c.encode()).hexdigest() for c in chunks]

            # 2. Bulk SELECT to find existing chunks
            existing_chunks = db.query(PageChunk).filter(
                PageChunk.url == url,
                PageChunk.content_hash.in_(chunk_hashes)
            ).all()
            
            existing_hash_to_id = {c.content_hash: c.id for c in existing_chunks}

            # 3. Separate new chunks from existing ones
            new_chunks_data = [] # Stores (index, text, hash)
            
            # Use a set to track which hashes we already added to new_chunks_data to avoid duplicates in the same payload
            seen_new_hashes = set()
            
            for i, chunk_text in enumerate(chunks):
                content_hash = chunk_hashes[i]
                if content_hash not in existing_hash_to_id and content_hash not in seen_new_hashes:
                    new_chunks_data.append((i, chunk_text, content_hash))
                    seen_new_hashes.add(content_hash)

            # 4. Batch Embeddings for new chunks ONLY
            if new_chunks_data:
                texts_to_embed = [data[1] for data in new_chunks_data]
                # Await the async batch embedding
                embeddings = await self.embeddings.aembed_documents(texts_to_embed)
                
                # 5. Bulk Insert new chunks
                new_chunk_objects = []
                for idx, (original_i, text, c_hash) in enumerate(new_chunks_data):
                    new_chunk = PageChunk(
                        user_id=str(user_id),
                        url=url,
                        chunk_index=original_i,
                        content=text,
                        content_hash=c_hash,
                        embedding=embeddings[idx]
                    )
                    new_chunk_objects.append(new_chunk)
                
                db.add_all(new_chunk_objects)
                db.flush() # Flush to get their IDs
                
                # Update our map with the newly inserted IDs
                for nc in new_chunk_objects:
                    existing_hash_to_id[nc.content_hash] = nc.id

            # At this point, existing_hash_to_id has IDs for ALL chunks (old and newly inserted)
            # 6. Bulk Link to conversation
            if conversation_id:
                # Some chunks might have duplicate hashes within the same document, so we map hash to ID
                chunk_ids_to_link = list({existing_hash_to_id[h] for h in chunk_hashes if h in existing_hash_to_id})
                
                # Bulk SELECT to find existing links
                existing_links = db.query(ChatContext).filter(
                    ChatContext.conversation_id == conversation_id,
                    ChatContext.chunk_id.in_(chunk_ids_to_link)
                ).all()
                existing_linked_ids = {link.chunk_id for link in existing_links}
                
                # Bulk Insert new links
                new_links = []
                for c_id in chunk_ids_to_link:
                    if c_id not in existing_linked_ids:
                        new_links.append(ChatContext(conversation_id=conversation_id, chunk_id=c_id))
                
                if new_links:
                    db.add_all(new_links)
                    saved_count = len(new_links)

            db.commit()  # Single commit after all operations
            return saved_count

        except Exception as e:
            print(f"❌ Error saving vector context: {e}")
            db.rollback()
            return 0

        finally:
            db.close()

    # --------------------------------------------------------
    # RETRIEVE: Get relevant chunks for a query
    # Only called when query is page-related
    # --------------------------------------------------------
    def get_relevant_context(
        self,
        user_id: str,
        query: str,
        conversation_id: Optional[int] = None,
        current_url: Optional[str] = None,
        limit: int = 5
    ) -> str:

        try:
            db: Session = SessionLocal()
            query_embedding = self.embeddings.embed_query(query)

            # Strategy 1: Current URL + conversation scoped (MOST ACCURATE)
            # Only get chunks from the CURRENT tab that belong to this conversation
            if conversation_id and current_url:
                linked_chunk_ids = db.query(ChatContext.chunk_id).filter(
                    ChatContext.conversation_id == conversation_id
                ).subquery()

                chunks = db.query(PageChunk).filter(
                    PageChunk.id.in_(select(linked_chunk_ids)),
                    PageChunk.user_id == str(user_id),
                    PageChunk.url == current_url  # 👈 lock to current tab
                ).order_by(
                    PageChunk.embedding.cosine_distance(query_embedding)
                ).limit(limit).all()

                if chunks:
                    print(f"✅ {len(chunks)} chunks from current tab + conversation")
                    return "\n\n".join(c.content for c in chunks)

            # Strategy 2: Current URL only (no conversation filter)
            if current_url:
                chunks = db.query(PageChunk).filter(
                    PageChunk.user_id == str(user_id),
                    PageChunk.url == current_url
                ).order_by(
                    PageChunk.embedding.cosine_distance(query_embedding)
                ).limit(limit).all()

                if chunks:
                    print(f"✅ {len(chunks)} chunks from current tab URL")
                    return "\n\n".join(c.content for c in chunks)

            print(f"⚠️ No chunks found for current tab")
            return ""

        except Exception as e:
            print(f"❌ Error retrieving vector context: {e}")
            return ""

        finally:
            db.close()

vector_store = VectorStoreService()