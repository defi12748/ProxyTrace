from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.repository import (
    get_replay,
    list_regression_items,
)
from proxytrace.db.session import get_session
from proxytrace.regression_pack.pack_store import (
    RegressionPromotionError,
    promote_replay,
    regression_item_to_dict,
)
from proxytrace.regression_pack.runner import RegressionRunner
from proxytrace.schemas import RegressionPromoteRequest, RegressionRunAllRequest


router = APIRouter(tags=["regression"])
runner = RegressionRunner()


@router.post("/regression/promote")
async def promote_regression(
    request: RegressionPromoteRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    replay = await get_replay(session, request.replay_id)
    if replay is None:
        raise HTTPException(status_code=404, detail="replay not found")
    try:
        item = await promote_replay(session, replay=replay)
    except RegressionPromotionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await session.commit()
    return {"regression": regression_item_to_dict(item)}


@router.get("/regression")
async def list_regression_pack(
    limit: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    items = await list_regression_items(session, limit=limit)
    return {"regressions": [regression_item_to_dict(item) for item in items]}


@router.post("/regression/run-all")
async def run_all_regressions(
    request: RegressionRunAllRequest | None = None,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    items = await list_regression_items(session, limit=500)
    result = await runner.run_all(
        session,
        items,
        candidate_traces=(request.candidate_traces if request else {}),
    )
    await session.commit()
    return result
