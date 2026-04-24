from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Frequency = Literal["hourly", "daily", "weekly"]
OccurrenceStatus = Literal["completed", "skipped", "missed"]


class HabitActiveHours(BaseModel):
    start: str
    end: str


class HabitOccurrenceBase(BaseModel):
    timestamp: datetime
    status: OccurrenceStatus


class HabitOccurrenceCreate(HabitOccurrenceBase):
    pass


class HabitOccurrenceResponse(HabitOccurrenceBase):
    id: str

    model_config = {"from_attributes": True}


class HabitBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    frequency: Frequency
    hourly_interval: int | None = Field(default=None, ge=1)
    active_hours: HabitActiveHours | None = None
    active_days: list[int] = Field(default_factory=list)
    streak: int = 0
    last_completed: str | None = None
    completed_dates: list[str] = Field(default_factory=list)


class HabitCreate(HabitBase):
    occurrences: list[HabitOccurrenceCreate] = Field(default_factory=list)


class HabitUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    frequency: Frequency | None = None
    hourly_interval: int | None = Field(default=None, ge=1)
    active_hours: HabitActiveHours | None = None
    active_days: list[int] | None = None
    streak: int | None = Field(default=None, ge=0)
    last_completed: str | None = None
    completed_dates: list[str] | None = None
    occurrences: list[HabitOccurrenceCreate] | None = None


class HabitCompletionRequest(BaseModel):
    timestamp: datetime | None = None


class HabitUndoCompletionRequest(BaseModel):
    completion_timestamp: str


class HabitResponse(HabitBase):
    id: str
    created_at: datetime
    updated_at: datetime
    occurrences: list[HabitOccurrenceResponse]

    model_config = {"from_attributes": True}
