from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.models import (
    DriftWarning,
    RegressionPackItem,
    Replay,
    Run,
    Step,
    ToolContract,
)


def run_to_dict(run: Run) -> dict[str, Any]:
    return {
        "run_id": run.run_id,
        "agent_id": run.agent_id,
        "jira_issue_key": run.jira_issue_key,
        "workspace_id": run.workspace_id,
        "status": run.status,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "metadata": run.metadata_json or {},
    }


def step_to_dict(step: Step) -> dict[str, Any]:
    return {
        "step_id": step.step_id,
        "run_id": step.run_id,
        "step_index": step.step_index,
        "step_type": step.step_type,
        "payload": step.payload or {},
        "snapshot": step.snapshot or {},
        "recorded_at": step.recorded_at.isoformat() if step.recorded_at else None,
    }


def contract_to_dict(contract: ToolContract) -> dict[str, Any]:
    return {
        "tool_name": contract.tool_name,
        "version": contract.version,
        "tool_type": contract.tool_type,
        "input_schema_hash": contract.input_schema_hash,
        "output_schema_hash": contract.output_schema_hash,
        "descriptor_hash": contract.descriptor_hash,
        "side_effect": contract.side_effect,
        "requires_approval": contract.requires_approval,
        "replay_policy": contract.replay_policy,
        "trust_level": contract.trust_level,
    }


def warning_to_dict(warning: DriftWarning) -> dict[str, Any]:
    return {
        "warning_id": warning.warning_id,
        "run_id": warning.run_id,
        "step_id": warning.step_id,
        "warning_type": warning.warning_type,
        "old_hash": warning.old_hash,
        "new_hash": warning.new_hash,
        "surfaced_at": warning.surfaced_at.isoformat()
        if warning.surfaced_at
        else None,
        "details": warning.details,
    }


def replay_to_dict(replay: Replay) -> dict[str, Any]:
    return {
        "replay_id": replay.replay_id,
        "run_id": replay.run_id,
        "mode": replay.mode,
        "patch_step": replay.patch_step,
        "patch_payload": replay.patch_payload or {},
        "verdict": replay.verdict or {},
        "created_at": replay.created_at.isoformat() if replay.created_at else None,
    }


async def create_run(
    session: AsyncSession,
    *,
    agent_id: str,
    jira_issue_key: str | None,
    workspace_id: str,
    metadata: dict[str, Any] | None = None,
) -> Run:
    run = Run(
        agent_id=agent_id,
        jira_issue_key=jira_issue_key,
        workspace_id=workspace_id,
        metadata_json=metadata or {},
    )
    session.add(run)
    await session.flush()
    return run


async def complete_run(
    session: AsyncSession,
    run_id: str,
    *,
    status: str = "completed",
    metadata: dict[str, Any] | None = None,
) -> Run | None:
    run = await get_run(session, run_id)
    if run is None:
        return None
    run.status = status
    run.completed_at = datetime.utcnow()
    if metadata:
        current = dict(run.metadata_json or {})
        current.update(metadata)
        run.metadata_json = current
    await session.flush()
    return run


async def get_run(session: AsyncSession, run_id: str) -> Run | None:
    return await session.get(Run, run_id)


async def list_runs(
    session: AsyncSession,
    *,
    jira_issue_key: str | None = None,
    limit: int = 50,
) -> list[Run]:
    query = select(Run).order_by(desc(Run.started_at)).limit(limit)
    if jira_issue_key:
        query = query.where(Run.jira_issue_key == jira_issue_key)
    result = await session.execute(query)
    return list(result.scalars().all())


async def next_step_index(session: AsyncSession, run_id: str) -> int:
    result = await session.execute(
        select(func.max(Step.step_index)).where(Step.run_id == run_id)
    )
    current = result.scalar_one_or_none()
    return 1 if current is None else int(current) + 1


async def record_step(
    session: AsyncSession,
    *,
    run_id: str,
    step_type: str,
    payload: dict[str, Any],
    snapshot: dict[str, Any] | None = None,
    step_index: int | None = None,
) -> Step:
    index = step_index if step_index is not None else await next_step_index(session, run_id)
    step = Step(
        run_id=run_id,
        step_index=index,
        step_type=step_type,
        payload=payload,
        snapshot=snapshot or {},
    )
    session.add(step)
    await session.flush()
    return step


async def fetch_steps(session: AsyncSession, run_id: str) -> list[Step]:
    result = await session.execute(
        select(Step).where(Step.run_id == run_id).order_by(Step.step_index)
    )
    return list(result.scalars().all())


async def fetch_step(session: AsyncSession, run_id: str, step_index: int) -> Step | None:
    result = await session.execute(
        select(Step).where(Step.run_id == run_id, Step.step_index == step_index)
    )
    return result.scalar_one_or_none()


async def list_warnings(session: AsyncSession, run_id: str) -> list[DriftWarning]:
    result = await session.execute(
        select(DriftWarning)
        .where(DriftWarning.run_id == run_id)
        .order_by(desc(DriftWarning.surfaced_at))
    )
    return list(result.scalars().all())


async def get_replay(session: AsyncSession, replay_id: str) -> Replay | None:
    return await session.get(Replay, replay_id)


async def list_regression_items(
    session: AsyncSession,
    *,
    limit: int = 100,
) -> list[RegressionPackItem]:
    result = await session.execute(
        select(RegressionPackItem)
        .order_by(desc(RegressionPackItem.promoted_at))
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_contract(
    session: AsyncSession, tool_name: str, version: str = "v1"
) -> ToolContract | None:
    return await session.get(ToolContract, {"tool_name": tool_name, "version": version})


async def log_drift_warning(
    session: AsyncSession,
    *,
    run_id: str,
    warning_type: str,
    step_id: str | None = None,
    old_hash: str | None = None,
    new_hash: str | None = None,
    details: str = "",
) -> DriftWarning:
    # Deduplicate: return the existing row if this (step_id, warning_type)
    # combination has already been recorded, so repeated calls to check_step
    # on the same step are idempotent.
    if step_id is not None:
        existing = await session.execute(
            select(DriftWarning).where(
                DriftWarning.step_id == step_id,
                DriftWarning.warning_type == warning_type,
            )
        )
        row = existing.scalar_one_or_none()
        if row is not None:
            return row

    warning = DriftWarning(
        run_id=run_id,
        step_id=step_id,
        warning_type=warning_type,
        old_hash=old_hash,
        new_hash=new_hash,
        details=details,
    )
    session.add(warning)
    await session.flush()
    return warning
