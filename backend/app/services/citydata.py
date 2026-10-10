"""Fetches everything a city needs from free public APIs and stores it.

Sources (all free, no key):
  - Open-Meteo geocoding  -> city name to coordinates
  - OpenStreetMap Overpass -> infrastructure assets and waterways
  - Open-Meteo elevation  -> elevation and slope (Copernicus DEM, 90 m)
  - Open-Meteo forecast   -> rain, heat, wind
  - Open-Meteo flood      -> river discharge (GloFAS)
"""

import math
import time

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import config
from ..models import Asset, City, Dependency, utcnow
from . import demo
from .geo import fast_dist_m, offset

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]

# Per-type caps keep the first load of a big city within about a minute.
TYPE_CAPS = {
    "hospital": 40,
    "substation": 30,
    "power_plant": 6,
    "bridge": 40,
    "road": 40,
    "water": 20,
    "fire_station": 15,
}
SLOPE_SAMPLE_M = 180.0
MAX_WATER_POINTS = 4000


def _client(timeout: float = 30.0) -> httpx.Client:
    return httpx.Client(timeout=timeout, headers={"User-Agent": config.USER_AGENT})


def geocode_search(query: str, count: int = 6) -> list[dict]:
    with _client(15) as client:
        res = client.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": query, "count": count, "language": "en", "format": "json"},
        )
    res.raise_for_status()
    return [
        {
            "name": r.get("name", ""),
            "country": r.get("country", ""),
            "admin1": r.get("admin1", ""),
            "lat": r["latitude"],
            "lon": r["longitude"],
            "population": r.get("population") or 0,
        }
        for r in res.json().get("results", [])
    ]


def _overpass_query(query: str, rounds: int = 3) -> list[dict] | None:
    """The free Overpass servers are often busy, so try each mirror in turn, a few times over."""
    for attempt in range(rounds):
        for url in OVERPASS_MIRRORS:
            try:
                with _client(40) as client:
                    res = client.post(url, data={"data": query})
                if res.status_code == 200:
                    return res.json().get("elements", [])
            except (httpx.HTTPError, ValueError):
                continue
        time.sleep(2 * (attempt + 1))
    return None


def _overpass(lat: float, lon: float, radius_m: int) -> list[dict]:
    dlat = radius_m / 111320.0
    dlon = dlat / max(math.cos(math.radians(lat)), 0.01)
    bbox = f"({lat - dlat:.5f},{lon - dlon:.5f},{lat + dlat:.5f},{lon + dlon:.5f})"
    assets = _overpass_query(f"""
[out:json][timeout:35];
(
  nwr["amenity"~"^(hospital|fire_station)$"]{bbox};
  nwr["power"~"^(substation|plant)$"]{bbox};
  nwr["man_made"~"^(water_works|wastewater_plant|pumping_station)$"]{bbox};
  way["bridge"]["highway"~"^(motorway|trunk|primary|secondary)$"]{bbox};
  way["highway"~"^(motorway|trunk|primary)$"]["name"]{bbox};
);
out center tags;
""")
    if assets is None:
        raise HTTPException(502, "OpenStreetMap (Overpass) is busy right now. Please try again in a minute.")
    # Waterways only sharpen the flood score, so the city still loads if this second query fails.
    waterways = _overpass_query(
        f'[out:json][timeout:35];way["waterway"~"^(river|canal|stream)$"]{bbox};out geom;', rounds=1
    )
    return assets + (waterways or [])


def _classify(tags: dict) -> str | None:
    if tags.get("amenity") == "hospital":
        return "hospital"
    if tags.get("amenity") == "fire_station":
        return "fire_station"
    if tags.get("power") == "substation":
        return "substation"
    if tags.get("power") == "plant":
        return "power_plant"
    if tags.get("man_made") in ("water_works", "wastewater_plant", "pumping_station"):
        return "water"
    if tags.get("highway") and tags.get("bridge") and tags.get("bridge") != "no":
        return "bridge"
    if tags.get("highway"):
        return "road"
    return None


TYPE_LABELS = {
    "hospital": "Hospital",
    "fire_station": "Fire station",
    "substation": "Substation",
    "power_plant": "Power plant",
    "water": "Water facility",
    "bridge": "Bridge",
    "road": "Road",
}


def _parse_elements(elements: list[dict], lat: float, lon: float) -> tuple[list[dict], list[tuple[float, float]]]:
    by_type: dict[str, list[dict]] = {t: [] for t in TYPE_CAPS}
    seen_names: set[tuple[str, str]] = set()
    water_points: list[tuple[float, float]] = []

    for el in elements:
        tags = el.get("tags", {})
        if "waterway" in tags and "geometry" in el:
            water_points.extend((p["lat"], p["lon"]) for p in el["geometry"])
            continue
        kind = _classify(tags)
        if not kind:
            continue
        el_lat = el.get("lat") or el.get("center", {}).get("lat")
        el_lon = el.get("lon") or el.get("center", {}).get("lon")
        if el_lat is None or el_lon is None:
            continue
        name = tags.get("name:en") or tags.get("name") or ""
        named = bool(name)
        if not named:
            if kind == "road":
                continue
            name = f"{TYPE_LABELS[kind]} #{str(el['id'])[-5:]}"
        # A long road or bridge is split into many OSM ways; keep one per name.
        key = (kind, name.lower())
        if key in seen_names:
            continue
        seen_names.add(key)
        by_type[kind].append(
            {
                "osm_id": f"{el['type']}/{el['id']}",
                "name": name[:200],
                "type": kind,
                "lat": el_lat,
                "lon": el_lon,
                "named": named,
                "dist": fast_dist_m(lat, lon, el_lat, el_lon),
            }
        )

    assets: list[dict] = []
    for kind, items in by_type.items():
        # Named assets first, then closest to the centre.
        items.sort(key=lambda a: (not a["named"], a["dist"]))
        assets.extend(items[: TYPE_CAPS[kind]])

    if len(water_points) > MAX_WATER_POINTS:
        step = len(water_points) // MAX_WATER_POINTS + 1
        water_points = water_points[::step]
    return assets, water_points


def _elevations(points: list[tuple[float, float]]) -> list[float]:
    out: list[float] = []
    with _client(30) as client:
        for i in range(0, len(points), 100):
            chunk = points[i : i + 100]
            res = client.get(
                "https://api.open-meteo.com/v1/elevation",
                params={
                    "latitude": ",".join(f"{p[0]:.5f}" for p in chunk),
                    "longitude": ",".join(f"{p[1]:.5f}" for p in chunk),
                },
            )
            res.raise_for_status()
            out.extend(float(v) if v is not None else 0.0 for v in res.json()["elevation"])
    return out


def _add_terrain(assets: list[dict], water_points: list[tuple[float, float]]) -> None:
    samples: list[tuple[float, float]] = []
    for a in assets:
        samples.append((a["lat"], a["lon"]))
        samples.append(offset(a["lat"], a["lon"], SLOPE_SAMPLE_M, 0))
        samples.append(offset(a["lat"], a["lon"], 0, SLOPE_SAMPLE_M))
    elev = _elevations(samples)
    for i, a in enumerate(assets):
        here, north, east = elev[3 * i], elev[3 * i + 1], elev[3 * i + 2]
        a["elevation"] = here
        a["slope"] = ((north - here) ** 2 + (east - here) ** 2) ** 0.5 / SLOPE_SAMPLE_M
        a["water_dist_m"] = (
            min(fast_dist_m(a["lat"], a["lon"], w[0], w[1]) for w in water_points) if water_points else 99999.0
        )


def fetch_weather(lat: float, lon: float) -> tuple[dict, dict]:
    with _client(30) as client:
        weather = client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "hourly": "precipitation,temperature_2m,apparent_temperature,wind_gusts_10m",
                "past_days": 3,
                "forecast_days": 6,
                "timezone": "auto",
            },
        )
        weather.raise_for_status()
        try:
            flood_res = client.get(
                "https://flood-api.open-meteo.com/v1/flood",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "daily": "river_discharge",
                    "past_days": 90,
                    "forecast_days": 7,
                },
            )
            flood = flood_res.json() if flood_res.status_code == 200 else {}
        except (httpx.HTTPError, ValueError):
            # River discharge is unavailable away from modelled rivers; rain still drives flood risk.
            flood = {}
    return weather.json(), flood


def refresh_weather(db: Session, city: City) -> None:
    storm = demo.storm_for(city) if city.data_mode == "demo" else None
    city.weather, city.flood = demo.storm_weather(storm) if storm else fetch_weather(city.lat, city.lon)
    city.weather_at = utcnow()
    db.commit()


def _nearest(target: Asset, candidates: list[Asset], count: int = 1, max_m: float = 1e9) -> list[Asset]:
    ranked = sorted(
        ((fast_dist_m(target.lat, target.lon, c.lat, c.lon), c) for c in candidates if c.id != target.id),
        key=lambda pair: pair[0],
    )
    return [c for dist, c in ranked[:count] if dist <= max_m]


def _infer_dependencies(db: Session, city: City, assets: list[Asset]) -> None:
    """OSM does not record which asset feeds which, so links are estimated by proximity."""
    by_type: dict[str, list[Asset]] = {}
    for a in assets:
        by_type.setdefault(a.type, []).append(a)
    substations = by_type.get("substation", [])
    water = by_type.get("water", [])
    links = by_type.get("road", []) + by_type.get("bridge", [])
    plants = by_type.get("power_plant", [])

    def link(source: Asset, target: Asset, kind: str) -> None:
        db.add(Dependency(city_id=city.id, source_id=source.id, target_id=target.id, kind=kind))

    for a in assets:
        if a.type in ("hospital", "water", "fire_station"):
            for s in _nearest(a, substations):
                link(s, a, "power")
        if a.type == "substation":
            for p in _nearest(a, plants, max_m=15000):
                link(p, a, "power")
        if a.type == "hospital":
            for w in _nearest(a, water):
                link(w, a, "water")
        if a.type in ("hospital", "fire_station"):
            for r in _nearest(a, links, count=2, max_m=2500):
                link(r, a, "access")
    db.commit()


def find_existing(db: Session, lat: float, lon: float) -> City | None:
    for city in db.query(City).all():
        if fast_dist_m(lat, lon, city.lat, city.lon) < 2000:
            return city
    return None


def build_city(db: Session, place: dict) -> City:
    lat, lon = place["lat"], place["lon"]
    radius_km = config.CITY_RADIUS_KM

    elements = _overpass(lat, lon, int(radius_km * 1000))
    raw_assets, water_points = _parse_elements(elements, lat, lon)
    if not raw_assets:
        raise HTTPException(404, "No mapped infrastructure found here in OpenStreetMap. Try a larger nearby city.")
    _add_terrain(raw_assets, water_points)
    weather, flood = fetch_weather(lat, lon)

    city = City(
        name=place["name"],
        country=place.get("country", ""),
        admin1=place.get("admin1", ""),
        lat=lat,
        lon=lon,
        population=place.get("population") or 0,
        radius_km=radius_km,
        weather=weather,
        flood=flood,
        weather_at=utcnow(),
    )
    db.add(city)
    db.flush()
    assets = [
        Asset(
            city_id=city.id,
            osm_id=a["osm_id"],
            name=a["name"],
            type=a["type"],
            lat=a["lat"],
            lon=a["lon"],
            elevation=a["elevation"],
            slope=a["slope"],
            water_dist_m=a["water_dist_m"],
        )
        for a in raw_assets
    ]
    db.add_all(assets)
    db.commit()
    _infer_dependencies(db, city, assets)
    return city
