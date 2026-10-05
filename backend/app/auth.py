from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from . import config
from .db import get_db
from .models import AuditLog, User, utcnow

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, Exception):
        return False


def create_token(user: User) -> str:
    payload = {"sub": str(user.id), "role": user.role, "exp": utcnow() + timedelta(hours=config.JWT_HOURS)}
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


def current_user(
    hy_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not hy_session:
        raise HTTPException(401, "Not signed in")
    try:
        payload = jwt.decode(hy_session, config.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired, please sign in again")
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(401, "Account no longer exists")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Administrator access required")
    return user


def audit(db: Session, actor: str, action: str, detail: str = "") -> None:
    db.add(AuditLog(actor=actor, action=action, detail=detail))
    db.commit()
