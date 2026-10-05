from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import audit, current_user, require_admin
from ..db import get_db
from ..live import hub
from ..models import Alert, City, Report, User

router = APIRouter(prefix="/api", tags=["community"])

REPORT_CATEGORIES = ["Flooded road", "Damaged bridge", "Power outage", "Landslide", "Water supply", "Other"]


class NewAlert(BaseModel):
    city_id: int
    title: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=3, max_length=2000)
    severity: Literal["advisory", "warning", "emergency"] = "advisory"


class NewReport(BaseModel):
    city_id: int
    category: str
    description: str = Field(min_length=5, max_length=2000)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class ReportStatus(BaseModel):
    status: Literal["pending", "verified", "rejected"]


def _alert(a: Alert) -> dict:
    return {
        "id": a.id, "city_id": a.city_id, "title": a.title, "message": a.message,
        "severity": a.severity, "created_by": a.created_by, "created_at": a.created_at.isoformat(),
    }


def _report(r: Report) -> dict:
    return {
        "id": r.id, "city_id": r.city_id, "user_email": r.user_email, "category": r.category,
        "description": r.description, "lat": r.lat, "lon": r.lon, "status": r.status,
        "created_at": r.created_at.isoformat(),
    }


@router.get("/alerts")
def list_alerts(city_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(Alert).filter(Alert.city_id == city_id).order_by(Alert.created_at.desc()).all()
    return [_alert(a) for a in rows]


@router.post("/alerts")
def create_alert(body: NewAlert, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    if not db.get(City, body.city_id):
        raise HTTPException(404, "City not found")
    alert = Alert(**body.model_dump(), created_by=user.email)
    db.add(alert)
    db.commit()
    audit(db, user.email, "create_alert", body.title)
    hub.broadcast_from_thread({"type": "alert", "city_id": body.city_id, "title": body.title, "severity": body.severity})
    return _alert(alert)


@router.delete("/alerts/{alert_id}")
def delete_alert(alert_id: int, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    city_id = alert.city_id
    db.delete(alert)
    db.commit()
    audit(db, user.email, "delete_alert", alert.title)
    hub.broadcast_from_thread({"type": "alert_removed", "city_id": city_id})
    return {"ok": True}


@router.get("/report-categories")
def categories(user: User = Depends(current_user)):
    return REPORT_CATEGORIES


@router.get("/reports")
def list_reports(city_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = db.query(Report).filter(Report.city_id == city_id)
    if user.role != "admin":
        query = query.filter(Report.user_id == user.id)
    return [_report(r) for r in query.order_by(Report.created_at.desc()).all()]


@router.post("/reports")
def create_report(body: NewReport, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not db.get(City, body.city_id):
        raise HTTPException(404, "City not found")
    if body.category not in REPORT_CATEGORIES:
        raise HTTPException(400, "Unknown category")
    report = Report(**body.model_dump(), user_id=user.id, user_email=user.email)
    db.add(report)
    db.commit()
    hub.broadcast_from_thread({"type": "report", "city_id": body.city_id})
    return _report(report)


@router.patch("/reports/{report_id}")
def review_report(
    report_id: int, body: ReportStatus, user: User = Depends(require_admin), db: Session = Depends(get_db)
):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    report.status = body.status
    db.commit()
    audit(db, user.email, f"report_{body.status}", f"#{report.id} {report.category}")
    # A verified report raises the score of nearby assets, so maps need to refresh.
    hub.broadcast_from_thread({"type": "risk_updated", "city_id": report.city_id})
    return _report(report)
