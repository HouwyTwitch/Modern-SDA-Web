"""Async database setup (SQLAlchemy 2.0 + SQLite)."""
from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=False, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    # Import models so they register on the metadata before create_all.
    import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_migrate)


def _migrate(sync_conn) -> None:
    """Add columns introduced after the first release (SQLite has no easy ALTER)."""
    from sqlalchemy import inspect

    insp = inspect(sync_conn)
    if "steam_accounts" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("steam_accounts")}
    if "avatar_url" not in cols:
        sync_conn.exec_driver_sql("ALTER TABLE steam_accounts ADD COLUMN avatar_url VARCHAR")


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
