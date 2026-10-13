"""Planning extras: the effect of a plan, risk by zone, crew tasks, link import and relief points."""

import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import audit, current_user, require_admin
from ..db import get_db
from ..live import hub
from ..models import Asset, Dependency, Place, Task, User, utcnow
from ..services import cascade as cascade_service
from ..services import citydata
from ..services import plan as plan_service
from ..services import risk
from .city import _check, _get_city, _isolated_hospitals, _load

router = APIRouter(prefix="/api", tags=["extras"])

LINK_KINDS = ("power", "water", "access")
PLACE_KINDS = {"school": "School", "community_centre": "Community hall", "shelter": "Shelter"}
MAX_PLACES = 80


# ---- what if we act ------------------------------------------------------


def _picture(scored: list[dict], deps: list[Dependency]) -> dict:
    score = risk.city_score(scored)
    return {
        "score": score,
        "level": risk.city_level(score),
        "at_risk": sum(1 for a in scored if a["level"] in ("high", "critical")),
        "isolated_hospitals": len(_isolated_hospitals(scored, deps)),
    }


@router.get("/cities/{city_id}/plan/effect")
def plan_effect(
    city_id: int,
    budget: float | None = Query(default=None, ge=0),
    crews: int | None = Query(default=None, ge=0),
    horizon: int = 0,
    scenario: str | None = None,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """The city's risk before and after the plan, assuming every selected action is carried out."""
    scenario = _check(horizon, scenario)
    city = _get_city(db, city_id)
    assets, deps, reports = _load(db, city)
    scored = risk.score_assets(city, assets, reports, horizon, scenario)
    graph = cascade_service.build_graph(assets, deps)
    served = cascade_service.served_population(city, assets)
    full = plan_service.build_plan([dict(a) for a in scored], graph, served, None, None)
    chosen = plan_service.build_plan([dict(a) for a in scored], graph, served, budget, crews)

    after = {a["id"]: dict(a) for a in scored}
    removed: dict[str, float] = {}
    for action in chosen["selected"]:
        asset = after[action["asset_id"]]
        removed[asset["type"]] = removed.get(asset["type"], 0) + asset["score"] - action["risk_after"]
        asset["score"] = action["risk_after"]
        asset["level"] = risk.level_of(asset["score"])
    return {
        "before": _picture(scored, deps),
        "after": _picture(list(after.values()), deps),
        "actions": chosen["totals"]["actions"],
        "cost": chosen["totals"]["cost"],
        "crews": chosen["totals"]["crews"],
        "max_cost": full["totals"]["cost"],
        "by_type": sorted(({"type": t, "removed": round(v)} for t, v in removed.items()), key=lambda r: -r["removed"]),
    }


# ---- risk by zone --------------------------------------------------------

ZONE_NAMES = [["North-west", "North", "North-east"], ["West", "Centre", "East"], ["South-west", "South", "South-east"]]


@router.get("/cities/{city_id}/zones")
def zones(
    city_id: int,
    horizon: int = 0,
    scenario: str | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Splits the analysed area into a three-by-three grid. These are compass zones, not official wards."""
    scenario = _check(horizon, scenario)
    if user.role != "admin":
        scenario = None
    city = _get_city(db, city_id)
    assets, _, reports = _load(db, city)
    scored = risk.score_assets(city, assets, reports, horizon, scenario)
    if not scored:
        return []
    lats, lons = [a["lat"] for a in scored], [a["lon"] for a in scored]
    lat_step = (max(lats) - min(lats)) / 3 or 1
    lon_step = (max(lons) - min(lons)) / 3 or 1
    cells: dict[tuple[int, int], list[dict]] = {}
    for a in scored:
        row = min(int((max(lats) - a["lat"]) / lat_step), 2)
        col = min(int((a["lon"] - min(lons)) / lon_step), 2)
        cells.setdefault((row, col), []).append(a)
    out = []
    for row in range(3):
        for col in range(3):
            members = cells.get((row, col), [])
            at_risk = sum(1 for a in members if a["level"] in ("high", "critical"))
            average = sum(a["score"] for a in members) / len(members) if members else 0
            out.append(
                {
                    "name": ZONE_NAMES[row][col],
                    "row": row,
                    "col": col,
                    "assets": len(members),
                    "at_risk": at_risk,
                    "level": risk.public_level(risk.level_of(average)) if user.role != "admin" else risk.level_of(average),
                    "score": round(average) if user.role == "admin" else None,
                }
            )
    return out


# ---- crew tasks ----------------------------------------------------------


class NewTask(BaseModel):
    asset_id: int
    action: str
    crew: str = ""


class TaskUpdate(BaseModel):
    status: Literal["assigned", "in_progress", "done"] | None = None
    crew: str | None = None


def _task(t: Task) -> dict:
    return {
        "id": t.id, "asset_id": t.asset_id, "asset": t.asset_name, "action": t.action, "crew": t.crew,
        "status": t.status, "created_by": t.created_by, "updated_at": t.updated_at.isoformat(),
    }


@router.get("/cities/{city_id}/tasks")
def list_tasks(city_id: int, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(Task).filter(Task.city_id == city_id).order_by(Task.created_at.desc()).all()
    return [_task(t) for t in rows]


@router.post("/cities/{city_id}/tasks")
def create_task(city_id: int, body: NewTask, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    city = _get_city(db, city_id)
    asset = db.get(Asset, body.asset_id)
    if not asset or asset.city_id != city.id:
        raise HTTPException(404, "Asset not found")
    open_task = (
        db.query(Task).filter(Task.city_id == city.id, Task.asset_id == asset.id, Task.status != "done").first()
    )
    if open_task:
        raise HTTPException(409, "This asset already has an open task")
    task = Task(
        city_id=city.id, asset_id=asset.id, asset_name=asset.name, action=body.action.strip()[:500],
        crew=body.crew.strip()[:120], created_by=user.email,
    )
    db.add(task)
    db.commit()
    audit(db, user.email, "assign_task", f"{asset.name}: {task.crew or 'no crew named'}")
    return _task(task)


@router.patch("/tasks/{task_id}")
def update_task(task_id: int, body: TaskUpdate, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if body.status:
        task.status = body.status
    if body.crew is not None:
        task.crew = body.crew.strip()[:120]
    task.updated_at = utcnow()
    db.commit()
    audit(db, user.email, "update_task", f"{task.asset_name}: {task.status}")
    return _task(task)


@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
    return {"ok": True}


# ---- import real links between assets ------------------------------------


@router.get("/cities/{city_id}/links/export", response_class=PlainTextResponse)
def export_links(city_id: int, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    """The current links as CSV. It doubles as the template for an import."""
    city = _get_city(db, city_id)
    assets, deps, _ = _load(db, city)
    names = {a.id: a.name for a in assets}
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["source", "target", "kind"])
    for d in deps:
        if d.source_id in names and d.target_id in names:
            writer.writerow([names[d.source_id], names[d.target_id], d.kind])
    return buffer.getvalue()


@router.post("/cities/{city_id}/links/import")
async def import_links(
    city_id: int,
    file: UploadFile = File(...),
    replace: bool = Form(False),
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Reads `source,target,kind` rows: the target relies on the source for power, water or road access."""
    city = _get_city(db, city_id)
    raw = await file.read()
    if len(raw) > 1_000_000:
        raise HTTPException(413, "The file is larger than 1 MB")
    try:
        rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
    except UnicodeDecodeError:
        raise HTTPException(400, "Save the file as CSV (UTF-8) and try again")
    if not rows or not {"source", "target", "kind"} <= {k.strip().lower() for k in rows[0] if k}:
        raise HTTPException(400, "The first row must be: source,target,kind")

    assets = db.query(Asset).filter(Asset.city_id == city.id).all()
    by_name = {a.name.strip().lower(): a for a in assets}
    existing = set()
    if replace:
        db.query(Dependency).filter(Dependency.city_id == city.id).delete()
    else:
        existing = {(d.source_id, d.target_id, d.kind) for d in db.query(Dependency).filter(Dependency.city_id == city.id)}

    added, problems = 0, []
    for number, row in enumerate(rows, start=2):
        clean = {k.strip().lower(): (v or "").strip() for k, v in row.items() if k}
        source, target = by_name.get(clean["source"].lower()), by_name.get(clean["target"].lower())
        kind = clean["kind"].lower()
        if not source or not target:
            missing = clean["source"] if not source else clean["target"]
            problems.append(f'Row {number}: no asset called "{missing}"')
        elif kind not in LINK_KINDS:
            problems.append(f'Row {number}: kind must be power, water or access, not "{clean["kind"]}"')
        elif source.id == target.id:
            problems.append(f"Row {number}: an asset cannot rely on itself")
        elif (source.id, target.id, kind) not in existing:
            existing.add((source.id, target.id, kind))
            db.add(Dependency(city_id=city.id, source_id=source.id, target_id=target.id, kind=kind))
            added += 1
    db.commit()
    audit(db, user.email, "import_links", f"{city.name}: {added} added, {len(problems)} skipped, replace={replace}")
    hub.broadcast_from_thread({"type": "risk_updated", "city_id": city.id})
    return {"added": added, "skipped": len(problems), "problems": problems[:20]}


# ---- possible relief points ----------------------------------------------


def fetch_places(lat: float, lon: float, radius_km: float) -> list[dict] | None:
    radius = int(radius_km * 1000)
    elements = citydata._overpass_query(
        f"""
[out:json][timeout:30];
(
  nwr["amenity"~"^(school|community_centre)$"]["name"](around:{radius},{lat},{lon});
  nwr["social_facility"="shelter"](around:{radius},{lat},{lon});
  nwr["emergency"="assembly_point"](around:{radius},{lat},{lon});
);
out center tags 400;
""",
        rounds=1,
    )
    if elements is None:
        return None
    found = []
    for el in elements:
        tags = el.get("tags", {})
        point = el.get("center") or el
        if "lat" not in point or not tags.get("name"):
            continue
        amenity = tags.get("amenity")
        kind = amenity if amenity in ("school", "community_centre") else "shelter"
        found.append({"kind": kind, "name": tags["name"][:200], "lat": point["lat"], "lon": point["lon"]})
    # Community halls and shelters first, then the schools nearest the centre.
    found.sort(key=lambda p: (p["kind"] == "school", (p["lat"] - lat) ** 2 + (p["lon"] - lon) ** 2))
    return found[:MAX_PLACES]


@router.get("/cities/{city_id}/places")
def places(city_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Schools, community halls and shelters that could serve as relief points. Loaded once per city."""
    city = _get_city(db, city_id)
    rows = db.query(Place).filter(Place.city_id == city.id).all()
    if not rows:
        found = fetch_places(city.lat, city.lon, city.radius_km)
        if found is None:
            raise HTTPException(502, "OpenStreetMap is busy right now. Try the relief points again in a minute.")
        rows = [Place(city_id=city.id, **p) for p in found]
        db.add_all(rows)
        db.commit()
    return [
        {"id": p.id, "kind": p.kind, "label": PLACE_KINDS.get(p.kind, "Shelter"), "name": p.name, "lat": p.lat, "lon": p.lon}
        for p in rows
    ]
