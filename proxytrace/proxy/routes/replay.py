from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.session import get_session
from proxytrace.replay.strict_replay import StrictReplayEngine
from proxytrace.schemas import StrictReplayRequest


router = APIRouter(tags=["replay"])
engine = StrictReplayEngine()


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

