from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.repository import (
    get_regression_item,
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
from proxytrace.proxy.auth import APIContext, require_api_context


router = APIRouter(tags=["regression"])
runner = RegressionRunner()


@router.post("/regression/promote")
async def promote_regression(
    request: RegressionPromoteRequest,
    session: AsyncSession = Depends(get_session),
    context: APIContext = Depends(require_api_context),
) -> dict[str, object]:
    replay = await get_replay(
        session, request.replay_id, workspace_id=context.workspace_id
    )
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
    context: APIContext = Depends(require_api_context),
) -> dict[str, object]:
    items = await list_regression_items(
        session, limit=limit, workspace_id=context.workspace_id
    )
    return {"regressions": [regression_item_to_dict(item) for item in items]}


@router.post("/regression/run-all")
async def run_all_regressions(
    request: RegressionRunAllRequest | None = None,
    session: AsyncSession = Depends(get_session),
    context: APIContext = Depends(require_api_context),
) -> dict[str, object]:
    items = await list_regression_items(
        session, limit=500, workspace_id=context.workspace_id
    )
    result = await runner.run_all(
        session,
        items,
        candidate_traces=(request.candidate_traces if request else {}),
    )
    await session.commit()
    return result


@router.post("/regression/{test_id}/run")
async def run_regression(
    test_id: str,
    request: RegressionRunAllRequest | None = None,
    session: AsyncSession = Depends(get_session),
    context: APIContext = Depends(require_api_context),
) -> dict[str, object]:
    item = await get_regression_item(
        session, test_id, workspace_id=context.workspace_id
    )
    if item is None:
        raise HTTPException(status_code=404, detail="regression test not found")

    candidate_traces = request.candidate_traces if request else {}
    result = await runner.run_item(
        session,
        item,
        candidate_trace=candidate_traces.get(test_id),
    )
    await session.commit()
    return {
        "total": 1,
        "passed": int(result["passed"]),
        "failed": int(not result["passed"]),
        "results": [result],
    }
