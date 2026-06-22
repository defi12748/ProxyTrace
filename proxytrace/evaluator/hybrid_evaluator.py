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
        deterministic_evidence = self.deterministic_evidence(
            patch_step=patch_step,
            diff=diff,
        )
        scorer_verdict = await asyncio.to_thread(
            self.scorer.score,
            patch_step=patch_step,
            patch_payload=patch_payload,
            diff=diff,
        )
        semantic_judgment = await asyncio.to_thread(
            self.semantic_judge.judge,
            trace_context=trace_context or {},
            diff=diff,
        )
        scorer_verdict["deterministic_evidence"] = deterministic_evidence
        scorer_verdict["semantic_judgment"] = semantic_judgment
        scorer_verdict["ai_load_bearing"] = (
            scorer_verdict.get("source") == "gemini_structured_scorer"
            and scorer_verdict.get("analysis_available", True) is not False
            and semantic_judgment.get("source")
            == "gemini_semantic_outcome_judge"
            and bool(semantic_judgment.get("assertions"))
        )
        return scorer_verdict

    def deterministic_evidence(
        self,
        *,
        patch_step: int,
        diff: dict[str, Any],
    ) -> dict[str, Any]:
        changed = diff.get("semantic_outcome_diff", {}).get("changed", False)
        changed_steps = diff.get("trajectory_diff", {}).get("changes", [])
        affected_steps = [
            change["step_index"]
            for change in changed_steps
            if change.get("step_index", 0) > patch_step
        ]

        return {
            "patched_boundary_step": patch_step,
            "changed_step_indexes": [
                change.get("step_index") for change in changed_steps
            ],
            "changed_after_boundary": affected_steps,
            "final_state_changed": bool(changed),
            "source": "deterministic_diff_only",
        }
