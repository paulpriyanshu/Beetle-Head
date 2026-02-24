from langchain_openai import OpenAIEmbeddings

# Initialize once (global instance)
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small"  # 1536 dimensions
)


async def embed_text(text: str) -> list[float]:
    """
    Async embedding function using LangChain OpenAIEmbeddings
    Compatible with pgvector Vector(1536)
    """

    if not text:
        return [0.0] * 1536

    return await embeddings.aembed_query(text)