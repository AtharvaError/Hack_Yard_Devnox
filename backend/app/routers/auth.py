import re

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import config
from ..auth import audit, create_token, current_user, hash_password, verify_password
from ..db import get_db
from ..models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Credentials(BaseModel):
    email: str
    password: str


class Registration(Credentials):
    name: str


def _public(user: User) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role}


def _set_cookie(response: Response, user: User) -> None:
    response.set_cookie(
        config.COOKIE_NAME,
        create_token(user),
        httponly=True,
        samesite="lax",
        secure=config.COOKIE_SECURE,
        max_age=config.JWT_HOURS * 3600,
        path="/",
    )


@router.post("/register")
def register(body: Registration, response: Response, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Enter a valid email address")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if not body.name.strip():
        raise HTTPException(400, "Enter your name")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "An account with this email already exists")
    # Self-registration always creates a normal user; only an admin can promote.
    user = User(email=email, name=body.name.strip()[:120], password_hash=hash_password(body.password), role="user")
    db.add(user)
    db.commit()
    audit(db, email, "register")
    _set_cookie(response, user)
    return _public(user)


@router.post("/login")
def login(body: Credentials, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Email or password is incorrect")
    audit(db, user.email, "login")
    _set_cookie(response, user)
    return _public(user)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(config.COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return _public(user)


@router.get("/demo-accounts")
def demo_accounts():
    """Shown as one-click buttons on the login page. Disabled with DEMO_MODE=false."""
    if not config.DEMO_MODE:
        return []
    return [
        {"label": "Demo admin", "email": config.DEMO_ADMIN_EMAIL, "password": config.DEMO_ADMIN_PASSWORD},
        {"label": "Demo user", "email": config.DEMO_USER_EMAIL, "password": config.DEMO_USER_PASSWORD},
    ]
