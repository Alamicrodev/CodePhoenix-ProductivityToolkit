from fastapi import APIRouter

from app.api.routes import auth, cowork, cowork_ws, focus_sessions, habits, health, tasks

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(tasks.router)
api_router.include_router(habits.router)
api_router.include_router(focus_sessions.router)
api_router.include_router(cowork.router)
api_router.include_router(cowork_ws.router)
