from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Priority = Literal["low", "medium", "high"]
Quadrant = Literal[
    "urgent-important",
    "not-urgent-important",
    "urgent-not-important",
    "not-urgent-not-important",
]


class SubtaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    completed: bool = False
    priority: Priority = "medium"
    due_date: str | None = None
    due_time: str | None = None


class SubtaskCreate(SubtaskBase):
    pass


class SubtaskResponse(SubtaskBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    completed: bool = False
    completed_at: datetime | None = None
    priority: Priority = "medium"
    due_date: str | None = None
    due_time: str | None = None
    tags: list[str] = Field(default_factory=list)
    quadrant: Quadrant | None = None


class TaskCreate(TaskBase):
    subtasks: list[SubtaskCreate] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    completed: bool | None = None
    completed_at: datetime | None = None
    priority: Priority | None = None
    due_date: str | None = None
    due_time: str | None = None
    tags: list[str] | None = None
    quadrant: Quadrant | None = None
    subtasks: list[SubtaskCreate] | None = None


class TaskResponse(TaskBase):
    id: str
    created_at: datetime
    updated_at: datetime
    subtasks: list[SubtaskResponse]

    model_config = {"from_attributes": True}
