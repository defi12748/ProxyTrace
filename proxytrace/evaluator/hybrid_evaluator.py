from __future__ import annotations

import asyncio
from typing import Any

from proxytrace.evaluator.ai_scorer import GeminiScorer
from proxytrace.evaluator.semantic_judge import SemanticOutcomeJudge


class HybridEvaluator:
    def __init__(
        self,
        scorer: GeminiScorer | None = None,
        semantic_judge: SemanticOutcomeJudge | None = None,
    ) -> None:
        self.scorer = scorer or GeminiScorer()
        self.semantic_judge = semantic_judge or SemanticOutcomeJudge(
            enabled=getattr(self.scorer, "enabled", True),
        )

    async def evaluate(
        self,
        *,
        patch_step: int,
        patch_payload: dict[str, Any],
        diff: dict[str, Any],
        trace_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        deterministic_verdict = self.deterministic_verdict(
            patch_step=patch_step,
            patch_payload=patch_payload,
            diff=diff,
        )
        scorer_verdict = await asyncio.to_thread(
            self.scorer.score,
            patch_step=patch_step,
            patch_payload=patch_payload,
            diff=diff,
            deterministic_verdict=deterministic_verdict,
        )
        semantic_judgment = await asyncio.to_thread(
            self.semantic_judge.judge,
            trace_context=trace_context or {},
            diff=diff,
            deterministic_verdict=deterministic_verdict,
        )
        scorer_verdict["deterministic_verdict"] = deterministic_verdict
        scorer_verdict["semantic_judgment"] = semantic_judgment
        scorer_verdict["ai_load_bearing"] = (
            semantic_judgment.get("source") == "gemini_semantic_outcome_judge"
            and bool(semantic_judgment.get("assertions"))
        )
        return scorer_verdict

    def deterministic_verdict(
        self,
        *,
        patch_step: int,
        patch_payload: dict[str, Any],
        diff: dict[str, Any],
    ) -> dict[str, Any]:
        patch_type = patch_payload.get("patch_type", "unknown")
        changed = diff.get("semantic_outcome_diff", {}).get("changed", False)
        changed_steps = diff.get("trajectory_diff", {}).get("changes", [])
        affected_steps = [
            change["step_index"]
            for change in changed_steps
            if change.get("step_index", 0) > patch_step
        ]

        divergence_type = self._divergence_type(patch_type)
        risk_level = "high" if affected_steps else "medium"
        if not changed:
            risk_level = "low"

        return {
            "root_cause_step": patch_step,
            "divergence_type": divergence_type,
            "affected_steps": affected_steps,
            "risk_level": risk_level,
            "recommendation": self._recommendation(patch_type, changed),
            "source": "deterministic_hybrid_evaluator",
        }

    def _divergence_type(self, patch_type: str) -> str:
        if patch_type == "tool_result_patch":
            return "wrong_argument"
        if patch_type == "prompt_patch":
            return "hallucinated_value"
        return "schema_violation"

    def _recommendation(self, patch_type: str, changed: bool) -> str:
        if patch_type == "tool_result_patch" and changed:
            return "Validate tool outputs before side-effecting update_ticket calls."
        if patch_type == "prompt_patch" and changed:
            return "Promote the prompt patch into the agent instruction set and rerun regression traces."
        return "Review the patched step manually; no semantic final-state change was detected."
