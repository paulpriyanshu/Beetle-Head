from datetime import datetime
from sqlalchemy import DateTime, String, Text, func, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

class AgentManifest(Base):
    __tablename__ = "agent_manifests"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    query: Mapped[str] = mapped_column(Text, nullable=False)
    manifest_data: Mapped[dict] = mapped_column(JSON, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user: Mapped["User"] = relationship("User")
