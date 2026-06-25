"""Authentication: JWT issuing/verification, the current-user dependency, and an
in-memory cache of users' password-derived keys (so the owner can decrypt their
own secrets during a session without re-entering the password each time)."""
from __future__ import annotations

import time
import uuid

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from db import get_db
from models import User

settings = get_settings()

# session id -> (user_key bytes, expires_at). Cleared on logout / expiry / restart.
_unlock_cache: dict[str, tuple[bytes, float]] = {}


def issue_token(user_id: str) -> tuple[str, str]:
    """Return (jwt, session_id)."""
    sid = str(uuid.uuid4())
    now = int(time.time())
    payload = {
        "sub": user_id,
        "sid": sid,
        "iat": now,
        "exp": now + settings.jwt_ttl_minutes * 60,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, sid


def cache_user_key(sid: str, user_key: bytes) -> None:
    _unlock_cache[sid] = (user_key, time.time() + settings.unlock_ttl_minutes * 60)


def get_cached_user_key(sid: str) -> bytes | None:
    entry = _unlock_cache.get(sid)
    if not entry:
        return None
    key, exp = entry
    if exp < time.time():
        _unlock_cache.pop(sid, None)
        return None
    return key


def clear_session(sid: str) -> None:
    _unlock_cache.pop(sid, None)


class Principal:
    def __init__(self, user: User, sid: str):
        self.user = user
        self.sid = sid

    @property
    def user_key(self) -> bytes | None:
        return get_cached_user_key(self.sid)


async def current_principal(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
) -> Principal:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    user = await db.get(User, payload.get("sub"))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return Principal(user=user, sid=payload.get("sid", ""))


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    res = await db.execute(select(User).where(User.email == email.lower()))
    return res.scalar_one_or_none()
