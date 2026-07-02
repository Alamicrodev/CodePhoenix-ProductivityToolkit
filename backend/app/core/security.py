from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")  #use bcrypt algorithm to hash passwords,  #deprecated="auto" tells passlib: "Automatically treat every scheme except the first one in the list as deprecated. don't hash new passwords with them, use them only to verify old passwords created with them and also flag them for migration for newer latest typed scheme eg ["argon2", "bcrypt"]
settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:   #plain_password is the password given in request to login
    return pwd_context.verify(plain_password, hashed_password)            #hashed_password is stored in the db, the function verifies them


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:  #subject is user.id 
    expire = datetime.now(timezone.utc) + (                                            
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)       #expires_delta is the time difference between current time and the expiry time.
    )
    payload: dict[str, Any] = {"sub": subject, "exp": expire}           
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")                 #creates and returns a jwt access token 


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        ) from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return str(subject)
