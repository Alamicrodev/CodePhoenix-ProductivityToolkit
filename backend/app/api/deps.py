from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")  
#oauth2_scheme looks at incoming request authorization headers: Extracts just the token part (everything after "Bearer ") and hands it to you as a plain string.
#tokenUrl — this doesn't get called by FastAPI. It's purely documentation/metadata like swaggerUI and clients so they know where to login.


def get_current_user(
    db: Session = Depends(get_db),          #gets db session
    token: str = Depends(oauth2_scheme),    #gets jwt token from reqest
) -> User:
    user_id = decode_access_token(token)    
    user = db.get(User, user_id)             #get user from db
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return user    
