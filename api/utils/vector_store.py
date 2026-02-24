import os
from typing import List, Optional
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from db.database import SessionLocal
from db.models.vector_rag import PageChunk
from db.models.chatContext import ChatContext
from sqlalchemy import select, text
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
            chunk_size=500,
            chunk_overlap=100,
            separators=["\n\n", "\n", " ", ""]
        )

    def process_and_save_context(self, user_id: str, conversation_id: int, url: str, content: str):
        """
        Splits content, generates embeddings, saves chunks, and links to conversation.
        """
        if not content:
            return 0

        chunks = self.text_splitter.split_text(content)
        
        db: Session = SessionLocal()
        saved_count = 0
        try:
            for i, chunk_text in enumerate(chunks):
                # 1. Check if chunk matches existing (Simple deduplication by content hash or similar could be better, 
                # but for now we check URL + Index + Content length/start)
                # Actually, simplest is to check if this exact text exists for this URL
                # optimizing: skip if exists
                
                existing_chunk = db.query(PageChunk).filter(
                    PageChunk.url == url,
                    PageChunk.chunk_index == i,
                    PageChunk.content == chunk_text
                ).first()

                if existing_chunk:
                    chunk_id = existing_chunk.id
                else:
                    # Generate embedding
                    embedding = self.embeddings.embed_query(chunk_text)
                    
                    new_chunk = PageChunk(
                        user_id=str(user_id),
                        url=url,
                        chunk_index=i,
                        content=chunk_text,
                        embedding=embedding
                    )
                    db.add(new_chunk)
                    db.commit()
                    db.refresh(new_chunk)
                    chunk_id = new_chunk.id
                
                # 2. Link to Conversation (ChatContext)
                # Check if link exists
                if conversation_id:
                    existing_link = db.query(ChatContext).filter(
                        ChatContext.conversation_id == conversation_id,
                        ChatContext.chunk_id == chunk_id
                    ).first()
                    
                    if not existing_link:
                        new_link = ChatContext(
                            conversation_id=conversation_id,
                            chunk_id=chunk_id
                        )
                        db.add(new_link)
                        saved_count += 1
            
            db.commit()
            return saved_count
            
        except Exception as e:
            print(f"Error saving vector context: {e}")
            db.rollback()
            return 0
        finally:
            db.close()

    def get_relevant_context(
        self,
        user_id: str,
        query: str,
        conversation_id: Optional[int] = None,
        current_url: Optional[str] = None,
        limit: int = 5
    ) -> str:
        """
        Retrieves relevant context chunks for a query.
        
        Priority:
        1. If conversation_id provided: Get chunks linked to this conversation
        2. If current_url provided: Get chunks from this URL
        3. Otherwise: Search across all user's chunks
        """
        try:
            db: Session = SessionLocal()
            query_embedding = self.embeddings.embed_query(query)

            # Strategy 1: Conversation-specific context (BEST for chat continuity)
            if conversation_id:
                # Get chunk IDs linked to this conversation
                linked_chunk_ids = db.query(ChatContext.chunk_id).filter(
                    ChatContext.conversation_id == conversation_id
                ).subquery()
                
                relevant_chunks = db.query(PageChunk).filter(
                    PageChunk.id.in_(select(linked_chunk_ids)),
                    PageChunk.user_id == str(user_id)
                ).order_by(
                    PageChunk.embedding.cosine_distance(query_embedding)
                ).limit(limit).all()
                
                if relevant_chunks:
                    print(f"✅ Retrieved {len(relevant_chunks)} chunks from conversation {conversation_id}")
                    context_text = "\n\n".join(chunk.content for chunk in relevant_chunks)
                    return context_text

            # Strategy 2: URL-specific context (fallback)
            if current_url:
                relevant_chunks = db.query(PageChunk).filter(
                    PageChunk.user_id == str(user_id),
                    PageChunk.url == current_url
                ).order_by(
                    PageChunk.embedding.cosine_distance(query_embedding)
                ).limit(limit).all()
                
                if relevant_chunks:
                    print(f"✅ Retrieved {len(relevant_chunks)} chunks from URL: {current_url}")
                    context_text = "\n\n".join(chunk.content for chunk in relevant_chunks)
                    return context_text
                else:
                    print(f"⚠️ No chunks found for URL: {current_url}")

            # Strategy 3: Global search (last resort)
            relevant_chunks = db.query(PageChunk).filter(
                PageChunk.user_id == str(user_id)
            ).order_by(
                PageChunk.embedding.cosine_distance(query_embedding)
            ).limit(limit).all()
            
            if relevant_chunks:
                print(f"✅ Retrieved {len(relevant_chunks)} chunks from global search")
                context_text = "\n\n".join(chunk.content for chunk in relevant_chunks)
                return context_text
            
            print(f"❌ No chunks found for user {user_id}")
            return ""
            
        except Exception as e:
            print(f"❌ Error retrieving vector context: {e}")
            import traceback
            traceback.print_exc()
            return ""
        finally:
            db.close()
vector_store = VectorStoreService()
