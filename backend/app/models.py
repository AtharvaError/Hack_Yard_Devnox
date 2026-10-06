from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """SQLite drops the timezone on the way out; everything is stored as UTC, so put it back."""

    impl = DateTime
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="user")  # "admin" | "user"
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class City(Base):
    __tablename__ = "cities"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    country: Mapped[str] = mapped_column(String(120), default="")
    admin1: Mapped[str] = mapped_column(String(120), default="")
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    population: Mapped[int] = mapped_column(Integer, default=0)
    radius_km: Mapped[float] = mapped_column(Float, default=7.0)
    weather: Mapped[dict] = mapped_column(JSON, default=dict)
    flood: Mapped[dict] = mapped_column(JSON, default=dict)
    weather_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[int] = mapped_column(primary_key=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), index=True)
    osm_id: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(30))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    elevation: Mapped[float] = mapped_column(Float, default=0.0)
    slope: Mapped[float] = mapped_column(Float, default=0.0)  # rise / run
    water_dist_m: Mapped[float] = mapped_column(Float, default=99999.0)


class Dependency(Base):
    """`target` relies on `source`. Inferred from proximity, not surveyed."""

    __tablename__ = "dependencies"
    id: Mapped[int] = mapped_column(primary_key=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    target_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    kind: Mapped[str] = mapped_column(String(20))  # "power" | "water" | "access"


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), default="advisory")  # advisory | warning | emergency
    created_by: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    user_email: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(Text)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | verified | rejected
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    address: Mapped[str] = mapped_column(String(300), default="")
    severity: Mapped[str] = mapped_column(String(20), default="serious")  # minor | serious | dangerous
    # Automatic photo check. It only advises the administrator; `status` is always a human decision.
    # pending | genuine | review | irrelevant | inappropriate | unchecked
    check_label: Mapped[str] = mapped_column(String(20), default="unchecked")
    check_reason: Mapped[str] = mapped_column(String(300), default="")
    check_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    check_source: Mapped[str] = mapped_column(String(80), default="")
    flags: Mapped[list] = mapped_column(JSON, default=list)


class ReportPhoto(Base):
    __tablename__ = "report_photos"
    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id"), index=True)
    file_name: Mapped[str] = mapped_column(String(80))
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    dhash: Mapped[str] = mapped_column(String(16), default="")  # perceptual hash, for near-duplicates
    # Read from the photo's metadata in the browser before it is stripped. A signal, not proof.
    taken_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    exif_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    exif_lon: Mapped[float | None] = mapped_column(Float, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor: Mapped[str] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(80))
    detail: Mapped[str] = mapped_column(Text, default="")
    at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
