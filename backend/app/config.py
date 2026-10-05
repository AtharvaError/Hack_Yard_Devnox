import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env_file() -> None:
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file()

JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-secret-change-me")
JWT_HOURS = 12
COOKIE_NAME = "hy_session"

DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
DEMO_ADMIN_EMAIL = os.getenv("DEMO_ADMIN_EMAIL", "admin@hackyard.demo")
DEMO_ADMIN_PASSWORD = os.getenv("DEMO_ADMIN_PASSWORD", "Admin@12345")
DEMO_USER_EMAIL = os.getenv("DEMO_USER_EMAIL", "user@hackyard.demo")
DEMO_USER_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "User@12345")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'hackyard.db').as_posix()}")

CITY_RADIUS_KM = min(float(os.getenv("CITY_RADIUS_KM", "7")), 15.0)
REFRESH_MINUTES = int(os.getenv("REFRESH_MINUTES", "15"))

USER_AGENT = "HackYardDemo/0.1 (hackathon prototype; localhost)"
