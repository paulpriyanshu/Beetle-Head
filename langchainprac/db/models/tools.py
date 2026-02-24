from datetime import datetime
from sqlalchemy import DateTime, Text, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

class RecordedVideo(Base):
    __tablename__ = "recorded_videos"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    videoOriginalUrl: Mapped[str] = mapped_column(Text, nullable=False)
    video480pUrl: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )
    
    # Relationship
    user: Mapped["User"] = relationship("User")

class ScreenShots(Base):
    __tablename__ = "screenshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    ImageOrignalURL: Mapped[str] = mapped_column(Text, nullable=False)
    Image480pUrl: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )
    
    # Relationship
    user: Mapped["User"] = relationship("User")