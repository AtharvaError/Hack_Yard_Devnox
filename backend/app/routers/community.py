import json
import threading
import time
from datetime import timedelta
from typing import Literal

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import config
from ..auth import audit, current_user, require_admin
from ..db import get_db
from ..live import hub
from ..models import Alert, City, Report, ReportPhoto, User, utcnow
from ..services import photos as photo_service
from ..services import vision

router = APIRouter(prefix="/api", tags=["community"])

DAMAGE_TYPES = [
    "Flooded road",
    "Road damage or sinkhole",
    "Damaged bridge",
    "Fallen power line or pole",
    "Power outage",
    "Landslide or rockfall",
    "Water supply or burst pipe",
    "Blocked drain",
    "Damaged building",
    "Other",
]
SEVERITIES = ["minor", "serious", "dangerous"]

# Order of the administrator's review queue: undecided first, then the most credible and most severe.
STATUS_ORDER = {"pending": 0, "verified": 1, "rejected": 2}
LABEL_ORDER = {"genuine": 0, "review": 1, "pending": 2, "unchecked": 2, "irrelevant": 3, "inappropriate": 4}
SEVERITY_ORDER = {"dangerous": 0, "serious": 1, "minor": 2}


class NewAlert(BaseModel):
    city_id: int
    title: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=3, max_length=2000)
    severity: Literal["advisory", "warning", "emergency"] = "advisory"


class ReportStatus(BaseModel):
    status: Literal["pending", "verified", "rejected"]


def _alert(a: Alert) -> dict:
    return {
        "id": a.id, "city_id": a.city_id, "title": a.title, "message": a.message,
        "severity": a.severity, "created_by": a.created_by, "created_at": a.created_at.isoformat(),
    }


def _report(r: Report, photos: list[ReportPhoto], admin: bool) -> dict:
    data = {
        "id": r.id, "city_id": r.city_id, "category": r.category, "severity": r.severity or "serious",
        "description": r.description, "address": r.address or "", "lat": r.lat, "lon": r.lon,
        "status": r.status, "created_at": r.created_at.isoformat(),
        "photos": [{"id": p.id, "url": f"/api/reports/photos/{p.id}"} for p in photos],
    }
    if admin:
        # The automatic check is advice for staff. Citizens only ever see the human decision.
        data |= {
            "user_email": r.user_email,
            "check": {
                "label": r.check_label or "unchecked",
                "reason": r.check_reason or "",
                "confidence": r.check_confidence,
                "source": r.check_source or "",
            },
            "flags": r.flags or [],
        }
    return data


def _photos_by_report(db: Session, report_ids: list[int]) -> dict[int, list[ReportPhoto]]:
    grouped: dict[int, list[ReportPhoto]] = {i: [] for i in report_ids}
    if report_ids:
        for photo in db.query(ReportPhoto).filter(ReportPhoto.report_id.in_(report_ids)).order_by(ReportPhoto.id):
            grouped[photo.report_id].append(photo)
    return grouped


# ---- alerts ---------------------------------------------------------------


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


# ---- citizen reports ------------------------------------------------------


@router.get("/report-options")
def report_options(user: User = Depends(current_user)):
    return {
        "damage_types": DAMAGE_TYPES,
        "severities": SEVERITIES,
        "max_photos": config.MAX_PHOTOS,
        "photo_check": vision.describe(),
    }


@router.get("/reports")
def list_reports(city_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    admin = user.role == "admin"
    query = db.query(Report).filter(Report.city_id == city_id)
    if not admin:
        query = query.filter(Report.user_id == user.id)
    rows = query.order_by(Report.created_at.desc()).all()
    if admin:
        rows.sort(
            key=lambda r: (
                STATUS_ORDER.get(r.status, 9),
                LABEL_ORDER.get(r.check_label or "unchecked", 9),
                SEVERITY_ORDER.get(r.severity or "serious", 9),
            )
        )
    photos = _photos_by_report(db, [r.id for r in rows])
    return [_report(r, photos[r.id], admin) for r in rows]


@router.post("/reports")
def create_report(
    background: BackgroundTasks,
    city_id: int = Form(),
    category: str = Form(),
    severity: str = Form(),
    lat: float = Form(ge=-90, le=90),
    lon: float = Form(ge=-180, le=180),
    address: str = Form("", max_length=300),
    description: str = Form("", max_length=2000),
    photo_meta: str = Form("[]", max_length=2000),
    photos: list[UploadFile] = File(),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not db.get(City, city_id):
        raise HTTPException(404, "City not found")
    if category not in DAMAGE_TYPES:
        raise HTTPException(400, "Choose a damage type from the list")
    if severity not in SEVERITIES:
        raise HTTPException(400, "Choose how severe the damage is")
    if not 1 <= len(photos) <= config.MAX_PHOTOS:
        raise HTTPException(400, f"Attach between 1 and {config.MAX_PHOTOS} photos")
    if user.role != "admin":
        since = utcnow() - timedelta(days=1)
        sent = db.query(Report).filter(Report.user_id == user.id, Report.created_at >= since).count()
        if sent >= config.REPORTS_PER_DAY:
            raise HTTPException(429, f"You can send up to {config.REPORTS_PER_DAY} reports a day. Please try again tomorrow.")

    # Validate every photo before anything is written, so a bad file leaves nothing behind.
    processed = []
    for upload in photos:
        data = upload.file.read(config.MAX_PHOTO_BYTES + 1)
        processed.append(photo_service.process(data))
    try:
        metas = json.loads(photo_meta)
    except ValueError:
        metas = []
    if not isinstance(metas, list):
        metas = []

    report = Report(
        city_id=city_id, user_id=user.id, user_email=user.email, category=category, severity=severity,
        description=description.strip(), address=address.strip(), lat=lat, lon=lon,
        created_at=utcnow(), check_label="pending",
    )
    db.add(report)
    db.flush()
    rows = []
    for index, (jpeg, sha256, dhash) in enumerate(processed):
        meta = photo_service.parse_meta(metas[index] if index < len(metas) else None)
        rows.append(
            ReportPhoto(report_id=report.id, file_name=photo_service.store(jpeg), sha256=sha256, dhash=dhash, **meta)
        )
    db.add_all(rows)
    db.flush()
    report.flags = photo_service.basic_flags(db, report, rows)
    db.commit()

    background.add_task(photo_service.run_check, report.id)
    hub.broadcast_from_thread({"type": "report", "city_id": city_id})
    return _report(report, rows, user.role == "admin")


@router.get("/reports/photos/{photo_id}")
def report_photo(photo_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    photo = db.get(ReportPhoto, photo_id)
    report = db.get(Report, photo.report_id) if photo else None
    # Only staff and the person who sent the report may see its photos. Same answer for
    # "not yours" and "does not exist", so photo ids cannot be probed.
    if not photo or not report or (user.role != "admin" and report.user_id != user.id):
        raise HTTPException(404, "Photo not found")
    path = config.UPLOAD_DIR / photo.file_name
    if not path.is_file():
        raise HTTPException(404, "Photo not found")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})


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
    return _report(report, _photos_by_report(db, [report.id])[report.id], True)


@router.post("/reports/{report_id}/recheck")
def recheck_report(
    report_id: int,
    background: BackgroundTasks,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    report.check_label = "pending"
    report.check_reason = ""
    db.commit()
    background.add_task(photo_service.run_check, report.id)
    return _report(report, _photos_by_report(db, [report.id])[report.id], True)


# ---- address lookup -------------------------------------------------------

_address_cache: dict[tuple[float, float], str] = {}
_address_lock = threading.Lock()
_last_lookup = 0.0


@router.get("/reverse-geocode")
def reverse_geocode(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    user: User = Depends(current_user),
):
    """Turns a map pin into a street address using OpenStreetMap's free Nominatim service."""
    global _last_lookup
    key = (round(lat, 4), round(lon, 4))
    if key in _address_cache:
        return {"address": _address_cache[key]}
    with _address_lock:  # Nominatim's usage policy allows one request a second
        wait = 1.1 - (time.monotonic() - _last_lookup)
        if wait > 0:
            time.sleep(wait)
        try:
            res = httpx.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 18, "accept-language": "en"},
                headers={"User-Agent": config.USER_AGENT},
                timeout=10,
            )
            address = str(res.json().get("display_name", ""))[:300] if res.status_code == 200 else ""
        except (httpx.HTTPError, ValueError):
            address = ""  # the form still works; the citizen types the address instead
        _last_lookup = time.monotonic()
    if address:
        _address_cache[key] = address
    return {"address": address}
