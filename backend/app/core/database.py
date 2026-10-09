"""Async SQLAlchemy engine, session factory and FastAPI session dependency."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

# The engine connects lazily: no connection is opened until first use.
engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
