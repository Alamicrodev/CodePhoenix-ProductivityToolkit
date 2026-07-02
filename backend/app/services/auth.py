from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest


def get_user_by_email(db: Session, email: str) -> User | None:           #select() just builds the SQL query object in python.
    return db.scalar(select(User).where(User.email == email.lower()))    #db.scalar(queryObject) ##db.scalar selects the first row and the first column? of the query result. (this is confusing bcz you get entire user object as result)
    # select(User) → "first column & first row" = the whole object, because we gave it entire model so it maps the raw db row that it gets into JS Object. 
    # select(User.email, User.name) → "first column & first row" = only email (in this case it does not map it into a Js object instead you only get raw string)


def create_user(db: Session, payload: RegisterRequest) -> User:
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name.strip(),
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)   #updates the user object's attributes getting fresh from db > includes things like id or createdAt which are database generated
    return user


def authenticate_user(db: Session, payload: LoginRequest) -> User | None:
    user = get_user_by_email(db, payload.email)
    if not user:                                                      #incase no user found
        return None
    if not verify_password(payload.password, user.hashed_password):   #incase given password doesn't match
        return None
    return user                    
