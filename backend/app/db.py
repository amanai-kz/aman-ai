"""
Database setup using SQLAlchemy async engine and session.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """Base class for ORM models."""


def _make_engine() -> AsyncEngine:
    return create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        future=True,
    )


engine: AsyncEngine = _make_engine()
AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


@asynccontextmanager
async def lifespan_session() -> AsyncIterator[AsyncSession]:
    """
    Provide an async session for FastAPI lifespan hooks.
    Useful when we need a session without dependency injection.
    """
    async with AsyncSessionLocal() as session:
        yield session


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """
    Create database tables if they do not exist.
    This keeps development and tests self-contained; production can
    replace this with Alembic migrations.
    """
    # Import models here so that metadata is populated before create_all
    from app.models import Base as ModelBase  # noqa: WPS433

    async with engine.begin() as conn:
        await conn.run_sync(ModelBase.metadata.create_all)


async def shutdown_db() -> None:
    """Dispose engine on application shutdown."""
    await engine.dispose()
