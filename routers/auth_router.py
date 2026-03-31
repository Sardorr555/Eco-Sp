from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from database import get_db
from models import User
from auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter()

class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company: str = ""

class LoginBody(BaseModel):
    email: str
    password: str

@router.post("/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "Email already registered")
    user = User(email=body.email, password_hash=hash_password(body.password),
                full_name=body.full_name, company=body.company)
    db.add(user); db.commit(); db.refresh(user)
    return {"access_token": create_token(user.id),
            "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "plan": user.plan}}

@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return {"access_token": create_token(user.id),
            "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "plan": user.plan}}

@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "full_name": user.full_name,
            "company": user.company, "plan": user.plan}

class UpdateProfileBody(BaseModel):
    full_name: str
    company: str

@router.put("/me")
def update_me(body: UpdateProfileBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.full_name = body.full_name
    user.company = body.company
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "company": user.company, "plan": user.plan}
