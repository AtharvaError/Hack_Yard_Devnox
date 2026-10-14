import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .auth import hash_password
from .db import Base, SessionLocal, add_missing_columns, engine
from .live import hub
from .models import City, User
from .routers import admin, auth, city, community, extras
from .services import citydata, demo, photos


def seed_demo_accounts() -> None:
    accounts = [
        (config.DEMO_ADMIN_EMAIL, config.DEMO_ADMIN_PASSWORD, "Demo Admin", "admin"),
        (config.DEMO_USER_EMAIL, config.DEMO_USER_PASSWORD, "Demo User", "user"),
    ]
    with SessionLocal() as db:
        for email, password, name, role in accounts:
            if not db.query(User).filter(User.email == email).first():
                db.add(User(email=email, name=name, password_hash=hash_password(password), role=role))
        db.commit()


def refresh_stale_cities() -> list[int]:
    updated = []
    with SessionLocal() as db:
        for c in db.query(City).all():
            if city.stale(c):
                try:
                    citydata.refresh_weather(db, c)
                    updated.append(c.id)
                except Exception:
                    db.rollback()  # a failed refresh keeps the last good forecast
    return updated


async def refresh_loop() -> None:
    while True:
        updated = await asyncio.to_thread(refresh_stale_cities)
        for city_id in updated:
            await hub.broadcast({"type": "risk_updated", "city_id": city_id})
        await asyncio.sleep(60)


def prepare_database() -> None:
    """Creates the tables and the demo accounts and cities. Safe to run more than once."""
    Base.metadata.create_all(engine)
    add_missing_columns()
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    seed_demo_accounts()
    with SessionLocal() as db:
        demo.seed(db)
    photos.reset_interrupted_checks()


# Serverless hosts may not run the lifespan hook, so prepare the database as soon as the code loads.
if os.getenv("VERCEL"):
    prepare_database()


@asynccontextmanager
async def lifespan(app: FastAPI):
    prepare_database()
    task = asyncio.create_task(refresh_loop())
    yield
    task.cancel()


app = FastAPI(title="InfraSentinel API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
for module in (auth, city, community, admin, extras):
    app.include_router(module.router)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.websocket("/ws/live")
async def live(ws: WebSocket):
    await hub.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(ws)
