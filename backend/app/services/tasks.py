from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.task import Subtask, Task
from app.schemas.tasks import TaskCreate, TaskUpdate


def list_tasks(db: Session, user_id: str) -> list[Task]:
    stmt = select(Task).where(Task.user_id == user_id).options(selectinload(Task.subtasks)).order_by(Task.created_at.desc())
    return list(db.scalars(stmt).unique())


def get_task_or_404(db: Session, user_id: str, task_id: str) -> Task:
    stmt = select(Task).where(Task.id == task_id, Task.user_id == user_id).options(selectinload(Task.subtasks))
    task = db.scalar(stmt)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def create_task(db: Session, user_id: str, payload: TaskCreate) -> Task:
    task = Task(
        user_id=user_id,
        title=payload.title,
        description=payload.description,
        completed=payload.completed,
        completed_at=payload.completed_at,
        priority=payload.priority,
        due_date=payload.due_date,
        due_time=payload.due_time,
        tags=payload.tags,
        quadrant=payload.quadrant,
        subtasks=[
            Subtask(
                title=subtask.title,
                completed=subtask.completed,
                priority=subtask.priority,
                due_date=subtask.due_date,
                due_time=subtask.due_time,
            )
            for subtask in payload.subtasks
        ],
    )
    db.add(task)
    db.commit()
    return get_task_or_404(db, user_id, task.id)


def update_task(db: Session, task: Task, payload: TaskUpdate) -> Task:
    update_data = payload.model_dump(exclude_unset=True, exclude={"subtasks"})
    for field, value in update_data.items():
        setattr(task, field, value)

    if payload.subtasks is not None:
        task.subtasks = [
            Subtask(
                title=subtask.title,
                completed=subtask.completed,
                priority=subtask.priority,
                due_date=subtask.due_date,
                due_time=subtask.due_time,
            )
            for subtask in payload.subtasks
        ]

    db.add(task)
    db.commit()
    return get_task_or_404(db, task.user_id, task.id)


def delete_task(db: Session, task: Task) -> None:
    db.delete(task)
    db.commit()
