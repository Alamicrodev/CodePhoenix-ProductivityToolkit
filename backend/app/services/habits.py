from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.habit import Habit, HabitOccurrence
from app.schemas.habits import HabitCreate, HabitUpdate


def list_habits(db: Session, user_id: str) -> list[Habit]:
    stmt = select(Habit).where(Habit.user_id == user_id).options(selectinload(Habit.occurrences)).order_by(Habit.created_at.desc())
    return list(db.scalars(stmt).unique())


def get_habit_or_404(db: Session, user_id: str, habit_id: str) -> Habit:
    stmt = select(Habit).where(Habit.id == habit_id, Habit.user_id == user_id).options(selectinload(Habit.occurrences))
    habit = db.scalar(stmt)
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")
    return habit


def create_habit(db: Session, user_id: str, payload: HabitCreate) -> Habit:
    active_hours = payload.active_hours
    habit = Habit(
        user_id=user_id,
        title=payload.title,
        description=payload.description,
        frequency=payload.frequency,
        hourly_interval=payload.hourly_interval,
        active_hours_start=active_hours.start if active_hours else None,
        active_hours_end=active_hours.end if active_hours else None,
        active_days=payload.active_days,
        streak=payload.streak,
        last_completed=payload.last_completed,
        completed_dates=payload.completed_dates,
        occurrences=[HabitOccurrence(timestamp=item.timestamp, status=item.status) for item in payload.occurrences],
    )
    db.add(habit)
    db.commit()
    return get_habit_or_404(db, user_id, habit.id)


def update_habit(db: Session, habit: Habit, payload: HabitUpdate) -> Habit:
    update_data = payload.model_dump(exclude_unset=True, exclude={"active_hours", "occurrences"})
    for field, value in update_data.items():
        setattr(habit, field, value)

    if payload.active_hours is not None:
        habit.active_hours_start = payload.active_hours.start
        habit.active_hours_end = payload.active_hours.end

    if payload.occurrences is not None:
        habit.occurrences = [HabitOccurrence(timestamp=item.timestamp, status=item.status) for item in payload.occurrences]

    db.add(habit)
    db.commit()
    return get_habit_or_404(db, habit.user_id, habit.id)


def complete_habit(db: Session, habit: Habit, timestamp: datetime | None = None) -> Habit:
    completion_time = timestamp or datetime.now(timezone.utc)
    today = completion_time.date().isoformat()
    completion_marker = completion_time.isoformat() if habit.frequency == "hourly" else today

    if completion_marker not in habit.completed_dates:
        habit.completed_dates = [*habit.completed_dates, completion_marker]
        habit.last_completed = today
        habit.streak += 1
        habit.occurrences.append(HabitOccurrence(timestamp=completion_time, status="completed"))

    db.add(habit)
    db.commit()
    return get_habit_or_404(db, habit.user_id, habit.id)


def undo_habit_completion(db: Session, habit: Habit, completion_timestamp: str) -> Habit:
    habit.completed_dates = [item for item in habit.completed_dates if item != completion_timestamp]
    if habit.streak > 0:
        habit.streak -= 1

    habit.occurrences = [
        occ for occ in habit.occurrences
        if not (
            occ.status == "completed"
            and (occ.timestamp.isoformat() == completion_timestamp or occ.timestamp.date().isoformat() == completion_timestamp)
        )
    ]
    habit.last_completed = habit.completed_dates[-1][:10] if habit.completed_dates else None

    db.add(habit)
    db.commit()
    return get_habit_or_404(db, habit.user_id, habit.id)


def delete_habit(db: Session, habit: Habit) -> None:
    db.delete(habit)
    db.commit()
