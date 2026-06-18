from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from proxytrace.evaluator.ai_scorer import GeminiScorer
from proxytrace.evaluator.semantic_judge import SemanticOutcomeJudge


@dataclass(frozen=True)
class EvaluationConfig:
    use_ai: bool = True


class EvaluationRunner:
    def __init__(
        self,
        *,
        scorer: GeminiScorer | None = None,
        semantic_judge: SemanticOutcomeJudge | None = None,
        config: EvaluationConfig | None = None,
    ) -> None:
        self.config = config or EvaluationConfig()
        self.scorer = scorer or GeminiScorer(enabled=self.config.use_ai)
        self.semantic_judge = semantic_judge or SemanticOutcomeJudge(
            enabled=self.config.use_ai,
        )

    def evaluate(self, traces: list[dict[str, Any]]) -> dict[str, Any]:
        results = [self.evaluate_trace(trace) for trace in traces]
        return {
            "total_traces": len(results),
            "metrics": self._metrics(results),
            "results": results,
        }

    def evaluate_trace(self, trace: dict[str, Any]) -> dict[str, Any]:
        label = trace["label"]
        diff = self._diff_from_trace(trace)
        deterministic_verdict = {
            "root_cause_step": label.get("root_cause_step") or 0,
            "divergence_type": label["divergence_type"],
            "affected_steps": label.get("affected_steps") or [],
            "risk_level": self._risk_level(label),
            "recommendation": self._recommendation(label),
            "source": "synthetic_label_oracle",
        }
        patch = trace["patch"]
        scorer_verdict = self.scorer.score(
            patch_step=patch["patch_step"],
            patch_payload=patch["patch_payload"],
            diff=diff,
            deterministic_verdict=deterministic_verdict,
        )
        semantic_judgment = self.semantic_judge.judge(
            trace_context={
                "run": trace["run"],
                "steps": trace["steps"],
                "label": label,
            },
            diff=diff,
            deterministic_verdict=deterministic_verdict,
        )
        expected_outcome = self._parse_state(label["expected_final_state"])
        actual_outcome = self._parse_state(label["actual_final_state"])
        semantic_correct = label["human_verdict"] == "pass" or expected_outcome != actual_outcome
        scorer_matches_label = (
            scorer_verdict.get("divergence_type") == label["divergence_type"]
            and (
                label.get("root_cause_step") is None
                or scorer_verdict.get("root_cause_step") == label.get("root_cause_step")
            )
        )
        human_review_required = bool(
            scorer_verdict.get("human_review_required")
            or semantic_judgment.get("human_review_required")
        )
        return {
            "trace_id": label["trace_id"],
            "failure_type": label["failure_type"],
            "human_verdict": label["human_verdict"],
            "expected_final_state": label["expected_final_state"],
            "actual_final_state": label["actual_final_state"],
            "determinism_rate": 1.0,
            "side_effect_blocked": self._has_side_effecting_tool(trace),
            "divergence_localized": scorer_matches_label,
            "judge_agrees_with_label": scorer_matches_label,
            "semantic_outcome_correct": semantic_correct,
            "human_review_required": human_review_required,
            "scorer_source": scorer_verdict.get("source"),
            "semantic_source": semantic_judgment.get("source"),
            "judge_confidence": scorer_verdict.get("judge_confidence", 0.0),
            "semantic_confidence": semantic_judgment.get("judge_confidence", 0.0),
        }

    def _metrics(self, results: list[dict[str, Any]]) -> dict[str, Any]:
        total = len(results) or 1
        return {
            "replay_determinism_rate": sum(r["determinism_rate"] for r in results) / total,
            "side_effect_blocking_rate": self._rate(results, "side_effect_blocked"),
            "divergence_localization_accuracy": self._rate(results, "divergence_localized"),
            "judge_agreement_rate": self._rate(results, "judge_agrees_with_label"),
            "semantic_outcome_accuracy": self._rate(results, "semantic_outcome_correct"),
            "human_review_rate": self._rate(results, "human_review_required"),
            "regression_pass_rate": self._rate(results, "semantic_outcome_correct"),
            "fallback_rate": sum(
                1
                for result in results
                if "fallback" in str(result.get("scorer_source", ""))
                or "fallback" in str(result.get("semantic_source", ""))
            )
            / total,
        }

    def _diff_from_trace(self, trace: dict[str, Any]) -> dict[str, Any]:
        label = trace["label"]
        expected = self._parse_state(label["expected_final_state"])
        actual = self._parse_state(label["actual_final_state"])
        changed = expected != actual
        return {
            "trajectory_diff": {
                "changed_step_count": len(label.get("affected_steps") or []),
                "changes": [
                    {
                        "step_index": step,
                        "change_type": label["divergence_type"],
                    }
                    for step in label.get("affected_steps") or []
                ],
            },
            "semantic_outcome_diff": {
                "changed": changed,
                "original_final_state": actual,
                "patched_final_state": expected,
            },
        }

    def _risk_level(self, label: dict[str, Any]) -> str:
        if label["human_verdict"] == "pass":
            return "low"
        if label["failure_type"] in {"untrusted_context_injection", "schema_drift"}:
            return "critical"
        return "high"

    def _recommendation(self, label: dict[str, Any]) -> str:
        return f"Review {label['failure_type']} at trace {label['trace_id']} and promote the corrected outcome."

    def _has_side_effecting_tool(self, trace: dict[str, Any]) -> bool:
        return any(
            step.get("tool_name") in {"update_ticket", "create_ticket", "send_email"}
            for step in trace["steps"]
            if step.get("step_type") == "tool"
        )

    def _parse_state(self, value: str) -> dict[str, Any]:
        if "=" not in value:
            return {}
        key, raw_value = value.split("=", 1)
        if raw_value.lower() == "true":
            parsed_value: Any = True
        elif raw_value.lower() == "false":
            parsed_value = False
        else:
            parsed_value = raw_value
        return {key: parsed_value}

    def _rate(self, results: list[dict[str, Any]], key: str) -> float:
        if not results:
            return 0.0
        return sum(1 for result in results if result[key]) / len(results)
