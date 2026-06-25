"""Database models."""
from __future__ import annotations

import time
import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> float:
    return time.time()


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    password_salt: Mapped[str] = mapped_column(String)
    # Salt for deriving the user's encryption key from their password.
    enc_salt: Mapped[str] = mapped_column(String)
    created_at: Mapped[float] = mapped_column(Float, default=_now)

    accounts: Mapped[list["SteamAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class SteamAccount(Base):
    __tablename__ = "steam_accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    name: Mapped[str] = mapped_column(String)
    steam_id: Mapped[str] = mapped_column(String, default="")
    avatar_color: Mapped[str] = mapped_column(String, default="#1a9fff")
    proxy: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="needs_login")
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)

    # Capability flags (so the API can describe an account without decrypting).
    has_identity: Mapped[bool] = mapped_column(Boolean, default=False)
    has_session: Mapped[bool] = mapped_column(Boolean, default=False)

    last_confirmation: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_login: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[float] = mapped_column(Float, default=_now)
    sort_index: Mapped[int] = mapped_column(Integer, default=0)

    # Envelope-encrypted JSON blob holding shared_secret, identity_secret,
    # refresh_token, password. See vault.py.
    secrets_blob: Mapped[str] = mapped_column(Text)

    user: Mapped["User"] = relationship(back_populates="accounts")
