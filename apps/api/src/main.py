from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.db import session as db_session


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Create DB pool on startup, close on shutdown."""
    pool = await db_session.create_pool()
    db_session.set_pool(pool)
    yield
    await pool.close()


app = FastAPI(
    title="TargetDialer API",
    description="Vexa integration and AI Worker service for TargetDialer meeting intelligence",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint — verifies service and DB connectivity."""
    pool = await db_session.get_pool()
    async with pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
    return {"status": "ok", "service": "meetrec-api"}
