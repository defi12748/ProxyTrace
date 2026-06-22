from __future__ import annotations

import argparse
import json
from pathlib import Path

from proxytrace.evaluation.dataset import (
    generate_synthetic_traces,
    load_labels,
    write_synthetic_traces,
)
from proxytrace.evaluation.report import write_evaluation_report
from proxytrace.evaluation.runner import EvaluationConfig, EvaluationRunner


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate ProxyTrace evaluation proof.")
    parser.add_argument(
        "--labels",
        type=Path,
        default=Path("proxytrace/data/labels.json"),
    )
    parser.add_argument(
        "--results-json",
        type=Path,
        default=Path("evaluation_results.json"),
    )
    parser.add_argument(
        "--no-ai",
        action="store_true",
        help="Generate an honest deterministic report with AI metrics marked N/A.",
    )
    parser.add_argument(
        "--traces-out",
        type=Path,
        default=Path("proxytrace/data/synthetic_traces.json"),
    )
    parser.add_argument(
        "--report-out",
        type=Path,
        default=Path("evaluation_report.md"),
    )
    args = parser.parse_args()

    labels = load_labels(args.labels)
    traces = generate_synthetic_traces(labels)
    write_synthetic_traces(traces, args.traces_out)

    evaluation = EvaluationRunner(
        config=EvaluationConfig(use_ai=not args.no_ai),
    ).evaluate(traces)
    write_evaluation_report(evaluation, args.report_out)
    args.results_json.write_text(
        json.dumps(evaluation, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    metrics = evaluation["metrics"]
    print(
        "Wrote "
        f"{len(traces)} traces to {args.traces_out}, report to {args.report_out}, "
        f"and raw results to {args.results_json}. "
        f"judge_agreement={_metric(metrics['judge_agreement_rate'])}, "
        f"human_review={_metric(metrics['human_review_rate'])}"
    )


def _metric(value: float | None) -> str:
    return "N/A" if value is None else f"{value:.2f}"


if __name__ == "__main__":
    main()
