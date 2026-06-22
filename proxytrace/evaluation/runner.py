from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from types import SimpleNamespace
import time
from typing import Any

from proxytrace.evaluator.ai_scorer import GeminiScorer
from proxytrace.evaluator.semantic_judge import SemanticOutcomeJudge
from proxytrace.replay.firewall import SideEffectFirewall
from proxytrace.replay.strict_replay import calculate_determinism_rate


@dataclass(frozen=True)
class EvaluationConfig:
    use_ai: bool = True
    ai_delay_seconds: float = 4.0


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
        self.firewall = SideEffectFirewall()

    def evaluate(self, traces: list[dict[str, Any]]) -> dict[str, Any]:
        results = []
        for trace in traces:
            results.append(self.evaluate_trace(trace))
            if self._ai_calls_enabled() and self.config.ai_delay_seconds:
                time.sleep(self.config.ai_delay_seconds)

        return {
            "methodology": {
                "blind_evaluation": True,
                "label_access": "scoring_only_after_model_calls",
                "determinism": "fixture controller rerun from recorded LLM decisions",
                "side_effects": "measured from SideEffectFirewall decisions",
            },
            "total_traces": len(results),
            "metrics": self._metrics(results),
            "results": results,
        }

    def evaluate_trace(self, trace: dict[str, Any]) -> dict[str, Any]:
        # This is the only method scope that retains the ground truth. _blind_view
        # creates a deep copy with no label before either evaluator is invoked.
        label = deepcopy(trace["label"])
        blind_trace = self._blind_view(trace)
        diff = self._diff_from_trace(blind_trace)
        scorer_verdict = self.scorer.score(
            patch_step=0,
            patch_payload={
                "evaluation_mode": "held_out_reference_comparison",
                "note": "No correction patch or ground-truth label is provided.",
            },
            diff=diff,
        )
        semantic_judgment = self.semantic_judge.judge(
            trace_context={
                "run": blind_trace["run"],
                "steps": blind_trace["steps"],
            },
            diff={
                "observed_outcome": diff["semantic_outcome_diff"][
                    "original_final_state"
                ],
                "observed_tool_sequence": diff["trajectory_diff"][
                    "original_tool_sequence"
                ],
            },
        )

        scorer_available = scorer_verdict.get("source") == "gemini_structured_scorer"
        semantic_available = (
            semantic_judgment.get("source") == "gemini_semantic_outcome_judge"
        )
        expected_root = label.get("root_cause_step")
        divergence_match = (
            scorer_verdict.get("divergence_type") == label["divergence_type"]
        ) if scorer_available else None
        localization_match = None
        if scorer_available:
            localization_match = bool(
                divergence_match
                and (
                    expected_root is None
                    or scorer_verdict.get("root_cause_step") == expected_root
                )
            )

        expected_semantic_pass = label["human_verdict"] == "pass"
        semantic_correct = None
        if semantic_available and label["human_verdict"] in {"pass", "fail"}:
            semantic_correct = bool(
                semantic_judgment.get("satisfies_expected_outcome")
                == expected_semantic_pass
            )

        recorded_signatures = self._recorded_signatures(blind_trace["steps"])
        replayed_signatures = self._reexecute_fixture(blind_trace["steps"])
        determinism = calculate_determinism_rate(
            recorded_signatures,
            replayed_signatures,
        )
        side_effect_result = self._measure_side_effect_blocking(blind_trace["steps"])
        regression_passed = self._run_reference_regression(blind_trace)
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
            "determinism_rate": determinism["rate"],
            "determinism": determinism,
            "side_effect_blocked": side_effect_result,
            "divergence_localized": localization_match,
            "judge_agrees_with_label": divergence_match,
            "semantic_outcome_correct": semantic_correct,
            "regression_passed": regression_passed,
            "human_review_required": human_review_required,
            "scorer_source": scorer_verdict.get("source"),
            "semantic_source": semantic_judgment.get("source"),
            "judge_confidence": scorer_verdict.get("judge_confidence", 0.0),
            "semantic_confidence": semantic_judgment.get("judge_confidence", 0.0),
        }

    def _blind_view(self, trace: dict[str, Any]) -> dict[str, Any]:
        blind = {
            "trace_id": trace["trace_id"],
            "run": deepcopy(trace["run"]),
            "steps": deepcopy(trace["steps"]),
            "reference_steps": deepcopy(trace["reference_steps"]),
        }
        assert "label" not in blind
        return blind

    def _metrics(self, results: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "replay_determinism_rate": self._mean(results, "determinism_rate"),
            "side_effect_blocking_rate": self._rate(results, "side_effect_blocked"),
            "divergence_localization_accuracy": self._rate(
                results, "divergence_localized"
            ),
            "judge_agreement_rate": self._rate(results, "judge_agrees_with_label"),
            "semantic_outcome_accuracy": self._rate(
                results, "semantic_outcome_correct"
            ),
            "human_review_rate": self._rate(results, "human_review_required"),
            "regression_pass_rate": self._rate(results, "regression_passed"),
            "fallback_rate": sum(
                1
                for result in results
                if "fallback" in str(result.get("scorer_source", ""))
                or "fallback" in str(result.get("semantic_source", ""))
            )
            / len(results)
            if results
            else 0.0,
            "ai_scored_trace_count": sum(
                1
                for result in results
                if result.get("scorer_source") == "gemini_structured_scorer"
            ),
            "semantic_judged_trace_count": sum(
                1
                for result in results
                if result.get("semantic_source") == "gemini_semantic_outcome_judge"
            ),
        }

    def _diff_from_trace(self, trace: dict[str, Any]) -> dict[str, Any]:
        observed = trace["steps"]
        reference = trace["reference_steps"]
        reference_by_index = {step["step_index"]: step for step in reference}
        observed_by_index = {step["step_index"]: step for step in observed}
        indexes = sorted(set(reference_by_index) | set(observed_by_index))
        changes: list[dict[str, Any]] = []
        for index in indexes:
            actual = observed_by_index.get(index)
            expected = reference_by_index.get(index)
            if actual == expected:
                continue
            changed_fields = self._changed_fields(actual, expected)
            changes.append(
                {
                    "step_index": index,
                    "step_type": (actual or expected or {}).get("step_type"),
                    "observed_tool_name": (actual or {}).get("tool_name"),
                    "reference_tool_name": (expected or {}).get("tool_name"),
                    "changed_fields": changed_fields,
                    "observed": actual,
                    "reference": expected,
                }
            )
        return {
            "trajectory_diff": {
                "original_step_count": len(observed),
                "patched_step_count": len(reference),
                "changed_step_count": len(changes),
                "changes": changes,
                "original_tool_sequence": self._tool_sequence(observed),
                "patched_tool_sequence": self._tool_sequence(reference),
            },
            "semantic_outcome_diff": {
                "original_final_state": self._final_state(observed),
                "patched_final_state": self._final_state(reference),
                "changed": self._final_state(observed) != self._final_state(reference),
            },
        }

    def _changed_fields(
        self,
        observed: dict[str, Any] | None,
        reference: dict[str, Any] | None,
    ) -> list[str]:
        if observed is None or reference is None:
            return ["step_presence"]
        fields = []
        if observed.get("step_type") != reference.get("step_type"):
            fields.append("step_type")
        if observed.get("tool_name") != reference.get("tool_name"):
            fields.append("tool_name")
        observed_payload = observed.get("payload") or {}
        reference_payload = reference.get("payload") or {}
        for field in ("messages", "response", "params"):
            if observed_payload.get(field) != reference_payload.get(field):
                fields.append(field)
        return fields

    def _recorded_signatures(
        self, steps: list[dict[str, Any]]
    ) -> list[tuple[str, str | None]]:
        return [
            (
                step["step_type"],
                step.get("tool_name") if step["step_type"] == "tool" else None,
            )
            for step in steps
        ]

    def _reexecute_fixture(
        self, steps: list[dict[str, Any]]
    ) -> list[tuple[str, str | None]]:
        """Run the fixture controller from model decisions, not recorded tool rows."""
        signatures: list[tuple[str, str | None]] = []
        for step in steps:
            if step.get("step_type") != "llm":
                continue
            signatures.append(("llm", None))
            response = (step.get("payload") or {}).get("response") or {}
            next_tool = response.get("next_tool") if isinstance(response, dict) else None
            if next_tool and next_tool != "stop":
                signatures.append(("tool", str(next_tool)))
        return signatures

    def _measure_side_effect_blocking(
        self, steps: list[dict[str, Any]]
    ) -> bool | None:
        decisions = []
        for step in steps:
            if step.get("step_type") != "tool":
                continue
            payload = step.get("payload") or {}
            side_effect = bool((step.get("snapshot") or {}).get("side_effect"))
            tool_type = payload.get("side_effect_class", "read")
            if not side_effect and tool_type not in {"write", "destructive"}:
                continue
            contract = SimpleNamespace(
                tool_type=tool_type,
                side_effect=side_effect,
                replay_policy="mock_only" if side_effect else "mock_from_recording",
                requires_approval=side_effect,
            )
            decisions.append(
                self.firewall.inspect_replay_call(
                    tool_name=str(payload.get("tool_name") or "unknown"),
                    params=payload.get("params") or {},
                    contract=contract,
                )
            )
        if not decisions:
            return None
        return all(not decision.allowed for decision in decisions)

    def _run_reference_regression(self, trace: dict[str, Any]) -> bool:
        expected = self._recorded_signatures(trace["reference_steps"])
        actual = self._reexecute_fixture(trace["reference_steps"])
        return expected == actual

    def _tool_sequence(self, steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {"step_index": step["step_index"], "tool_name": step.get("tool_name")}
            for step in steps
            if step.get("step_type") == "tool"
        ]

    def _final_state(self, steps: list[dict[str, Any]]) -> dict[str, Any]:
        tool_steps = [step for step in steps if step.get("step_type") == "tool"]
        if not tool_steps:
            return {}
        final = tool_steps[-1]
        payload = final.get("payload") or {}
        params = payload.get("params") if isinstance(payload.get("params"), dict) else {}
        response = (
            payload.get("response") if isinstance(payload.get("response"), dict) else {}
        )
        return {
            "tool_name": final.get("tool_name"),
            "issue_key": response.get("issue_key") or params.get("issue_key"),
            "board": response.get("board") or params.get("board"),
            "priority": response.get("priority") or params.get("priority"),
            "updated": response.get("updated"),
            "status": response.get("status"),
        }

    def _ai_calls_enabled(self) -> bool:
        return bool(
            self.config.use_ai
            and getattr(self.scorer, "api_key", "")
            and getattr(self.semantic_judge, "api_key", "")
        )

    def _mean(self, results: list[dict[str, Any]], key: str) -> float | None:
        values = [result[key] for result in results if result.get(key) is not None]
        return sum(values) / len(values) if values else None

    def _rate(self, results: list[dict[str, Any]], key: str) -> float | None:
        values = [result[key] for result in results if result.get(key) is not None]
        return sum(1 for value in values if value) / len(values) if values else None
