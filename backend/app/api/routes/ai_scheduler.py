from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai_scheduler import AiSchedulerRequest, AiSchedulerResponse
from app.services.ai_scheduler import build_ai_schedule

router = APIRouter(prefix="/ai-scheduler", tags=["ai-scheduler"])


@router.post("/suggest", response_model=AiSchedulerResponse)
def suggest_schedule_route(
    payload: AiSchedulerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiSchedulerResponse:
    return build_ai_schedule(db, current_user.id, payload.current_time, payload.time_zone)
