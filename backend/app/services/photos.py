"""Citizen report photos: validation, storage, the basic (non-AI) checks and the AI check."""

import hashlib
import io
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from .. import config
from ..db import SessionLocal
from ..live import hub
from ..models import Report, ReportPhoto
from . import vision
from .geo import fast_dist_m

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_SIDE = 1600
NEAR_DUPLICATE_BITS = 6  # dhash bits that may differ between two copies of the same photo
FAR_FROM_PIN_M = 1000
OLD_PHOTO_DAYS = 7

# Refuse absurdly large images before decoding them (Pillow raises at twice this many pixels).
Image.MAX_IMAGE_PIXELS = 40_000_000


def _dhash(image: Image.Image) -> str:
    """Difference hash: survives resizing and recompression, so it catches re-sent copies of a photo."""
    small = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(small.getdata())
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (pixels[row * 9 + col] > pixels[row * 9 + col + 1])
    return f"{bits:016x}"


def process(data: bytes) -> tuple[bytes, str, str]:
    """Checks an upload really is a photo and re-encodes it. Returns (jpeg bytes, sha256, dhash)."""
    if len(data) > config.MAX_PHOTO_BYTES:
        raise HTTPException(413, f"Each photo must be under {config.MAX_PHOTO_BYTES // (1024 * 1024)} MB")
    try:
        Image.open(io.BytesIO(data)).verify()
        image = Image.open(io.BytesIO(data))  # verify() leaves the first handle unusable
        if image.format not in ALLOWED_FORMATS:
            raise ValueError(image.format)
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((MAX_SIDE, MAX_SIDE))
    except Exception:
        raise HTTPException(400, "One of the files is not a valid JPEG, PNG or WebP photo")
    out = io.BytesIO()
    # Re-encoding keeps only the pixels, so hidden location and device data never reach storage.
    image.save(out, "JPEG", quality=85)
    jpeg = out.getvalue()
    return jpeg, hashlib.sha256(jpeg).hexdigest(), _dhash(image)


def store(jpeg: bytes) -> str:
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_name = f"{uuid.uuid4().hex}.jpg"  # random, so names cannot be guessed
    (config.UPLOAD_DIR / file_name).write_bytes(jpeg)
    return file_name


def parse_meta(raw: object) -> dict:
    """Photo metadata sent by the browser. Anything malformed or out of range is ignored."""
    meta = raw if isinstance(raw, dict) else {}
    taken_at = None
    if isinstance(meta.get("taken_at"), str):
        try:
            taken_at = datetime.fromisoformat(meta["taken_at"].replace("Z", "+00:00"))
            if taken_at.tzinfo is None:
                taken_at = taken_at.replace(tzinfo=timezone.utc)
        except ValueError:
            taken_at = None
    lat, lon = meta.get("lat"), meta.get("lon")
    valid = (
        isinstance(lat, (int, float)) and isinstance(lon, (int, float))
        and not isinstance(lat, bool) and not isinstance(lon, bool)
        and -90 <= lat <= 90 and -180 <= lon <= 180 and (lat, lon) != (0, 0)
    )
    return {"taken_at": taken_at, "exif_lat": float(lat) if valid else None, "exif_lon": float(lon) if valid else None}


def _same_photo(a: ReportPhoto, b: ReportPhoto) -> bool:
    if a.sha256 == b.sha256:
        return True
    if not a.dhash or not b.dhash:
        return False
    return bin(int(a.dhash, 16) ^ int(b.dhash, 16)).count("1") <= NEAR_DUPLICATE_BITS


def basic_flags(db: Session, report: Report, photos: list[ReportPhoto]) -> list[dict]:
    """Checks that need no AI: re-used photos, and photo metadata that contradicts the report."""
    flags: list[dict] = []

    others = db.query(ReportPhoto).filter(ReportPhoto.report_id != report.id).all()
    matches = sorted({other.report_id for photo in photos for other in others if _same_photo(photo, other)})
    if matches:
        listed = ", ".join(f"#{i}" for i in matches[:3])
        flags.append({"code": "duplicate", "text": f"Same photo as report {listed}"})

    distances = [
        fast_dist_m(report.lat, report.lon, p.exif_lat, p.exif_lon)
        for p in photos
        if p.exif_lat is not None and p.exif_lon is not None
    ]
    if distances and min(distances) > FAR_FROM_PIN_M:
        flags.append(
            {"code": "far_from_pin", "text": f"Photo was taken {min(distances) / 1000:.1f} km from the reported spot"}
        )

    ages = [report.created_at - p.taken_at for p in photos if p.taken_at is not None]
    if ages and min(ages) > timedelta(days=OLD_PHOTO_DAYS):
        flags.append({"code": "old_photo", "text": f"Photo was taken {min(ages).days} days before the report"})
    return flags


def run_check(report_id: int) -> None:
    """Runs after the upload has been answered, so the citizen is never kept waiting on the AI."""
    with SessionLocal() as db:
        report = db.get(Report, report_id)
        if not report:
            return
        photos = db.query(ReportPhoto).filter(ReportPhoto.report_id == report_id).all()
        cfg = vision.settings()
        report.check_confidence = None
        if not cfg:
            report.check_label = "unchecked"
            report.check_source = "Basic checks"
            report.check_reason = "No AI key is configured, so only the basic checks ran."
        else:
            images = []
            for photo in photos:
                path = config.UPLOAD_DIR / photo.file_name
                if path.exists():
                    images.append(path.read_bytes())
            result = (
                vision.check(cfg, images, report.category, report.severity)
                if images
                else {"ok": False, "error": "the photo files are missing"}
            )
            if result["ok"]:
                verdict = result["verdict"]
                report.check_label, reason = vision.decide(verdict, report.flags or [])
                if verdict["severity"] not in ("none", report.severity) and report.check_label != "inappropriate":
                    reason = f"{reason} AI severity estimate: {verdict['severity']}."
                report.check_reason = reason[:300]
                report.check_confidence = verdict["confidence"]
                report.check_source = f"{cfg['name']} · {result['model']}"[:80]
            else:
                # The report stays in the queue either way; the administrator just gets less help.
                report.check_label = "unchecked"
                report.check_source = cfg["name"]
                report.check_reason = f"AI check unavailable: {result['error']}."[:300]
        city_id = report.city_id
        db.commit()
    hub.broadcast_from_thread({"type": "report_checked", "city_id": city_id})
