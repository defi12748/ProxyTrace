from __future__ import annotations

from pathlib import Path

from proxytrace.evaluation.dataset import generate_synthetic_traces, load_labels
from proxytrace.evaluation.report import render_evaluation_report
from proxytrace.evaluation.runner import EvaluationConfig, EvaluationRunner
import json


def test_generate_synthetic_traces_from_labels() -> None:
    labels = load_labels(Path("proxytrace/data/labels.json"))

    traces = generate_synthetic_traces(labels)

    assert len(traces) == 20
    assert traces[0]["trace_id"] == "T001"
    assert traces[0]["steps"][1]["tool_name"] == "get_project_key"
    assert traces[0]["steps"][3]["tool_name"] == "update_ticket"
    assert "reference_steps" in traces[0]
    assert traces[5]["run"]["metadata"].keys() == {"summary", "description"}


def test_evaluation_runner_reports_no_ai_fallback_metrics() -> None:
    traces = generate_synthetic_traces(load_labels(Path("proxytrace/data/labels.json")))

    evaluation = EvaluationRunner(
        config=EvaluationConfig(use_ai=False),
    ).evaluate(traces)

    assert evaluation["total_traces"] == 20
    assert evaluation["metrics"]["replay_determinism_rate"] == 1.0
    assert evaluation["metrics"]["divergence_localization_accuracy"] is None
    assert evaluation["metrics"]["judge_agreement_rate"] is None
    assert evaluation["metrics"]["human_review_rate"] == 1.0
    assert evaluation["metrics"]["fallback_rate"] == 1.0
    assert evaluation["metrics"]["side_effect_blocking_rate"] == 1.0


def test_render_evaluation_report_contains_key_metrics() -> None:
    traces = generate_synthetic_traces(load_labels(Path("proxytrace/data/labels.json")))
    evaluation = EvaluationRunner(
        config=EvaluationConfig(use_ai=False),
    ).evaluate(traces)

    report = render_evaluation_report(evaluation)

    assert "# ProxyTrace Evaluation Report" in report
    assert "- Traces evaluated: 20" in report
    assert "Divergence localization accuracy: N/A" in report
    assert "| T001 | clean_run | pass | n/a | n/a | yes | 0.00 |" in report


def test_evaluators_never_receive_ground_truth_label() -> None:
    trace = generate_synthetic_traces(
        load_labels(Path("proxytrace/data/labels.json"))
    )[5]

    class CapturingScorer:
        enabled = True
        api_key = "fake"

        def score(self, **kwargs):
            material = json.dumps(kwargs, sort_keys=True)
            assert "wrong_tool_argument" not in material
            assert "synthetic_label_oracle" not in material
            return {
                "root_cause_step": 3,
                "divergence_type": "wrong_argument",
                "affected_steps": [4],
                "risk_level": "high",
                "recommendation": "Validate the selected board.",
                "judge_confidence": 0.9,
                "human_review_required": False,
                "source": "gemini_structured_scorer",
            }

    class CapturingJudge:
        api_key = "fake"

        def judge(self, **kwargs):
            assert "label" not in kwargs["trace_context"]
            assert "reference_steps" not in kwargs["trace_context"]
            return {
                "satisfies_expected_outcome": False,
                "judge_confidence": 0.9,
                "human_review_required": False,
                "source": "gemini_semantic_outcome_judge",
            }

    result = EvaluationRunner(
        scorer=CapturingScorer(),
        semantic_judge=CapturingJudge(),
        config=EvaluationConfig(use_ai=True, ai_delay_seconds=0),
    ).evaluate_trace(trace)

    assert result["divergence_localized"] is True
    assert result["semantic_outcome_correct"] is True
