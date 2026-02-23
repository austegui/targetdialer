import asyncpg
import os
from typing import Optional

_pool: Optional[asyncpg.Pool] = None


async def create_pool() -> asyncpg.Pool:
    """Create and return an asyncpg connection pool."""
    return await asyncpg.create_pool(
        dsn=os.environ["DATABASE_URL"],
        min_size=2,
        max_size=10,
        command_timeout=60,
    )


async def get_pool() -> asyncpg.Pool:
    """Get the global connection pool (must be initialized via create_pool first)."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call create_pool() first.")
    return _pool


def set_pool(pool: asyncpg.Pool) -> None:
    """Store pool in module-level variable (called from app lifespan)."""
    global _pool
    _pool = pool
