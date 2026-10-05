from datetime import timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import config
from ..auth import audit, current_user, require_admin
from ..db import get_db
from ..live import hub
from ..models import Asset, City, Dependency, Report, User, utcnow
from ..services import brief as brief_service
from ..services import cascade as cascade_service
from ..services import citydata, routing
from ..services import plan as plan_service
from ..services import risk

router = APIRouter(prefix="/api", tags=["city"])

TREND_HOURS = list(range(0, 73, 6))
TILE_TYPES = ["road", "bridge", "substation", "hospital", "water"]


class LoadCity(BaseModel):
    name: str
    lat: float | None = None
    lon: float | None = None
    country: str = ""
    admin1: str = ""
    population: int = 0


class CascadeRequest(BaseModel):
    failed_ids: list[int] = []
    auto: bool = False  # fail every asset currently at critical risk
    horizon: int = 0
    scenario: str | None = None


def _city_public(city: City, asset_count: int | None = None) -> dict:
    return {
        "id": city.id,
        "name": city.name,
        "country": city.country,
        "admin1": city.admin1,
        "lat": city.lat,
        "lon": city.lon,
        "population": city.population,
        "radius_km": city.radius_km,
        "weather_at": city.weather_at.isoformat() if city.weather_at else None,
        "asset_count": asset_count,
    }


def _get_city(db: Session, city_id: int) -> City:
    city = db.get(City, city_id)
    if not city:
        raise HTTPException(404, "City not found")
    return city


def _check(horizon: int, scenario: str | None) -> str | None:
    if not 0 <= horizon <= 72:
        raise HTTPException(400, "Horizon must be between 0 and 72 hours")
    if scenario and scenario not in risk.SCENARIOS:
        raise HTTPException(400, "Unknown scenario")
    return scenario or None


def _load(db: Session, city: City):
    assets = db.query(Asset).filter(Asset.city_id == city.id).all()
    deps = db.query(Dependency).filter(Dependency.city_id == city.id).all()
    reports = db.query(Report).filter(Report.city_id == city.id).all()
    return assets, deps, reports


def _isolated_hospitals(scored: list[dict], deps: list[Dependency]) -> list[dict]:
    by_id = {a["id"]: a for a in scored}
    access: dict[int, list[dict]] = {}
    for d in deps:
        if d.kind == "access" and d.source_id in by_id:
            access.setdefault(d.target_id, []).append(by_id[d.source_id])
    return [
        {"id": hid, "name": by_id[hid]["name"], "routes": [r["name"] for r in routes]}
        for hid, routes in access.items()
        if by_id.get(hid, {}).get("type") == "hospital"
        and all(r["level"] in ("high", "critical") for r in routes)
    ]


def _overview(db: Session, city: City, horizon: int, scenario: str | None) -> dict:
    assets, deps, reports = _load(db, city)
    scored = risk.score_assets(city, assets, reports, horizon, scenario)
    score = risk.city_score(scored)

    totals = {h: sum(a["by_hazard"][h] for a in scored) for h in risk.HAZARDS}
    grand = sum(totals.values())
    split = {h: round(100 * v / grand) if grand else 0 for h, v in totals.items()}

    tiles = []
    for kind in TILE_TYPES:
        of_type = [a for a in scored if a["type"] == kind]
        at_risk = [a for a in of_type if a["level"] in ("high", "critical")]
        tiles.append(
            {
                "type": kind,
                "total": len(of_type),
                "at_risk": len(at_risk),
                "percent": round(100 * len(at_risk) / len(of_type)) if of_type else 0,
            }
        )

    trend = []
    for h in TREND_HOURS:
        point = scored if h == horizon else risk.score_assets(city, assets, reports, h, scenario)
        trend.append({"hour": h, "score": risk.city_score(point)})

    counts = {lvl: sum(1 for a in scored if a["level"] == lvl) for lvl in ("low", "moderate", "high", "critical")}
    return {
        "city": _city_public(city, len(assets)),
        "horizon": horizon,
        "scenario": scenario,
        "score": score,
        "level": risk.city_level(score),
        "weather": risk.hazard_window(city, horizon, scenario)["raw"],
        "hazard_split": split,
        "tiles": tiles,
        "trend": trend,
        "counts": counts,
        "isolated_hospitals": _isolated_hospitals(scored, deps),
        "assets": scored,
        "_deps": deps,
        "_raw_assets": assets,
    }


def _public_asset(a: dict) -> dict:
    return {
        "id": a["id"], "name": a["name"], "type": a["type"], "lat": a["lat"], "lon": a["lon"],
        "level": risk.public_level(a["level"]),
    }


# ---- city selection -------------------------------------------------------


@router.get("/geocode")
def geocode(q: str = Query(min_length=2), user: User = Depends(current_user)):
    try:
        return citydata.geocode_search(q)
    except httpx.HTTPError:
        raise HTTPException(502, "The place search service is not responding. Try again shortly.")


@router.get("/cities")
def list_cities(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [_city_public(c) for c in db.query(City).order_by(City.created_at.desc()).all()]


@router.post("/cities/load")
def load_city(body: LoadCity, user: User = Depends(current_user), db: Session = Depends(get_db)):
    place = body.model_dump()
    try:
        if body.lat is None or body.lon is None:
            matches = citydata.geocode_search(body.name, count=1)
            if not matches:
                raise HTTPException(404, f'No place called "{body.name}" was found')
            place = matches[0]
        existing = citydata.find_existing(db, place["lat"], place["lon"])
        if existing:
            return _city_public(existing)
        city = citydata.build_city(db, place)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"A data source did not respond ({exc.__class__.__name__}). Try again shortly.")
    audit(db, user.email, "load_city", f"{city.name}, {city.country}")
    return _city_public(city)


@router.post("/cities/{city_id}/refresh")
def refresh(city_id: int, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    city = _get_city(db, city_id)
    try:
        citydata.refresh_weather(db, city)
    except httpx.HTTPError:
        raise HTTPException(502, "The weather service is not responding. Try again shortly.")
    audit(db, user.email, "refresh_weather", city.name)
    hub.broadcast_from_thread({"type": "risk_updated", "city_id": city.id})
    return _city_public(city)


# ---- risk ----------------------------------------------------------------


@router.get("/scenarios")
def scenarios(user: User = Depends(current_user)):
    return [{"id": key, **value} for key, value in risk.SCENARIOS.items()]


@router.get("/cities/{city_id}/overview")
def overview(
    city_id: int,
    horizon: int = 0,
    scenario: str | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    scenario = _check(horizon, scenario)
    if user.role != "admin":
        scenario = None  # stress tests are an admin tool
    data = _overview(db, _get_city(db, city_id), horizon, scenario)
    data.pop("_deps")
    data.pop("_raw_assets")
    if user.role != "admin":
        # Normal users get the simplified picture only.
        data["assets"] = [_public_asset(a) for a in data["assets"]]
        data.pop("isolated_hospitals")
        data["counts"] = {
            "safe": data["counts"]["low"],
            "caution": data["counts"]["moderate"],
            "danger": data["counts"]["high"] + data["counts"]["critical"],
        }
    return data


@router.get("/cities/{city_id}/assets/{asset_id}")
def asset_detail(
    city_id: int,
    asset_id: int,
    horizon: int = 0,
    scenario: str | None = None,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    scenario = _check(horizon, scenario)
    city = _get_city(db, city_id)
    assets, deps, reports = _load(db, city)
    scored = {a["id"]: a for a in risk.score_assets(city, assets, reports, horizon, scenario)}
    if asset_id not in scored:
        raise HTTPException(404, "Asset not found")

    def brief(i: int, kind: str) -> dict:
        return {"id": i, "name": scored[i]["name"], "type": scored[i]["type"], "level": scored[i]["level"], "kind": kind}

    return {
        **scored[asset_id],
        "relies_on": [brief(d.source_id, d.kind) for d in deps if d.target_id == asset_id],
        "supports": [brief(d.target_id, d.kind) for d in deps if d.source_id == asset_id],
        "people": cascade_service.served_population(city, assets).get(asset_id, 0),
    }


@router.post("/cities/{city_id}/cascade")
def cascade(
    city_id: int,
    body: CascadeRequest,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    scenario = _check(body.horizon, body.scenario)
    city = _get_city(db, city_id)
    assets, deps, reports = _load(db, city)
    failed = list(body.failed_ids)
    if body.auto:
        scored = risk.score_assets(city, assets, reports, body.horizon, scenario)
        failed += [a["id"] for a in scored if a["level"] == "critical"]
    if not failed:
        return {"impacted": [], "waves": 0, "links": [], "summary": {"total": 0, "knock_on": 0, "hospitals": 0, "people": 0}}
    return cascade_service.simulate(city, assets, deps, failed)


@router.get("/cities/{city_id}/plan")
def plan(
    city_id: int,
    budget: float | None = Query(default=None, ge=0),
    crews: int | None = Query(default=None, ge=0),
    horizon: int = 0,
    scenario: str | None = None,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    scenario = _check(horizon, scenario)
    city = _get_city(db, city_id)
    assets, deps, reports = _load(db, city)
    scored = risk.score_assets(city, assets, reports, horizon, scenario)
    graph = cascade_service.build_graph(assets, deps)
    served = cascade_service.served_population(city, assets)
    return plan_service.build_plan(scored, graph, served, budget, crews)


@router.get("/cities/{city_id}/brief")
def brief(
    city_id: int,
    horizon: int = 0,
    scenario: str | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    scenario = _check(horizon, scenario)
    is_admin = user.role == "admin"
    if not is_admin:
        scenario = None
    city = _get_city(db, city_id)
    data = _overview(db, city, horizon, scenario)
    plan_data = None
    if is_admin:
        graph = cascade_service.build_graph(data["_raw_assets"], data["_deps"])
        served = cascade_service.served_population(city, data["_raw_assets"])
        plan_data = plan_service.build_plan(data["assets"], graph, served, None, None)
    scenario_name = risk.SCENARIOS[scenario]["name"] if scenario else None
    result = brief_service.make_brief(city.name, horizon, scenario_name, data, plan_data, public=not is_admin)
    return {**result, "generated_at": utcnow().isoformat(), "city": city.name}


@router.get("/cities/{city_id}/route")
def route(
    city_id: int,
    lat: float,
    lon: float,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    city = _get_city(db, city_id)
    assets, _, reports = _load(db, city)
    scored = risk.score_assets(city, assets, reports, 0, None)
    result = routing.safe_route(lat, lon, scored)
    if user.role != "admin":
        for hazard in result["hazards"]:
            hazard["level"] = risk.public_level(hazard["level"])
    return result


def stale(city: City) -> bool:
    if not city.weather_at:
        return True
    # SQLite hands datetimes back without a timezone; they are stored as UTC.
    fetched = city.weather_at.replace(tzinfo=utcnow().tzinfo)
    return utcnow() - fetched > timedelta(minutes=config.REFRESH_MINUTES)
