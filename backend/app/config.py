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
# Set to true when the site is served over https, so the session cookie is never sent over plain http.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

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

USER_AGENT = "InfraSentinel/0.1 (hackathon prototype; localhost)"

# Citizen report photos.
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))
MAX_PHOTOS = 3
MAX_PHOTO_BYTES = 5 * 1024 * 1024
REPORTS_PER_DAY = int(os.getenv("REPORTS_PER_DAY", "10"))

# AI photo check. The provider is worked out from the key (xai-… = Grok, gsk_… = Groq, AIza… = Gemini)
# unless VISION_PROVIDER says otherwise. With no key, reports get the basic checks only.
VISION_API_KEY = os.getenv("VISION_API_KEY", "")
VISION_PROVIDER = os.getenv("VISION_PROVIDER", "").strip().lower()
VISION_MODEL = os.getenv("VISION_MODEL", "").strip()
VISION_BASE_URL = os.getenv("VISION_BASE_URL", "").strip().rstrip("/")
