from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ScheduleItemType = Literal["planning", "task", "habit", "review", "break"]
ScheduleItemSourceType = Literal["task", "habit", "system"]
Priority = Literal["low", "medium", "high"]


class AiSchedulerRequest(BaseModel):
    current_time: datetime | None = None
    time_zone: str | None = None


class AiSchedulerItem(BaseModel):
    time: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=255)
    type: ScheduleItemType
    priority: Priority = "medium"
    duration: str = Field(min_length=1)
    detail: str | None = None
    source_id: str | None = None
    source_type: ScheduleItemSourceType | None = None


class AiSchedulerResponse(BaseModel):
    generated_at: datetime
    model: str | None = None
    fallback_used: bool = False
    items: list[AiSchedulerItem] = Field(default_factory=list)
    summary: str | None = None
