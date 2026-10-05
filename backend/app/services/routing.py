"""Safe route to the nearest hospital that is not at risk, using the free public OSRM server."""

import httpx
from fastapi import HTTPException

from .. import config
from .geo import fast_dist_m

OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
HIT_RADIUS_M = 120


def _hits(coords: list[list[float]], risky_links: list[dict]) -> list[dict]:
    found = []
    sampled = coords[:: max(len(coords) // 300, 1)]
    for link in risky_links:
        if any(fast_dist_m(link["lat"], link["lon"], lat, lon) <= HIT_RADIUS_M for lon, lat in sampled):
            found.append({"id": link["id"], "name": link["name"], "type": link["type"], "level": link["level"]})
    return found


def safe_route(lat: float, lon: float, scored: list[dict]) -> dict:
    hospitals = [a for a in scored if a["type"] == "hospital"]
    if not hospitals:
        raise HTTPException(404, "No hospitals are mapped for this city.")
    safe = [h for h in hospitals if h["level"] in ("low", "moderate")]
    pool = safe or hospitals
    target = min(pool, key=lambda h: fast_dist_m(lat, lon, h["lat"], h["lon"]))
    nearest = min(hospitals, key=lambda h: fast_dist_m(lat, lon, h["lat"], h["lon"]))

    try:
        res = httpx.get(
            f"{OSRM_URL}/{lon},{lat};{target['lon']},{target['lat']}",
            params={"overview": "full", "geometries": "geojson", "alternatives": "true"},
            headers={"User-Agent": config.USER_AGENT},
            timeout=25,
        )
        res.raise_for_status()
        routes = res.json().get("routes", [])
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, "The routing service is not responding. Try again shortly.")
    if not routes:
        raise HTTPException(404, "No drivable route found from that point.")

    risky_links = [
        a for a in scored if a["type"] in ("road", "bridge") and a["level"] in ("high", "critical")
    ]
    options = [
        {
            "geometry": r["geometry"],
            "distance_km": round(r["distance"] / 1000, 1),
            "minutes": round(r["duration"] / 60),
            "hazards": _hits(r["geometry"]["coordinates"], risky_links),
        }
        for r in routes
    ]
    best = min(options, key=lambda o: (len(o["hazards"]), o["minutes"]))
    return {
        "hospital": {k: target[k] for k in ("id", "name", "lat", "lon")},
        "hospital_status": "safe" if target in safe else "at risk",
        "skipped_nearest": nearest["name"] if nearest["id"] != target["id"] else None,
        "alternatives_checked": len(options),
        **best,
    }
