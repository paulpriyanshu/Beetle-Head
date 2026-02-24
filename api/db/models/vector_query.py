from sqlalchemy import Column, Text, Integer, BigInteger, TIMESTAMP
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import declarative_base

from db.base import Base    

class QueryHistory(Base):
    __tablename__ = "query_history"

    id = Column(BigInteger, primary_key=True)

    user_id = Column(Text, index=True, nullable=False)
    conversation_id = Column(BigInteger, index=True) # Isolate memory by chat
    url = Column(Text)  # optional, useful for page-specific memory

    query = Column(Text, nullable=False)
    query_embedding = Column(Vector(1536), nullable=False)

    response = Column(Text, nullable=False)
    response_embedding = Column(Vector(1536), nullable=False)

    created_at = Column(TIMESTAMP, server_default=func.now())