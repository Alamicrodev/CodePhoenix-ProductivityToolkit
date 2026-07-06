from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.task import Subtask, Task
from app.schemas.tasks import TaskCreate, TaskUpdate

# Get the list of tasks, primarily by user id
def list_tasks(db: Session, user_id: str) -> list[Task]:
    stmt = select(Task).where(Task.user_id == user_id).options(selectinload(Task.subtasks)).order_by(Task.created_at.desc())  #also selects the subtasks and orders by createdAt
    return list(db.scalars(stmt).unique())  #db.scalars takes query object(stmt) and returns an iterable of task objects, we convert that to a list

# Get a single task (and subtasks)
def get_task_or_404(db: Session, user_id: str, task_id: str) -> Task:
    stmt = select(Task).where(Task.id == task_id, Task.user_id == user_id).options(selectinload(Task.subtasks))
    task = db.scalar(stmt)     #returns a single task object 
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


# Create single Task (with subtasks)
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
            for subtask in payload.subtasks   #do this for every subtask passed in payload 
        ],
    )
    db.add(task)   #add and commit 
    db.commit()
    return get_task_or_404(db, user_id, task.id)


#Update single Task (and subtasks)
def update_task(db: Session, task: Task, payload: TaskUpdate) -> Task:
    update_data = payload.model_dump(exclude_unset=True, exclude={"subtasks"})   
    #payload is a pydantic model object (TaskUpdate)
    #payload.modeldump converts the model object into a dictionary.
    #exclude_unset  removes values user didn't send["None Types"] (we don't want to update them otherwise they might update to None loosing their previous value)
    # also exclude subtasks

    for field, value in update_data.items():
        setattr(task, field, value)           #set attribute one by one in the task object by a loop. (basically updates the task object) 

    if payload.subtasks is not None:          #update subtasks if not none.
        task.subtasks = [                     #frontend sends a new list, with old sub-tasks included.
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



#Delete Task in db 
def delete_task(db: Session, task: Task) -> None:
    db.delete(task)
    db.commit()
