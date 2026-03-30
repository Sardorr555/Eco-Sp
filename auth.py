from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import User

SECRET_KEY = "sputnik-eco-secret-change-in-production"
ALGORITHM = "HS256"
ACCESS_EXPIRE_MINUTES = 60 * 24  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"])
bearer = HTTPBearer()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, ALGORITHM)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db)
) -> User:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
