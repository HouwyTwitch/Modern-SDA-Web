"""Serve the built frontend (../dist) from the API process.

This lets the whole app run as a single server on one port — no separate dev
server, proxy, or CORS needed in production. In development (no dist build) this
is a no-op and the Vite dev server serves the UI instead.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

from config import BASE_DIR

DIST = (BASE_DIR.parent / "dist").resolve()

# Paths owned by the backend / docs — never served as SPA routes.
_RESERVED = ("api", "docs", "redoc", "openapi.json")


def mount_frontend(app: FastAPI) -> bool:
    """Mount the SPA if a build exists. Returns True when mounted."""
    index = DIST / "index.html"
    if not index.is_file():
        return False

    assets = DIST / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        if full_path.startswith(_RESERVED):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = (DIST / full_path).resolve()
        # Serve real files (favicon, etc.); otherwise fall back to index.html
        # so client-side routes work on refresh. Guard against path traversal.
        if full_path and candidate.is_file() and DIST in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index)

    return True
