from __future__ import annotations

from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.models import Replay
from proxytrace.db.repository import fetch_steps, get_run
from proxytrace.evaluator.divergence_diff import DivergenceDiff
from proxytrace.evaluator.hybrid_evaluator import HybridEvaluator
from proxytrace.patch.patch_engine import PatchEngine, PatchError


class ExploratoryReplayEngine:
    def __init__(
        self,
        *,
        patch_engine: PatchEngine | None = None,
        diff_engine: DivergenceDiff | None = None,
        evaluator: HybridEvaluator | None = None,
    ) -> None:
        self.patch_engine = patch_engine or PatchEngine()
        self.diff_engine = diff_engine or DivergenceDiff()
        self.evaluator = evaluator or HybridEvaluator()

    async def run(
        self,
        session: AsyncSession,
        *,
        run_id: str,
        patch_step: int,
        patch_payload: dict[str, Any],
    ) -> dict[str, Any]:
        run = await get_run(session, run_id)
        if run is None:
            raise ValueError(f"Run not found: {run_id}")

        steps = await fetch_steps(session, run_id)
        try:
            patch_result = self.patch_engine.apply(
                steps,
                patch_step=patch_step,
                patch_payload=patch_payload,
            )
        except PatchError as exc:
            raise ValueError(str(exc)) from exc

        diff = self.diff_engine.compare(
            steps,
            patch_result["patched_steps"],
        )
        evaluator_verdict = await self.evaluator.evaluate(
            patch_step=patch_step,
            patch_payload=patch_payload,
            diff=diff,
        )

        verdict = {
            "mode": "exploratory",
            "patch_step": patch_step,
            "patch_payload": patch_payload,
            "patched_steps": patch_result["patched_steps"],
            "propagation": patch_result["propagation"],
            "diff": diff,
            "evaluation": evaluator_verdict,
            "live_call_count": 0,
            "unverified_step_count": sum(
                1 for step in patch_result["patched_steps"] if step.get("unverified")
            ),
            "probabilistic": False,
            "safety_note": (
                "Exploratory replay used recorded snapshots plus deterministic patch "
                "propagation. No live tools were called."
            ),
        }

        replay = Replay(
            replay_id=str(uuid4()),
            run_id=run_id,
            mode="exploratory",
            patch_step=patch_step,
            patch_payload=patch_payload,
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
