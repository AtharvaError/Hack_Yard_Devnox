"""Replay of a past date.

Fetches the recorded weather and river flow around a past date from Open-Meteo's free archive and shifts
the timestamps so that date lines up with today. The rest of the app then scores it like a live forecast.
"""

from datetime import date, datetime, timedelta, timezone

import httpx

from .. import config

HOURLY = "precipitation,temperature_2m,apparent_temperature,wind_gusts_10m"


def check_date(text: str) -> date:
    day = date.fromisoformat(text)
    if not date(1984, 1, 1) <= day <= date.today() - timedelta(days=10):
        raise ValueError("Pick a date between 1984 and ten days ago")
    return day


def fetch(lat: float, lon: float, day_text: str) -> tuple[dict, dict]:
    day = check_date(day_text)
    with httpx.Client(timeout=40, headers={"User-Agent": config.USER_AGENT}) as client:
        res = client.get(
            "https://archive-api.open-meteo.com/v1/archive",
            params={
                "latitude": lat, "longitude": lon, "hourly": HOURLY, "timezone": "auto",
                "start_date": (day - timedelta(days=3)).isoformat(), "end_date": (day + timedelta(days=6)).isoformat(),
            },
        )
        res.raise_for_status()
        weather = res.json()
        try:
            flood_res = client.get(
                "https://flood-api.open-meteo.com/v1/flood",
                params={
                    "latitude": lat, "longitude": lon, "daily": "river_discharge",
                    "start_date": (day - timedelta(days=90)).isoformat(), "end_date": (day + timedelta(days=7)).isoformat(),
                },
            )
            flood = flood_res.json() if flood_res.status_code == 200 else {}
        except (httpx.HTTPError, ValueError):
            flood = {}

    # Move every timestamp forward so the replayed day is "today" in the city's own time zone.
    local_today = (datetime.now(timezone.utc) + timedelta(seconds=weather.get("utc_offset_seconds", 0))).date()
    shift = local_today - day
    hourly = weather.get("hourly", {})
    hourly["time"] = [(datetime.fromisoformat(t) + shift).strftime("%Y-%m-%dT%H:%M") for t in hourly.get("time", [])]
    daily = flood.get("daily")
    if daily and daily.get("time"):
        utc_shift = datetime.now(timezone.utc).date() - day
        daily["time"] = [(date.fromisoformat(t) + utc_shift).isoformat() for t in daily["time"]]
    return weather, flood
