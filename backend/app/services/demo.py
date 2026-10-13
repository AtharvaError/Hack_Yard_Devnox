"""Demo dataset.

Each file in `backend/demo_data` holds a snapshot of one city's real OpenStreetMap assets and a
modelled storm day. Cities in demo mode are scored against that storm instead of the live forecast,
so the dashboard always has something to show and works without any outside service.
"""

import json
import math
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from sqlalchemy.orm import Session

from .. import config
from ..models import Asset, City, Dependency, Place, utcnow
from .geo import fast_dist_m

DATA_DIR = config.BASE_DIR / "demo_data"
UTC_OFFSET_S = 19800  # the demo cities are in India
PAST_HOURS, FUTURE_HOURS = 72, 144
# Share of the peak day's rain that falls in each following day as the storm moves off.
DAY_SHARE = [1.0, 0.6, 0.3, 0.1, 0.05, 0.05]


@lru_cache
def _snapshots() -> list[dict]:
    if not DATA_DIR.exists():
        return []
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(DATA_DIR.glob("*.json"))]


def storm_for(city: City) -> dict | None:
    for snap in _snapshots():
        if fast_dist_m(city.lat, city.lon, snap["city"]["lat"], snap["city"]["lon"]) < 2000:
            return snap["storm"]
    return None


def storm_weather(storm: dict) -> tuple[dict, dict]:
    """The storm as hourly weather and daily river flow, in the same shape the live services return.

    The series is anchored to the current hour, so the storm is always "now" and eases over 72 hours.
    """
    now_local = (datetime.now(timezone.utc) + timedelta(seconds=UTC_OFFSET_S)).replace(minute=0, second=0, microsecond=0)
    times, rain, apparent, gust = [], [], [], []
    for h in range(-PAST_HOURS, FUTURE_HOURS):
        stamp = now_local + timedelta(hours=h)
        times.append(stamp.strftime("%Y-%m-%dT%H:00"))
        if h < 0:
            rain.append(storm["antecedent"] / PAST_HOURS)
            strength = 0.5
        else:
            day = min(h // 24, len(DAY_SHARE) - 1)
            # A burst in the middle of each day rather than steady drizzle.
            burst = 1 + 0.8 * math.cos((h % 24 - 12) / 24 * 2 * math.pi)
            rain.append(storm["rain24"] * DAY_SHARE[day] / 24 * burst)
            strength = DAY_SHARE[day]
        daytime = 0.5 + 0.5 * math.cos((stamp.hour - 14) / 24 * 2 * math.pi)
        apparent.append(storm["apparent_max"] - 6 * (1 - daytime))
        gust.append(22 + (storm["gust"] - 22) * strength)
    weather = {
        "utc_offset_seconds": UTC_OFFSET_S,
        "hourly": {
            "time": times,
            "precipitation": [round(v, 2) for v in rain],
            "temperature_2m": [round(v - 2, 1) for v in apparent],
            "apparent_temperature": [round(v, 1) for v in apparent],
            "wind_gusts_10m": [round(v, 1) for v in gust],
        },
    }

    today = datetime.now(timezone.utc).date()
    dates, flow = [], []
    for d in range(-90, 8):
        dates.append((today + timedelta(days=d)).isoformat())
        if d < 0:
            flow.append(100.0)
        else:
            flow.append(round(100 * (1 + (storm["river_ratio"] - 1) * DAY_SHARE[min(d, len(DAY_SHARE) - 1)]), 1))
    return weather, {"daily": {"time": dates, "river_discharge": flow}}


def seed(db: Session) -> None:
    """Make sure every demo city exists. Cities already in the database keep their data and reports."""
    cities = db.query(City).all()
    for snap in _snapshots():
        place = snap["city"]
        existing = next((c for c in cities if fast_dist_m(c.lat, c.lon, place["lat"], place["lon"]) < 2000), None)
        if existing:
            if snap.get("places") and not db.query(Place).filter(Place.city_id == existing.id).first():
                db.add_all(Place(city_id=existing.id, **p) for p in snap["places"])
            if existing.data_mode is None:  # loaded before the demo dataset existed
                existing.data_mode = "demo"
                existing.weather, existing.flood = storm_weather(snap["storm"])
                existing.weather_at = utcnow()
            continue
        weather, flood = storm_weather(snap["storm"])
        city = City(**place, weather=weather, flood=flood, weather_at=utcnow(), data_mode="demo")
        db.add(city)
        db.flush()
        assets = [Asset(city_id=city.id, **a) for a in snap["assets"]]
        db.add_all(assets)
        db.flush()
        db.add_all(
            Dependency(city_id=city.id, source_id=assets[s].id, target_id=assets[t].id, kind=kind)
            for s, t, kind in snap["dependencies"]
        )
        db.add_all(Place(city_id=city.id, **p) for p in snap.get("places", []))
    db.commit()
