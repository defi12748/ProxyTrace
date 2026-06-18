from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.session import get_session
from proxytrace.replay.exploratory_replay import ExploratoryReplayEngine
from proxytrace.replay.strict_replay import StrictReplayEngine
from proxytrace.schemas import (
    ExploratoryReplayForRunRequest,
    ExploratoryReplayRequest,
    StrictReplayRequest,
)


router = APIRouter(tags=["replay"])
engine = StrictReplayEngine()
exploratory_engine = ExploratoryReplayEngine()


@router.post("/replay/strict")
async def strict_replay(
    request: StrictReplayRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    try:
        return await engine.run(session, request.run_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/runs/{run_id}/replay/strict")
async def strict_replay_by_run_id(
    run_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    try:
        return await engine.run(session, run_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/replay/exploratory")
async def exploratory_replay(
    request: ExploratoryReplayRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    try:
        return await exploratory_engine.run(
            session,
            run_id=request.run_id,
            patch_step=request.patch_step,
            patch_payload=request.patch.model_dump(mode="json"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/runs/{run_id}/replay/exploratory")
async def exploratory_replay_by_run_id(
    run_id: str,
    request: ExploratoryReplayForRunRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    try:
        return await exploratory_engine.run(
            session,
            run_id=run_id,
            patch_step=request.patch_step,
            patch_payload=request.patch.model_dump(mode="json"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
