from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, String, Text, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    title: Mapped[Optional[str]] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Type: 'general' or 'video'
    note_type: Mapped[str] = mapped_column(String(20), default="general")
    
    # YouTube specific metadata (optional)
    video_url: Mapped[Optional[str]] = mapped_column(Text)
    video_title: Mapped[Optional[str]] = mapped_column(Text)
    timestamp: Mapped[Optional[str]] = mapped_column(String(50))
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship
    user: Mapped["User"] = relationship("User")
