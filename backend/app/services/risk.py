"""Explainable risk scoring.

For each hazard:  risk = intensity (weather) x exposure (terrain) x vulnerability (asset type)
Asset risk (0-100) combines the hazards as 1 - product(1 - risk_h).
"""

from datetime import datetime, timedelta, timezone
from statistics import median

from ..models import Asset, City, Report
from .geo import clamp, fast_dist_m

HAZARDS = ["flood", "heat", "landslide", "wind"]

VULNERABILITY = {
    "hospital": {"flood": 0.70, "heat": 0.60, "landslide": 0.50, "wind": 0.30},
    "substation": {"flood": 0.90, "heat": 0.80, "landslide": 0.50, "wind": 0.60},
    "power_plant": {"flood": 0.80, "heat": 0.70, "landslide": 0.50, "wind": 0.50},
    "bridge": {"flood": 0.85, "heat": 0.35, "landslide": 0.70, "wind": 0.50},
    "road": {"flood": 0.75, "heat": 0.35, "landslide": 0.85, "wind": 0.20},
    "water": {"flood": 0.80, "heat": 0.40, "landslide": 0.50, "wind": 0.20},
    "fire_station": {"flood": 0.60, "heat": 0.30, "landslide": 0.50, "wind": 0.30},
}

# How much the city depends on each asset type (used for prioritisation, not for risk).
CRITICALITY = {
    "hospital": 1.0,
    "substation": 0.9,
    "power_plant": 0.9,
    "water": 0.85,
    "fire_station": 0.8,
    "bridge": 0.7,
    "road": 0.5,
}

# Stress tests. Each value replaces the live reading when it is more severe.
SCENARIOS = {
    "cloudburst": {
        "name": "Cloudburst",
        "description": "200 mm of rain in 24 hours on already wet ground.",
        "rain24": 200, "antecedent": 150, "river_ratio": 2.0,
    },
    "river_flood": {
        "name": "River flood",
        "description": "River discharge at four times its normal level after sustained rain.",
        "rain24": 90, "antecedent": 220, "river_ratio": 4.0,
    },
    "heatwave": {
        "name": "Severe heatwave",
        "description": "Feels-like temperature peaking at 48 °C.",
        "apparent_max": 48,
    },
    "cyclone": {
        "name": "Cyclonic storm",
        "description": "150 mm of rain with 120 km/h gusts.",
        "rain24": 150, "antecedent": 80, "gust": 120, "river_ratio": 1.8,
    },
}

REPORT_RADIUS_M = 400
REPORT_BUMP = 8
REPORT_BUMP_MAX = 20


def level_of(score: float) -> str:
    if score >= 70:
        return "critical"
    if score >= 45:
        return "high"
    if score >= 20:
        return "moderate"
    return "low"


def public_level(level: str) -> str:
    return {"low": "safe", "moderate": "caution"}.get(level, "danger")


def _now_index(weather: dict) -> int:
    times = weather.get("hourly", {}).get("time", [])
    local_now = datetime.now(timezone.utc) + timedelta(seconds=weather.get("utc_offset_seconds", 0))
    stamp = local_now.strftime("%Y-%m-%dT%H:00")
    for i, t in enumerate(times):
        if t >= stamp:
            return i
    return max(len(times) - 24, 0)


def _river_ratio(flood: dict, start_h: int) -> float:
    daily = flood.get("daily", {})
    dates, values = daily.get("time", []), daily.get("river_discharge", [])
    if not dates or not values:
        return 1.0
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    past = [v for d, v in zip(dates, values) if d < today and v is not None]
    baseline = median(past) if past else 0
    if baseline <= 0:
        return 1.0
    day = (datetime.now(timezone.utc) + timedelta(hours=start_h)).strftime("%Y-%m-%d")
    next_day = (datetime.now(timezone.utc) + timedelta(hours=start_h + 24)).strftime("%Y-%m-%d")
    window = [v for d, v in zip(dates, values) if day <= d <= next_day and v is not None]
    return max(window) / baseline if window else 1.0


def hazard_window(city: City, start_h: int = 0, scenario: str | None = None) -> dict:
    """Weather readings and 0-1 hazard intensities for the 24 hours starting `start_h` from now."""
    hourly = city.weather.get("hourly", {})
    i0 = _now_index(city.weather) + start_h

    def series(key: str, lo: int, hi: int) -> list[float]:
        return [v for v in hourly.get(key, [])[max(lo, 0) : hi] if v is not None]

    raw = {
        "rain24": sum(series("precipitation", i0, i0 + 24)),
        "antecedent": sum(series("precipitation", i0 - 72, i0)),
        "apparent_max": max(series("apparent_temperature", i0, i0 + 24), default=20.0),
        "gust": max(series("wind_gusts_10m", i0, i0 + 24), default=0.0),
        "river_ratio": _river_ratio(city.flood, start_h),
    }
    if scenario in SCENARIOS:
        for key in raw:
            if key in SCENARIOS[scenario]:
                raw[key] = max(raw[key], SCENARIOS[scenario][key])

    intensity = {
        "flood": clamp(
            0.55 * clamp(raw["rain24"] / 120)
            + 0.20 * clamp(raw["antecedent"] / 200)
            + 0.25 * clamp((raw["river_ratio"] - 1) / 2)
        ),
        # Heat stress on equipment and patients starts around a feels-like 34 °C and saturates at 48 °C.
        "heat": clamp((raw["apparent_max"] - 34) / 14),
        "landslide": clamp(0.7 * clamp(raw["rain24"] / 100) + 0.3 * clamp(raw["antecedent"] / 200)),
        "wind": clamp((raw["gust"] - 45) / 55),
    }
    return {"raw": {k: round(v, 1) for k, v in raw.items()}, "intensity": intensity}


def _exposure(asset: Asset, lowness: float) -> dict:
    flatness = 1 - clamp(asset.slope / 0.08)
    near_water = clamp(1 - asset.water_dist_m / 1500)
    return {
        "flood": 0.45 * lowness + 0.15 * flatness + 0.40 * near_water,
        "heat": 1.0,
        "landslide": clamp(asset.slope / 0.20),
        "wind": 1.0,
    }


def _explain(hazard: str, asset: Asset, raw: dict, lowness: float) -> str:
    if hazard == "flood":
        parts = [f"{raw['rain24']:.0f} mm rain in 24 h"]
        if raw["river_ratio"] > 1.3:
            parts.append(f"river at {raw['river_ratio']:.1f}x normal")
        if lowness > 0.6:
            parts.append("low-lying site")
        if asset.water_dist_m < 500:
            parts.append(f"{asset.water_dist_m:.0f} m from a waterway")
        return ", ".join(parts)
    if hazard == "heat":
        return f"feels-like temperature up to {raw['apparent_max']:.0f} °C"
    if hazard == "landslide":
        return f"{asset.slope * 100:.0f}% slope with {raw['rain24']:.0f} mm rain"
    return f"gusts up to {raw['gust']:.0f} km/h"


def score_assets(
    city: City,
    assets: list[Asset],
    reports: list[Report],
    start_h: int = 0,
    scenario: str | None = None,
) -> list[dict]:
    window = hazard_window(city, start_h, scenario)
    raw, intensity = window["raw"], window["intensity"]
    elevations = sorted(a.elevation for a in assets)
    verified = [r for r in reports if r.status == "verified"]

    scored = []
    for asset in assets:
        # Share of the city's assets that sit higher than this one.
        lowness = sum(1 for e in elevations if e > asset.elevation) / max(len(elevations) - 1, 1)
        exposure = _exposure(asset, lowness)
        by_hazard = {
            h: intensity[h] * exposure[h] * VULNERABILITY[asset.type][h] for h in HAZARDS
        }
        survive = 1.0
        for value in by_hazard.values():
            survive *= 1 - value
        score = 100 * (1 - survive)

        factors = [
            {"hazard": h, "points": round(100 * v, 1), "why": _explain(h, asset, raw, lowness)}
            for h, v in by_hazard.items()
            if v >= 0.03
        ]
        nearby = sum(
            1 for r in verified if fast_dist_m(asset.lat, asset.lon, r.lat, r.lon) <= REPORT_RADIUS_M
        )
        if nearby:
            bump = min(nearby * REPORT_BUMP, REPORT_BUMP_MAX)
            score = min(score + bump, 100)
            factors.append(
                {"hazard": "reports", "points": bump, "why": f"{nearby} verified citizen report(s) within {REPORT_RADIUS_M} m"}
            )
        factors.sort(key=lambda f: -f["points"])
        dominant = max(by_hazard, key=by_hazard.get) if score >= 1 else None
        scored.append(
            {
                "id": asset.id,
                "name": asset.name,
                "type": asset.type,
                "lat": asset.lat,
                "lon": asset.lon,
                "elevation": round(asset.elevation, 1),
                "slope_pct": round(asset.slope * 100, 1),
                "water_dist_m": round(asset.water_dist_m) if asset.water_dist_m < 90000 else None,
                "score": round(score, 1),
                "level": level_of(score),
                "dominant": dominant,
                "by_hazard": {h: round(100 * v, 1) for h, v in by_hazard.items()},
                "factors": factors,
                "criticality": CRITICALITY[asset.type],
            }
        )
    return scored


def city_score(scored: list[dict]) -> int:
    """0-1000. Blends the weighted average with the worst tenth so a few critical assets still show."""
    if not scored:
        return 0
    total_weight = sum(a["criticality"] for a in scored)
    average = sum(a["score"] * a["criticality"] for a in scored) / total_weight
    worst = sorted((a["score"] for a in scored), reverse=True)[: max(len(scored) // 10, 1)]
    return round(10 * (0.5 * average + 0.5 * sum(worst) / len(worst)))


def city_level(score: int) -> str:
    return level_of(score / 10)
