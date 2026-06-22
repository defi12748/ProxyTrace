from __future__ import annotations

from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.models import Replay
from proxytrace.db.repository import fetch_steps, get_run, log_drift_warning
from proxytrace.replay.agent_harness import execute_recorded_agent
from proxytrace.replay.firewall import SideEffectFirewall


def step_signature_from_recorded(step: Any) -> tuple[str, str | None]:
    payload = step.payload or {}
    tool_name = payload.get("tool_name") if step.step_type == "tool" else None
    return (step.step_type, tool_name)


def step_signature_from_replayed(step: dict[str, Any]) -> tuple[str, str | None]:
    if isinstance(step.get("actual_signature"), (list, tuple)):
        signature = step["actual_signature"]
        return (str(signature[0]), signature[1])
    tool_name = step.get("tool_name") if step.get("step_type") == "tool" else None
    return (str(step.get("step_type")), tool_name)


def calculate_determinism_rate(
    recorded_signatures: list[tuple[str, str | None]],
    replayed_signatures: list[tuple[str, str | None]],
) -> dict[str, Any]:
    total = max(len(recorded_signatures), len(replayed_signatures))
    if total == 0:
        return {"rate": 0.0, "matching_steps": 0, "total_steps": 0, "mismatches": []}

    matching_steps = 0
    mismatches: list[dict[str, Any]] = []
    for index in range(total):
        recorded = recorded_signatures[index] if index < len(recorded_signatures) else None
        replayed = replayed_signatures[index] if index < len(replayed_signatures) else None
        if recorded == replayed:
            matching_steps += 1
        else:
            mismatches.append(
                {
                    "position": index + 1,
                    "recorded": recorded,
                    "replayed": replayed,
                }
            )

    return {
        "rate": matching_steps / total,
        "matching_steps": matching_steps,
        "total_steps": total,
        "mismatches": mismatches,
    }


class StrictReplayEngine:
    def __init__(self, firewall: SideEffectFirewall | None = None) -> None:
        self.firewall = firewall or SideEffectFirewall()

    async def run(self, session: AsyncSession, run_id: str) -> dict[str, Any]:
        run = await get_run(session, run_id)
        if run is None:
            raise ValueError(f"Run not found: {run_id}")

        steps = await fetch_steps(session, run_id)
        execution_error: dict[str, str] | None = None
        agent_result: dict[str, Any] | None = None
        runtime: Any = None
        try:
            agent_result, runtime = await execute_recorded_agent(
                run=run,
                steps=steps,
                session=session,
                firewall=self.firewall,
                mode="strict",
            )
        except Exception as exc:  # replay failures are evidence, not API crashes.
            runtime = getattr(exc, "replay_runtime", None)
            execution_error = {
                "type": type(exc).__name__,
                "message": str(exc),
            }

        replayed_steps = runtime.events if runtime is not None else []
        for event in replayed_steps:
            firewall = event.get("firewall") or {}
            if firewall.get("allowed") is not False:
                continue
            await log_drift_warning(
                session,
                run_id=run_id,
                step_id=event.get("step_id"),
                warning_type="side_effect_blocked",
                old_hash=(event.get("payload", {}).get("contract") or {}).get(
                    "descriptor_hash"
                ),
                details=str(firewall.get("reason") or "Replay firewall blocked tool."),
            )

        recorded_signatures = [step_signature_from_recorded(step) for step in steps]
        replayed_signatures = [
            step_signature_from_replayed(step) for step in replayed_steps
        ]
        determinism = calculate_determinism_rate(
            recorded_signatures,
            replayed_signatures,
        )
        request_total = max(len(steps), len(replayed_steps))
        request_matches = sum(
            1 for event in replayed_steps if event.get("request_matched") is True
        )
        request_match_rate = request_matches / request_total if request_total else 0.0
        side_effect_block_count = (
            runtime.side_effect_block_count if runtime is not None else 0
        )
        live_model_call_count = (
            runtime.live_model_call_count if runtime is not None else 0
        )
        live_tool_call_count = runtime.live_tool_call_count if runtime is not None else 0
        live_call_count = live_model_call_count + live_tool_call_count
        execution_completed = execution_error is None
        safety_guarantee = live_call_count == 0

        verdict = {
            "mode": "strict",
            "execution_engine": "current_jira_agent_workflow",
            "execution_status": "completed" if execution_completed else "failed",
            "execution_error": execution_error,
            "agent_result": agent_result,
            "determinism_rate": determinism["rate"],
            "determinism": determinism,
            "request_match_rate": request_match_rate,
            "request_matches": request_matches,
            "live_call_count": live_call_count,
            "live_model_call_count": live_model_call_count,
            "live_tool_call_count": live_tool_call_count,
            "side_effect_block_count": side_effect_block_count,
            "recorded_step_count": len(steps),
            "replayed_step_count": len(replayed_steps),
            "replayed_steps": replayed_steps,
            "safety_guarantee": safety_guarantee,
            "safety_note": (
                "The current agent workflow executed against recorded interceptors; "
                "no model or tool provider was contacted."
            ),
        }

        replay = Replay(
            replay_id=str(uuid4()),
            run_id=run_id,
            mode="strict",
            patch_payload={},
            verdict=verdict,
        )
        session.add(replay)
        await session.flush()
        await session.commit()

        return {
            "replay_id": replay.replay_id,
            "run_id": run_id,
            "verdict": verdict,
        }
