from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.tasks import TaskCreate, TaskResponse, TaskUpdate
from app.services.tasks import create_task, delete_task, get_task_or_404, list_tasks, update_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskResponse])
def get_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list:
    return list_tasks(db, current_user.id)


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task_route(payload: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return create_task(db, current_user.id, payload)


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_task_or_404(db, current_user.id, task_id)


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task_route(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = get_task_or_404(db, current_user.id, task_id)
    return update_task(db, task, payload)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_route(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Response:
    task = get_task_or_404(db, current_user.id, task_id)
    delete_task(db, task)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
