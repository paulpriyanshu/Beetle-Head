from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, String, Text, Integer, JSON, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

class Media(Base):
    __tablename__ = "media"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    # File information
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'image', 'pdf', 'docx', etc.
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # 'uploaded', 'circle_search', 'snapshot', 'generated'
    file_url: Mapped[str] = mapped_column(Text, nullable=False)  # Cloudflare R2 URL
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text)  # Optional thumbnail
    
    # Metadata
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    file_metadata: Mapped[Optional[dict]] = mapped_column(JSON)  # Dimensions, page count, etc.
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="media")
