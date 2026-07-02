from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.dashboard import DashboardResponse
from app.schemas.focus_sessions import FocusSessionCreate, FocusSessionResponse, FocusSessionUpdate
from app.schemas.habits import HabitCreate, HabitResponse, HabitUpdate
from app.schemas.tasks import TaskCreate, TaskResponse, TaskUpdate
from app.schemas.user import UserResponse

#__init__.py tells python that this folder is a package 
#schemas in python can have multiple uses:
# 1. Validate user incoming data in request 
# 2. Serve as types for variables 
# 3. Serialize outgoing data(response) aka filter it to prevent any unexpected info from going out.

__all__ = [
    "RegisterRequest",
    "LoginRequest",
    "TokenResponse",
    "UserResponse",
    "TaskCreate",
    "TaskUpdate",
    "TaskResponse",
    "HabitCreate",
    "HabitUpdate",
    "HabitResponse",
    "FocusSessionCreate",
    "FocusSessionUpdate",
    "FocusSessionResponse",
    "DashboardResponse",
]
