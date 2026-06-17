from __future__ import annotations

from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.contracts.registry import get_contract_or_default
from proxytrace.db.models import Replay
from proxytrace.db.repository import (
    fetch_steps,
    get_run,
    log_drift_warning,
    step_to_dict,
)
from proxytrace.replay.firewall import SideEffectFirewall


def step_signature_from_recorded(step: Any) -> tuple[str, str | None]:
    payload = step.payload or {}
    tool_name = payload.get("tool_name") if step.step_type == "tool" else None
    return (step.step_type, tool_name)


def step_signature_from_replayed(step: dict[str, Any]) -> tuple[str, str | None]:
    tool_name = step.get("tool_name") if step.get("step_type") == "tool" else None
    return (str(step.get("step_type")), tool_name)


def calculate_determinism_rate(
    recorded_signatures: list[tuple[str, str | None]],
    replayed_signatures: list[tuple[str, str | None]],
) -> dict[str, Any]:
    total = len(recorded_signatures)
    if total == 0:
        return {"rate": 0.0, "matching_steps": 0, "total_steps": 0, "mismatches": []}

    matching_steps = 0
    mismatches: list[dict[str, Any]] = []
    for index, recorded in enumerate(recorded_signatures):
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

    if len(replayed_signatures) > total:
        for index, replayed in enumerate(replayed_signatures[total:], start=total + 1):
            mismatches.append(
                {
                    "position": index,
                    "recorded": None,
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
        replayed_steps: list[dict[str, Any]] = []
        side_effect_block_count = 0
        live_call_count = 0

        for step in steps:
            payload = step.payload or {}
            if step.step_type == "llm":
                replayed_steps.append(
                    {
                        "step_index": step.step_index,
                        "step_type": "llm",
                        "source": "recorded_snapshot",
                        "live_call": False,
                        "response": payload.get("response"),
                        "prompt_hash": payload.get("prompt_hash"),
                    }
                )
                continue

            if step.step_type == "tool":
                tool_name = payload.get("tool_name", "unknown")
                params = payload.get("params", {})
                contract = await get_contract_or_default(session, tool_name)
                decision = self.firewall.inspect_replay_call(
                    tool_name=tool_name,
                    params=params,
                    contract=contract,
                )
                if not decision.allowed:
                    side_effect_block_count += 1
                    await log_drift_warning(
                        session,
                        run_id=run_id,
                        step_id=step.step_id,
                        warning_type="side_effect_blocked",
                        old_hash=payload.get("contract", {}).get("descriptor_hash"),
                        new_hash=contract.descriptor_hash,
                        details=decision.reason,
                    )
                replayed_steps.append(
                    {
                        "step_index": step.step_index,
                        "step_type": "tool",
                        "tool_name": tool_name,
                        "source": "recorded_snapshot",
                        "live_call": False,
                        "firewall": {
                            "allowed": decision.allowed,
                            "action": decision.action,
                            "reason": decision.reason,
                            "details": decision.details,
                        },
                        "response": payload.get("response"),
                    }
                )
                continue

            replayed_steps.append(
                {
                    "step_index": step.step_index,
                    "step_type": step.step_type,
                    "source": "recorded_snapshot",
                    "live_call": False,
                    "raw_step": step_to_dict(step),
                }
            )

        recorded_signatures = [step_signature_from_recorded(step) for step in steps]
        replayed_signatures = [
            step_signature_from_replayed(step) for step in replayed_steps
        ]
        determinism = calculate_determinism_rate(
            recorded_signatures,
            replayed_signatures,
        )
        verdict = {
            "mode": "strict",
            "determinism_rate": determinism["rate"],
            "determinism": determinism,
            "live_call_count": live_call_count,
            "side_effect_block_count": side_effect_block_count,
            "step_count": len(steps),
            "replayed_steps": replayed_steps,
            "safety_guarantee": "zero_live_calls",
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
