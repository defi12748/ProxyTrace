from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from proxytrace.contracts.registry import ensure_default_contracts
from proxytrace.db.session import SessionLocal
from proxytrace.proxy.frontend import mount_frontend
from proxytrace.proxy.routes import drift, health, jira, llm, mcp, regression, replay, runs
from proxytrace.settings import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    async with SessionLocal() as session:
        await ensure_default_contracts(session)
        await session.commit()
    yield


app = FastAPI(
    title="ProxyTrace API",
    description="Agent execution tracer and deterministic replay engine.",
    version="0.1.0",
    lifespan=lifespan,
)

_settings = get_settings()
_cors_origins = (
    list(_settings.cors_allowed_origins) if _settings.auth_required else ["*"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=(
        _settings.cors_allow_origin_regex if _settings.auth_required else None
    ),
    allow_credentials=_settings.auth_required,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(runs.router)
app.include_router(llm.router)
app.include_router(mcp.router)
app.include_router(replay.router)
app.include_router(regression.router)
app.include_router(drift.router)
app.include_router(jira.router)

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_FRONTEND_DIST_CANDIDATES = (
    _PROJECT_ROOT / "frontend-v2" / "dist",
    _PROJECT_ROOT / "frontend" / "dist",
)

for _frontend_dist in _FRONTEND_DIST_CANDIDATES:
    if mount_frontend(app, _frontend_dist):
        break
