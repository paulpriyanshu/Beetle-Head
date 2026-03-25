import os
import hashlib
from typing import Optional
from langchain_openai import OpenAIEmbeddings
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from db.database import SessionLocal
from db.models.vector_rag import PageChunk
from db.models.chatContext import ChatContext
from sqlalchemy import select
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()


class VectorStoreService:

    VECTOR_DIM = 1536

    def __init__(self):
        openai_key = os.getenv("OPENAI_API_KEY")

        if openai_key:
            self.openai_embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=openai_key
            )
        else:
            self.openai_embeddings = None

        self.ollama_embeddings = OllamaEmbeddings(model="nomic-embed-text")

        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=100,
            separators=["\n\n", "\n", " ", ""]
        )

        pincone_api_key = os.getenv("PINECONE_API_KEY")
        self.index_name = os.getenv("PINECONE_INDEX_NAME")
        if pincone_api_key and self.index_name:
            self.pc = Pinecone(api_key=pincone_api_key)
            self.index = self.pc.Index(self.index_name)
        else:
            self.pc = None
            self.index = None

    # --------------------------------------------------------
    # Ensure vectors match pgvector dimension (1536)
    # --------------------------------------------------------
    def _ensure_1536_dimensions(self, vector: list[float]) -> list[float]:

        if len(vector) < self.VECTOR_DIM:
            return vector + [0.0] * (self.VECTOR_DIM - len(vector))

        if len(vector) > self.VECTOR_DIM:
            return vector[:self.VECTOR_DIM]

        return vector

    # --------------------------------------------------------
    # Batch embed documents
    # --------------------------------------------------------
    async def _embed_documents_with_fallback(self, texts: list[str]) -> list[list[float]]:

        if self.openai_embeddings:
            try:
                return await self.openai_embeddings.aembed_documents(texts)
            except Exception as e:
                print(f"⚠️ OpenAI batch embedding failed: {e}")

        try:
            print("🔄 Using Ollama for batch embeddings...")
            embeddings = await self.ollama_embeddings.aembed_documents(texts)
            return [self._ensure_1536_dimensions(v) for v in embeddings]

        except Exception as ollama_err:
            print(f"❌ Ollama batch embedding failed: {ollama_err}")
            return [[0.0] * self.VECTOR_DIM for _ in texts]

    # --------------------------------------------------------
    # Query embedding
    # --------------------------------------------------------
    async def _embed_query_with_fallback(self, query: str) -> list[float]:

        if self.openai_embeddings:
            try:
                vec = await self.openai_embeddings.aembed_query(query)
                return self._ensure_1536_dimensions(vec)

            except Exception as e:
                print(f"⚠️ OpenAI query embedding failed: {e}")

        try:
            print("🔄 Using Ollama for query embedding...")
            vec = await self.ollama_embeddings.aembed_query(query)
            return self._ensure_1536_dimensions(vec)

        except Exception as ollama_err:
            print(f"❌ Ollama query embedding failed: {ollama_err}")
            return [0.0] * self.VECTOR_DIM

    def get_query_embedding_sync(self, q):
        """Synchronous version for internal thread usage"""
        if self.openai_embeddings:
            try:
                vec = self.openai_embeddings.embed_query(q)
                return self._ensure_1536_dimensions(vec)
            except Exception as e:
                print(f"⚠️ OpenAI sync query embedding failed: {e}")

        try:
            print("🔄 Using Ollama for sync query embedding...")
            vec = self.ollama_embeddings.embed_query(q)
            return self._ensure_1536_dimensions(vec)
        except Exception as ollama_err:
            print(f"❌ Ollama sync query embedding failed: {ollama_err}")
            return [0.0] * self.VECTOR_DIM

    # --------------------------------------------------------
    # Context existence check
    # --------------------------------------------------------
    def has_context(self, user_id: str, url: str, conversation_id: int) -> bool:

        db: Session = SessionLocal()

        try:
            exists = db.query(PageChunk).join(
                ChatContext,
                PageChunk.id == ChatContext.chunk_id
            ).filter(
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
    async def process_and_save_context(
            self,
            user_id: str,
            conversation_id: int,
            url: str,
            content: Optional[str] = None,
            raw_html: Optional[dict] = None
        ) -> int:

        # If background task was fired without pre-extracted content, extract it now
        if not content and raw_html:
            from utils.text_processing import extract_clean_text_from_dom
            content = raw_html.get("textContent") or raw_html.get("content")
            dom_tree = raw_html.get("domTree", raw_html) 
            
            if not content:
                content = extract_clean_text_from_dom(dom_tree)

        if not content:
            return 0

        chunks = self.text_splitter.split_text(content)

        if not chunks:
            return 0

        # Page chunks are now saved EXCLUSIVELY to Pinecone for speed and scale.
        # SQL storage (pgvector) is bypassed for these context fragments.
        saved_count = 0

        try:
            chunk_hashes = [hashlib.md5(c.encode()).hexdigest() for c in chunks]

            if self.index:
                texts_to_embed = chunks
                embeddings = await self._embed_documents_with_fallback(texts_to_embed)

                vectors_to_upsert = []
                for i, text in enumerate(chunks):
                    content_hash = chunk_hashes[i]
                    # We use URL + Hash as a stable ID for Pinecone to prevent duplicates
                    pinecone_id = f"{hashlib.md5(url.encode()).hexdigest()}_{content_hash}"
                    
                    vectors_to_upsert.append({
                        "id": pinecone_id,
                        "values": self._ensure_1536_dimensions(embeddings[i]),
                        "metadata": {
                            "user_id": str(user_id),
                            "url": url,
                            "content": text,
                            "content_hash": content_hash,
                            "chunk_index": i,
                            "conversation_id": conversation_id or 0 # Store context link in Pinecone
                        }
                    })

                try:
                    import asyncio
                    # Run the sync Pinecone upsert in a thread to keep the event loop moving
                    await asyncio.to_thread(self.index.upsert, vectors=vectors_to_upsert)
                    saved_count = len(chunks)
                    print(f"🚀 Successfully upserted {saved_count} chunks to Pinecone for: {url}")
                except Exception as p_err:
                    print(f"⚠️ Pinecone upsert failed: {p_err}")

            return saved_count

        except Exception as e:
            print(f"❌ Error saving vector context: {e}")
            return 0

        except Exception as e:
            print(f"❌ Error saving vector context: {e}")
            return 0

    # --------------------------------------------------------
    # Retrieve relevant chunks
    # --------------------------------------------------------
    async def get_relevant_context(
        self,
        user_id: str,
        query: str,
        conversation_id: Optional[int] = None,
        current_url: Optional[str] = None,
        limit: int = 5
    ) -> str:

        try:
            import asyncio
            query_embedding = await self._embed_query_with_fallback(query)

            # TRY PINECONE
            if self.index:
                try:
                    filter_dict = {"user_id": str(user_id)}
                    
                    # We can filter by URL OR Conversation ID if stored in metadata
                    if conversation_id:
                        filter_dict["conversation_id"] = conversation_id
                    elif current_url:
                        filter_dict["url"] = current_url
                    
                    # Run sync Pinecone query in a thread
                    results = await asyncio.to_thread(
                        self.index.query,
                        vector=query_embedding,
                        top_k=limit,
                        include_metadata=True,
                        filter=filter_dict
                    )
                    
                    if results and results.matches:
                        return "\n\n".join(m.metadata["content"] for m in results.matches if "content" in m.metadata)
                except Exception as p_query_err:
                    print(f"⚠️ Pinecone query failed: {p_query_err}")

            return ""

        except Exception as e:
            print(f"❌ Error retrieving vector context: {e}")
            return ""


vector_store = VectorStoreService()