from __future__ import annotations

from pathlib import Path

from proxytrace.evaluation.dataset import generate_synthetic_traces, load_labels
from proxytrace.evaluation.report import render_evaluation_report
from proxytrace.evaluation.runner import EvaluationConfig, EvaluationRunner


def test_generate_synthetic_traces_from_labels() -> None:
    labels = load_labels(Path("proxytrace/data/labels.json"))

    traces = generate_synthetic_traces(labels)

    assert len(traces) == 20
    assert traces[0]["trace_id"] == "T001"
    assert traces[0]["steps"][1]["tool_name"] == "get_project_key"
    assert traces[0]["steps"][3]["tool_name"] == "update_ticket"
    assert traces[0]["patch"]["patch_payload"]["patch_type"] == "tool_result_patch"


def test_evaluation_runner_reports_no_ai_fallback_metrics() -> None:
    traces = generate_synthetic_traces(load_labels(Path("proxytrace/data/labels.json")))

    evaluation = EvaluationRunner(
        config=EvaluationConfig(use_ai=False),
    ).evaluate(traces)

    assert evaluation["total_traces"] == 20
    assert evaluation["metrics"]["replay_determinism_rate"] == 1.0
    assert evaluation["metrics"]["divergence_localization_accuracy"] == 1.0
    assert evaluation["metrics"]["human_review_rate"] == 1.0
    assert evaluation["metrics"]["fallback_rate"] == 1.0


def test_render_evaluation_report_contains_key_metrics() -> None:
    traces = generate_synthetic_traces(load_labels(Path("proxytrace/data/labels.json")))
    evaluation = EvaluationRunner(
        config=EvaluationConfig(use_ai=False),
    ).evaluate(traces)

    report = render_evaluation_report(evaluation)

    assert "# ProxyTrace Evaluation Report" in report
    assert "- Traces evaluated: 20" in report
    assert "| T001 | clean_run | pass | yes | yes | yes | 0.00 |" in report
