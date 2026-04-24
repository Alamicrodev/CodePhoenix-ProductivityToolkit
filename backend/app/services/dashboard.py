from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.focus_session import FocusSession
from app.models.habit import Habit
from app.models.task import Task


def get_dashboard_summary(db: Session, user_id: str) -> dict[str, int]:
    total_tasks = db.scalar(select(func.count()).select_from(Task).where(Task.user_id == user_id)) or 0
    completed_tasks = db.scalar(select(func.count()).select_from(Task).where(Task.user_id == user_id, Task.completed.is_(True))) or 0
    total_habits = db.scalar(select(func.count()).select_from(Habit).where(Habit.user_id == user_id)) or 0
    active_focus_sessions = db.scalar(select(func.count()).select_from(FocusSession).where(FocusSession.user_id == user_id, FocusSession.status == "active")) or 0
    return {
        "total_tasks": int(total_tasks),
        "completed_tasks": int(completed_tasks),
        "total_habits": int(total_habits),
        "active_focus_sessions": int(active_focus_sessions),
    }
