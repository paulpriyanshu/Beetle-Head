from sqlalchemy import Column, BigInteger, ForeignKey
from sqlalchemy.orm import relationship
from db.base import Base


class ChatContext(Base):
    __tablename__ = "chat_context"

    id = Column(BigInteger, primary_key=True)

    conversation_id = Column(
        BigInteger,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )

    chunk_id = Column(
        BigInteger,
        ForeignKey("page_chunks.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )

    # Optional relationships
    conversation = relationship("Conversation")
    chunk = relationship("PageChunk")