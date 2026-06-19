from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

from proxytrace.contracts.registry import ensure_default_contracts
from proxytrace.db.session import SessionLocal
from proxytrace.proxy.routes import drift, health, jira, llm, mcp, regression, replay, runs


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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

_FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if _FRONTEND_DIST.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=_FRONTEND_DIST / "assets"),
        name="frontend-assets",
    )

    @app.get("/")
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str = "") -> FileResponse:
        # SPA fallback: any route not already matched by an API router
        # above (health, runs, jira, etc.) gets index.html, and the
        # frontend's own client-side routing (if any) takes it from there.
        return FileResponse(_FRONTEND_DIST / "index.html")