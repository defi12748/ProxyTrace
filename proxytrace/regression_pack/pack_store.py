from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.models import RegressionPackItem, Replay


class RegressionPromotionError(ValueError):
    pass


def build_assertions_from_replay(replay: Replay) -> dict[str, Any]:
    verdict = replay.verdict or {}
    if replay.mode != "exploratory":
        raise RegressionPromotionError("only exploratory replays can be promoted")

    patched_steps = verdict.get("patched_steps") or []
    if not patched_steps:
        raise RegressionPromotionError("replay verdict has no patched_steps")

    diff = verdict.get("diff") or {}
    semantic = diff.get("semantic_outcome_diff") or {}
    patched_final_state = semantic.get("patched_final_state") or {}
    evaluation = verdict.get("evaluation") or {}
    semantic_judgment = evaluation.get("semantic_judgment") or {}
    ai_assertions = semantic_judgment.get("assertions") or {}
    expected_final_state = (
        ai_assertions.get("expected_final_state") or patched_final_state
    )
    expected_final_board = (
        ai_assertions.get("expected_final_board")
        or expected_final_state.get("board")
    )
    expected_tool_sequence = [
        {
            "step_index": step.get("step_index"),
            "tool_name": step.get("tool_name"),
        }
        for step in patched_steps
        if step.get("step_type") == "tool"
    ]

    return {
        "source_replay_id": replay.replay_id,
        "source_run_id": replay.run_id,
        "patch_step": replay.patch_step,
        "patch_payload": replay.patch_payload or {},
        "expected_tool_sequence": expected_tool_sequence,
        "expected_final_state": expected_final_state,
        "expected_final_board": expected_final_board,
        "ai_semantic_assertions": ai_assertions,
        "frozen_trace": patched_steps,
        "evaluation": evaluation,
    }


async def promote_replay(
    session: AsyncSession,
    *,
    replay: Replay,
) -> RegressionPackItem:
    assertions = build_assertions_from_replay(replay)
    item = RegressionPackItem(
        run_id=replay.run_id,
        replay_id=replay.replay_id,
        assertions=assertions,
    )
    session.add(item)
    await session.flush()
    return item


def regression_item_to_dict(item: RegressionPackItem) -> dict[str, Any]:
    return {
        "test_id": item.test_id,
        "run_id": item.run_id,
        "replay_id": item.replay_id,
        "assertions": item.assertions or {},
        "promoted_at": item.promoted_at.isoformat() if item.promoted_at else None,
        "last_run_at": item.last_run_at.isoformat() if item.last_run_at else None,
        "pass_count": item.pass_count,
        "fail_count": item.fail_count,
    }
