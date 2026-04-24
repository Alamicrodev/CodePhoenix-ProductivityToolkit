from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Habit(Base):
    __tablename__ = "habits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)
    hourly_interval: Mapped[int | None] = mapped_column(Integer, nullable=True)
    active_hours_start: Mapped[str | None] = mapped_column(String(10), nullable=True)
    active_hours_end: Mapped[str | None] = mapped_column(String(10), nullable=True)
    active_days: Mapped[list[int]] = mapped_column(JSON, default=list, nullable=False)
    streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_completed: Mapped[str | None] = mapped_column(String(40), nullable=True)
    completed_dates: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    owner = relationship("User", back_populates="habits")
    occurrences = relationship("HabitOccurrence", back_populates="habit", cascade="all, delete-orphan")


class HabitOccurrence(Base):
    __tablename__ = "habit_occurrences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    habit_id: Mapped[str] = mapped_column(ForeignKey("habits.id", ondelete="CASCADE"), index=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)

    habit = relationship("Habit", back_populates="occurrences")
