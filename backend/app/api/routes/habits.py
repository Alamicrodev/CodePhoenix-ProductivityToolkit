from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.habits import HabitCompletionRequest, HabitCreate, HabitResponse, HabitUndoCompletionRequest, HabitUpdate
from app.services.habits import complete_habit, create_habit, delete_habit, get_habit_or_404, list_habits, undo_habit_completion, update_habit

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("", response_model=list[HabitResponse])
def get_habits(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list:
    return list_habits(db, current_user.id)


@router.post("", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
def create_habit_route(payload: HabitCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return create_habit(db, current_user.id, payload)


@router.get("/{habit_id}", response_model=HabitResponse)
def get_habit(habit_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_habit_or_404(db, current_user.id, habit_id)


@router.patch("/{habit_id}", response_model=HabitResponse)
def update_habit_route(habit_id: str, payload: HabitUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    habit = get_habit_or_404(db, current_user.id, habit_id)
    return update_habit(db, habit, payload)


@router.post("/{habit_id}/complete", response_model=HabitResponse)
def complete_habit_route(habit_id: str, payload: HabitCompletionRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    habit = get_habit_or_404(db, current_user.id, habit_id)
    return complete_habit(db, habit, payload.timestamp)


@router.post("/{habit_id}/undo", response_model=HabitResponse)
def undo_habit_route(habit_id: str, payload: HabitUndoCompletionRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    habit = get_habit_or_404(db, current_user.id, habit_id)
    return undo_habit_completion(db, habit, payload.completion_timestamp)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit_route(habit_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Response:
    habit = get_habit_or_404(db, current_user.id, habit_id)
    delete_habit(db, habit)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
