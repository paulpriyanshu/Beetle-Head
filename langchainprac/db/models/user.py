from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base
from typing import List, Optional

class User(Base):
     __tablename__ = "users"

     id: Mapped[int] = mapped_column(primary_key=True, nullable=False)
     name: Mapped[str] = mapped_column(String(100), nullable=False)
     email: Mapped[str] = mapped_column(String(100), nullable=False, index=True, unique=True)
     user_dp: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
     credits: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
     
     # Relationships
     conversations: Mapped[List["Conversation"]] = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
     notes: Mapped[List["Note"]] = relationship("Note", back_populates="user", cascade="all, delete-orphan")
     manifests: Mapped[List["AgentManifest"]] = relationship("AgentManifest", back_populates="user", cascade="all, delete-orphan")
     media: Mapped[List["Media"]] = relationship("Media", back_populates="user", cascade="all, delete-orphan")


     

