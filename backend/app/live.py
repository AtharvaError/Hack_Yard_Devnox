"""WebSocket hub. Sends small "something changed" events; clients refetch through the authenticated API."""

from anyio import from_thread
from fastapi import WebSocket


class LiveHub:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def broadcast(self, event: dict) -> None:
        for ws in list(self.clients):
            try:
                await ws.send_json(event)
            except Exception:
                self.clients.discard(ws)

    def broadcast_from_thread(self, event: dict) -> None:
        """For normal (sync) route handlers, which FastAPI runs in a worker thread."""
        try:
            from_thread.run(self.broadcast, event)
        except RuntimeError:
            pass


hub = LiveHub()
