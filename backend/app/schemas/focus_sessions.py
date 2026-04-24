from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

FocusSessionStatus = Literal["active", "paused", "completed", "quit"]
FocusSessionPhase = Literal["focus", "break"]
FocusSessionItemType = Literal["task", "habit"]
FocusSessionCompletionResult = Literal["successful", "unsuccessful"]


class FocusSessionItemBase(BaseModel):
    source_id: str
    source_type: FocusSessionItemType
    title: str = Field(min_length=1, max_length=255)
    added_at: datetime
    completed_in_session_at: datetime | None = None


class FocusSessionItemCreate(FocusSessionItemBase):
    pass


class FocusSessionItemResponse(FocusSessionItemBase):
    id: str

    model_config = {"from_attributes": True}


class FocusSessionBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    total_duration_minutes: int = Field(ge=1)
    focus_length_minutes: int = Field(ge=1)
    break_length_minutes: int = Field(ge=1)
    elapsed_seconds: int = Field(default=0, ge=0)
    phase_type: FocusSessionPhase = "focus"
    phase_remaining_seconds: int = Field(ge=0)
    status: FocusSessionStatus = "paused"
    completion_result: FocusSessionCompletionResult | None = None
    completed: bool = False
    completed_focus_blocks: int = Field(default=0, ge=0)
    started_at: datetime
    paused_at: datetime | None = None
    ended_at: datetime | None = None


class FocusSessionCreate(FocusSessionBase):
    items: list[FocusSessionItemCreate] = Field(default_factory=list)


class FocusSessionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    elapsed_seconds: int | None = Field(default=None, ge=0)
    phase_type: FocusSessionPhase | None = None
    phase_remaining_seconds: int | None = Field(default=None, ge=0)
    status: FocusSessionStatus | None = None
    completion_result: FocusSessionCompletionResult | None = None
    completed: bool | None = None
    completed_focus_blocks: int | None = Field(default=None, ge=0)
    paused_at: datetime | None = None
    ended_at: datetime | None = None


class FocusSessionActionRequest(BaseModel):
    timestamp: datetime | None = None


class FocusSessionResponse(FocusSessionBase):
    id: str
    created_at: datetime
    updated_at: datetime
    items: list[FocusSessionItemResponse]

    model_config = {"from_attributes": True}
