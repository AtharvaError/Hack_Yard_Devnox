import math


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def fast_dist_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Equirectangular approximation; fine at city scale and much cheaper."""
    x = math.radians(lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2))
    y = math.radians(lat2 - lat1)
    return 6371000.0 * math.hypot(x, y)


def offset(lat: float, lon: float, north_m: float, east_m: float) -> tuple[float, float]:
    dlat = north_m / 111320.0
    dlon = east_m / (111320.0 * max(math.cos(math.radians(lat)), 0.01))
    return lat + dlat, lon + dlon
