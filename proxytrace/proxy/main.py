from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from proxytrace.contracts.registry import ensure_default_contracts
from proxytrace.db.session import SessionLocal, init_models
from proxytrace.proxy.routes import health, llm, mcp, regression, replay, runs


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await init_models()
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
