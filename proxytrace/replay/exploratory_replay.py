from __future__ import annotations

from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.db.models import Replay
from proxytrace.db.repository import fetch_steps, get_run, log_drift_warning
from proxytrace.evaluator.divergence_diff import DivergenceDiff
from proxytrace.evaluator.hybrid_evaluator import HybridEvaluator
from proxytrace.patch.patch_engine import PatchEngine, PatchError
from proxytrace.replay.agent_harness import (
    DecisionGenerator,
    GeminiDecisionGenerator,
    execute_recorded_agent,
)
from proxytrace.replay.firewall import SideEffectFirewall


class ExploratoryReplayEngine:
    def __init__(
        self,
        *,
        patch_engine: PatchEngine | None = None,
        diff_engine: DivergenceDiff | None = None,
        evaluator: HybridEvaluator | None = None,
        firewall: SideEffectFirewall | None = None,
        decision_generator: DecisionGenerator | None = None,
    ) -> None:
        self.patch_engine = patch_engine or PatchEngine()
        self.diff_engine = diff_engine or DivergenceDiff()
        self.evaluator = evaluator or HybridEvaluator()
        self.firewall = firewall or SideEffectFirewall()
        self.decision_generator = decision_generator or GeminiDecisionGenerator()

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
            # PatchEngine owns boundary validation only. It intentionally does not
            # synthesize downstream changes.
            self.patch_engine.apply(
                steps,
                patch_step=patch_step,
                patch_payload=patch_payload,
            )
        except PatchError as exc:
            raise ValueError(str(exc)) from exc

        execution_error: dict[str, str] | None = None
        agent_result: dict[str, Any] | None = None
        runtime: Any = None
        try:
            agent_result, runtime = await execute_recorded_agent(
                run=run,
                steps=steps,
                session=session,
                firewall=self.firewall,
                mode="exploratory",
                patch_step=patch_step,
                patch_payload=patch_payload,
                decision_generator=self.decision_generator,
            )
        except Exception as exc:  # branch failures are persisted for inspection.
            runtime = getattr(exc, "replay_runtime", None)
            execution_error = {
                "type": type(exc).__name__,
                "message": str(exc),
            }

        patched_steps = runtime.events if runtime is not None else []
        for event in patched_steps:
            firewall = event.get("firewall") or {}
            if firewall.get("allowed") is not False:
                continue
            await log_drift_warning(
                session,
                run_id=run_id,
                step_id=event.get("step_id"),
                warning_type="side_effect_blocked",
                details=str(firewall.get("reason") or "Replay firewall blocked tool."),
            )

        diff = self.diff_engine.compare(steps, patched_steps)
        affected_steps = [
            change.get("step_index")
            for change in diff.get("trajectory_diff", {}).get("changes", [])
            if int(change.get("step_index") or 0) > patch_step
        ]
        propagation = {
            "applied": bool(affected_steps),
            "strategy": "current_agent_workflow_reexecution",
            "affected_steps": affected_steps,
        }
        if execution_error is None:
            evaluator_verdict = await self.evaluator.evaluate(
                patch_step=patch_step,
                patch_payload=patch_payload,
                diff=diff,
                trace_context=self._trace_context(
                    run=run,
                    original_steps=steps,
                    patched_steps=patched_steps,
                ),
            )
        else:
            evaluator_verdict = {
                "analysis_available": False,
                "human_review_required": True,
                "source": "replay_execution_failed",
                "failure_reason": execution_error["message"],
                "semantic_judgment": {
                    "assertions": {},
                    "human_review_required": True,
                    "source": "replay_execution_failed",
                },
                "ai_load_bearing": False,
            }

        live_model_call_count = (
            runtime.live_model_call_count if runtime is not None else 0
        )
        live_tool_call_count = runtime.live_tool_call_count if runtime is not None else 0
        verdict = {
            "mode": "exploratory",
            "execution_engine": "current_jira_agent_workflow",
            "execution_status": "completed" if execution_error is None else "failed",
            "execution_error": execution_error,
            "agent_result": agent_result,
            "patch_step": patch_step,
            "patch_payload": patch_payload,
            "patched_steps": patched_steps,
            "propagation": propagation,
            "diff": diff,
            "evaluation": evaluator_verdict,
            "live_call_count": live_model_call_count + live_tool_call_count,
            "live_model_call_count": live_model_call_count,
            "live_tool_call_count": live_tool_call_count,
            "side_effect_block_count": (
                runtime.side_effect_block_count if runtime is not None else 0
            ),
            "unverified_step_count": sum(
                1 for step in patched_steps if step.get("unverified")
            ),
            "probabilistic": live_model_call_count > 0,
            "safety_guarantee": live_tool_call_count == 0,
            "safety_note": (
                "The current agent ran from the patch boundary. Gemini may regenerate "
                "decisions, but all tool calls are intercepted and write tools are "
                "blocked from external execution."
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

    def _trace_context(
        self,
        *,
        run: Any,
        original_steps: list[Any],
        patched_steps: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return {
            "run": {
                "run_id": run.run_id,
                "agent_id": run.agent_id,
                "jira_issue_key": run.jira_issue_key,
                "workspace_id": run.workspace_id,
                "metadata": run.metadata_json or {},
            },
            "original_steps": [
                {
                    "step_index": step.step_index,
                    "step_type": step.step_type,
                    "payload": step.payload or {},
                    "snapshot": step.snapshot or {},
                }
                for step in original_steps
            ],
            "patched_steps": patched_steps,
        }
