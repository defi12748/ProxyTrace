"""Drift-check routes.

POST /drift/check        - check a single step by step_id (on-demand)
POST /runs/{run_id}/drift/check-all  - re-check every tool step in a run
GET  /runs/{run_id}/drift            - list persisted drift warnings for a run
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.models import Step
from proxytrace.db.repository import get_run, list_warnings, warning_to_dict
from proxytrace.db.session import get_session
from proxytrace.drift.checker import DriftChecker, DriftKind
from proxytrace.proxy.auth import APIContext, require_api_context

router = APIRouter(tags=["drift"])
_checker = DriftChecker()


# --------------------------------------------------------------------------- #
# On-demand single-step check                                                  #
# --------------------------------------------------------------------------- #


@router.post("/drift/check")
async def check_step_drift(
    payload: dict[str, str],
    session: AsyncSession = Depends(get_session),
    context: APIContext = Depends(require_api_context),
) -> dict[str, object]:
    """
    Check a single recorded step for contract drift.

    Request body::

        {"step_id": "<uuid>"}

    Any new findings are persisted to ``drift_warnings``.
    Previously recorded findings for the same step are **not** deduplicated
    here; call this endpoint idempotently only when you know the step has not
    been checked already, or tolerate duplicate warning rows.
    """
    step_id = payload.get("step_id", "").strip()
    if not step_id:
        raise HTTPException(status_code=422, detail="step_id is required")

    step = await session.get(Step, step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="step not found")
    run = await get_run(session, step.run_id)
    if run is None or getattr(run, "workspace_id", context.workspace_id) != context.workspace_id:
        raise HTTPException(status_code=404, detail="step not found")

    result = await _checker.check_step(session, step=step, run_id=step.run_id)
    await session.commit()

    return {
        "step_id": step_id,
        "tool_name": result.tool_name,
        "drifted": result.drifted,
        "findings": [
            {
                "kind": f.kind.value,
                "old_hash": f.old_hash,
                "new_hash": f.new_hash,
                "detail": f.detail,
            }
            for f in result.findings
        ],
    }


# --------------------------------------------------------------------------- #
# Bulk check for a whole run                                                   #
# --------------------------------------------------------------------------- #


@router.post("/runs/{run_id}/drift/check-all")
async def check_run_drift(
    run_id: str,
    session: AsyncSession = Depends(get_session),
    context: APIContext = Depends(require_api_context),
) -> dict[str, object]:
    """
    Re-check every tool step in a run for contract drift.

    Useful after a contract is updated to surface all affected steps at once.
    Returns a summary and the full list of new findings grouped by step.
    """
    run = await get_run(session, run_id)
    if run is None or getattr(run, "workspace_id", context.workspace_id) != context.workspace_id:
        raise HTTPException(status_code=404, detail="run not found")

    result_rows = await session.execute(
        select(Step)
        .where(Step.run_id == run_id, Step.step_type == "tool")
        .order_by(Step.step_index)
    )
    steps: list[Step] = list(result_rows.scalars().all())

    total_checked = 0
    total_drifted = 0
    step_results: list[dict[str, object]] = []

    for step in steps:
        check = await _checker.check_step(session, step=step, run_id=run_id)
        total_checked += 1
        if check.drifted:
            total_drifted += 1
        step_results.append(
            {
                "step_id": step.step_id,
                "step_index": step.step_index,
                "tool_name": check.tool_name,
                "drifted": check.drifted,
                "finding_count": len(check.findings),
                "findings": [
                    {
                        "kind": f.kind.value,
                        "old_hash": f.old_hash,
                        "new_hash": f.new_hash,
                        "detail": f.detail,
                    }
                    for f in check.findings
                ],
            }
        )

    await session.commit()

    return {
        "run_id": run_id,
        "steps_checked": total_checked,
        "steps_drifted": total_drifted,
        "all_clear": total_drifted == 0,
        "results": step_results,
    }


# --------------------------------------------------------------------------- #
# List persisted warnings for a run                                            #
# --------------------------------------------------------------------------- #


@router.get("/runs/{run_id}/drift")
async def get_run_drift_warnings(
    run_id: str,
    session: AsyncSession = Depends(get_session),
    context: APIContext = Depends(require_api_context),
) -> dict[str, object]:
    """
    Return all persisted drift warnings for a run.

    This is a drift-scoped alias for the generic
    ``GET /runs/{run_id}/warnings`` endpoint; it returns the same rows
    filtered to only ``*_drift`` warning types.
    """
    run = await get_run(session, run_id)
    if run is None or getattr(run, "workspace_id", context.workspace_id) != context.workspace_id:
        raise HTTPException(status_code=404, detail="run not found")

    all_warnings = await list_warnings(session, run_id)
    _drift_types = {kind.value for kind in DriftKind}
    drift_warnings = [w for w in all_warnings if w.warning_type in _drift_types]
    
    return {
        "run_id": run_id,
        "drift_warning_count": len(drift_warnings),
        "warnings": [warning_to_dict(w) for w in drift_warnings],
    }
