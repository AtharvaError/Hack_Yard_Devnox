import math


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def fast_dist_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Equirectangular approximation; fine at city scale and much cheaper."""
    x = math.radians(lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2))
    y = math.radians(lat2 - lat1)
    return 6371000.0 * math.hypot(x, y)


def offset(lat: float, lon: float, north_m: float, east_m: float) -> tuple[float, float]:
    dlat = north_m / 111320.0
    dlon = east_m / (111320.0 * max(math.cos(math.radians(lat)), 0.01))
    return lat + dlat, lon + dlon
