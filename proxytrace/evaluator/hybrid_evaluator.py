from __future__ import annotations

from typing import Any


class HybridEvaluator:
    def evaluate(
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
            "judge_confidence": 0.72 if changed else 0.61,
            "human_review_required": (0.72 if changed else 0.61) < 0.7,
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
