from pydantic import BaseModel


class DashboardResponse(BaseModel):
    total_tasks: int
    completed_tasks: int
    total_habits: int
    active_focus_sessions: int
