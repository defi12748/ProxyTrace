from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.repository import (
    complete_run,
    create_run,
    fetch_steps,
    get_run,
    list_warnings,
    list_runs,
    run_to_dict,
    step_to_dict,
    warning_to_dict,
)
from proxytrace.db.session import get_session
from proxytrace.schemas import CompleteRunRequest, StartRunRequest


router = APIRouter(tags=["runs"])


@router.post("/runs")
async def start_run(
    request: StartRunRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    run = await create_run(
        session,
        agent_id=request.agent_id,
        jira_issue_key=request.jira_issue_key,
        workspace_id=request.workspace_id,
        metadata=request.metadata,
    )
    await session.commit()
    return {"run": run_to_dict(run)}


@router.get("/runs")
async def get_runs(
    jira_issue_key: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    runs = await list_runs(session, jira_issue_key=jira_issue_key, limit=limit)
    return {"runs": [run_to_dict(run) for run in runs]}


@router.get("/runs/{run_id}")
async def get_run_detail(
    run_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    run = await get_run(session, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    steps = await fetch_steps(session, run_id)
    return {
        "run": run_to_dict(run),
        "step_count": len(steps),
        "steps": [step_to_dict(step) for step in steps],
    }


@router.get("/runs/{run_id}/steps")
async def get_run_steps(
    run_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    if await get_run(session, run_id) is None:
        raise HTTPException(status_code=404, detail="run not found")
    steps = await fetch_steps(session, run_id)
    return {"steps": [step_to_dict(step) for step in steps]}


@router.get("/runs/{run_id}/warnings")
async def get_run_warnings(
    run_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    if await get_run(session, run_id) is None:
        raise HTTPException(status_code=404, detail="run not found")
    warnings = await list_warnings(session, run_id)
    return {"warnings": [warning_to_dict(warning) for warning in warnings]}


@router.post("/runs/{run_id}/complete")
async def mark_run_complete(
    run_id: str,
    request: CompleteRunRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    run = await complete_run(
        session,
        run_id,
        status=request.status,
        metadata=request.metadata,
    )
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    await session.commit()
    return {"run": run_to_dict(run)}
