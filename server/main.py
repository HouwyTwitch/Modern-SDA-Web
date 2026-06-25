"""Modern SDA Web — backend API.

Provides Steam Guard code generation and (optionally) live Steam confirmation
syncing. Code generation works entirely offline; confirmation endpoints proxy to
Steam's mobileconf API using credentials supplied per request — nothing is
persisted server-side.

Run:  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import confirmations as conf
import steam_guard

app = FastAPI(title="Modern SDA Web API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- models ----------
class CodeRequest(BaseModel):
    shared_secret: str


class CodeResponse(BaseModel):
    code: str
    expires_in: int


class SessionModel(BaseModel):
    steamid: str
    identity_secret: str
    steam_login_secure: str = Field(..., description="Value of the steamLoginSecure cookie")
    session_id: str = ""
    device_id: str | None = None

    def to_session(self) -> conf.Session:
        return conf.Session(
            steamid=self.steamid,
            identity_secret=self.identity_secret,
            steam_login_secure=self.steam_login_secure,
            session_id=self.session_id,
            device_id=self.device_id,
        )


class ActRequest(BaseModel):
    session: SessionModel
    confirmation_id: str
    nonce: str
    action: str  # "allow" | "cancel"


# ---------- routes ----------
@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "modern-sda-web"}


@app.post("/api/code", response_model=CodeResponse)
def code(req: CodeRequest) -> CodeResponse:
    try:
        return CodeResponse(
            code=steam_guard.generate_code(req.shared_secret),
            expires_in=steam_guard.seconds_remaining(),
        )
    except Exception as exc:  # noqa: BLE001 - surface a clean 400
        raise HTTPException(status_code=400, detail=f"Invalid shared secret: {exc}") from exc


@app.post("/api/confirmations/list")
async def list_confirmations(session: SessionModel) -> dict:
    try:
        items = await conf.list_confirmations(session.to_session())
        return {"confirmations": items}
    except conf.SteamAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@app.post("/api/confirmations/act")
async def act(req: ActRequest) -> dict:
    try:
        ok = await conf.act_on_confirmation(
            req.session.to_session(), req.confirmation_id, req.nonce, req.action
        )
        return {"success": ok}
    except conf.SteamAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
