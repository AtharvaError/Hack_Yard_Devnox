from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import config
from ..auth import audit, require_admin
from ..db import get_db
from ..models import AuditLog, User
from ..services import vision

router = APIRouter(prefix="/api", tags=["admin"])


class RoleChange(BaseModel):
    role: Literal["admin", "user"]


@router.get("/users")
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return [
        {"id": u.id, "email": u.email, "name": u.name, "role": u.role, "created_at": u.created_at.isoformat()}
        for u in db.query(User).order_by(User.created_at).all()
    ]


@router.patch("/users/{user_id}")
def change_role(user_id: int, body: RoleChange, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "You cannot change your own role")
    user.role = body.role
    db.commit()
    audit(db, admin.email, "change_role", f"{user.email} -> {body.role}")
    return {"id": user.id, "role": user.role}


@router.get("/audit")
def audit_log(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(AuditLog).order_by(AuditLog.at.desc()).limit(100).all()
    return [{"id": r.id, "actor": r.actor, "action": r.action, "detail": r.detail, "at": r.at.isoformat()} for r in rows]


@router.get("/sources")
def sources(admin: User = Depends(require_admin)):
    photo_check = vision.describe()
    return {
        "refresh_minutes": config.REFRESH_MINUTES,
        "radius_km": config.CITY_RADIUS_KM,
        "ai_brief": "Gemini (free tier)" if config.GEMINI_API_KEY else "Built-in template (no Gemini key set)",
        "photo_check": (
            f"{photo_check['name']}, plus duplicate and photo-metadata checks"
            if photo_check["enabled"]
            else "Duplicate and photo-metadata checks only (no AI key set)"
        ),
        "sources": [
            {"name": "Open-Meteo Forecast", "use": "Rain, heat and wind for the next 5 days", "key": False},
            {"name": "Open-Meteo Flood (GloFAS)", "use": "River discharge vs its 90-day normal", "key": False},
            {"name": "Open-Meteo Elevation (Copernicus DEM)", "use": "Elevation and slope of each asset", "key": False},
            {"name": "Open-Meteo Geocoding", "use": "City search", "key": False},
            {"name": "OpenStreetMap Overpass", "use": "Hospitals, roads, bridges, power, water, waterways", "key": False},
            {"name": "NASA GIBS", "use": "Daily satellite imagery layer on the map", "key": False},
            {"name": "OSRM public server", "use": "Driving routes for Safe Route", "key": False},
            {"name": "OpenStreetMap Nominatim", "use": "Address of a citizen report's map pin", "key": False},
        ],
    }
