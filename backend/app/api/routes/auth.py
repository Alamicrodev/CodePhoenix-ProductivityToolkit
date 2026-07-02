from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserResponse
from app.services.auth import authenticate_user, create_user, get_user_by_email

router = APIRouter(prefix="/auth", tags=["auth"])   #applies auth tag to all routes using this router


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED) 
#response_model is the schema with which fastAPI validates your RouteHandler function output. 
#status_code is the status response that fastAPI sends if the function succeeds. 
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> User:   #RegisterRequest is the 'type' of payload, and db is an SQLAlchemy Session 'type'   
    existing_user = get_user_by_email(db, payload.email)                         #Depends tells FastAPI to run get_db before running this RouteHandler function and put the output in db(it is a generator function FASTAPI does the first next(gen) too).
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered") #fastAPI's built in exception handler handles HTTP exceptions and returns an HTTP response with given status code and detail message in JSON. 
    return create_user(db, payload)    #creates a user in db and returns it


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, payload)  
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserResponse)
#response_model is the schema with which fastAPI validates your RouteHandler function output. 
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user              #UserResponse schema filters the user data to respond with data in schema

