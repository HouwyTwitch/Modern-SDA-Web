"""Application configuration.

Secrets are read from the environment. For local development we generate and
persist a master key + JWT secret to gitignored files so restarts keep working
without manual setup. In production, ALWAYS set SERVER_MASTER_KEY and JWT_SECRET
to strong random values via the environment.
"""
from __future__ import annotations

import os
import secrets
from functools import lru_cache
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def _persisted_secret(filename: str, nbytes: int = 32) -> str:
    """Return a hex secret, generating + persisting it on first use (dev only)."""
    path = BASE_DIR / filename
    if path.exists():
        return path.read_text().strip()
    value = secrets.token_hex(nbytes)
    path.write_text(value)
    path.chmod(0o600)
    return value


class Settings:
    def __init__(self) -> None:
        self.database_url: str = os.getenv(
            "DATABASE_URL", f"sqlite+aiosqlite:///{BASE_DIR / 'modern_sda.db'}"
        )
        # 32-byte hex keys.
        self.server_master_key_hex: str = os.getenv(
            "SERVER_MASTER_KEY"
        ) or _persisted_secret(".dev_master.key")
        self.jwt_secret: str = os.getenv("JWT_SECRET") or _persisted_secret(".dev_jwt.key")
        self.jwt_algorithm: str = "HS256"
        self.jwt_ttl_minutes: int = int(os.getenv("JWT_TTL_MINUTES", "720"))  # 12h
        # How long a user's password-derived key stays cached in memory.
        self.unlock_ttl_minutes: int = int(os.getenv("UNLOCK_TTL_MINUTES", "60"))
        self.cors_origins: list[str] = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")

    @property
    def server_master_key(self) -> bytes:
        return bytes.fromhex(self.server_master_key_hex)


@lru_cache
def get_settings() -> Settings:
    return Settings()
