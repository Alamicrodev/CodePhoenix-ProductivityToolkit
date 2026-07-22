from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CoworkSession(Base):
    """A shareable coworking room.

    Only the room itself is persisted. Who is currently connected lives in
    memory on the server (see app/services/cowork_rooms.py) because presence is
    meaningless once the process restarts, and the webcam streams never touch
    the backend at all — they are peer-to-peer.
    """

    __tablename__ = "cowork_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    # The unguessable part of the share link: /cowork/{slug}
    slug: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    host_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    host = relationship("User", back_populates="cowork_sessions")
