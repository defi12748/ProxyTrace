from __future__ import annotations

import argparse
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
        "--traces-out",
        type=Path,
        default=Path("proxytrace/data/synthetic_traces.json"),
    )
    parser.add_argument(
        "--report-out",
        type=Path,
        default=Path("evaluation_report.md"),
    )
    parser.add_argument(
        "--no-ai",
        action="store_true",
        help="Disable Gemini calls and produce fallback/human-review metrics.",
    )
    args = parser.parse_args()

    labels = load_labels(args.labels)
    traces = generate_synthetic_traces(labels)
    write_synthetic_traces(traces, args.traces_out)

    evaluation = EvaluationRunner(
        config=EvaluationConfig(use_ai=not args.no_ai),
    ).evaluate(traces)
    write_evaluation_report(evaluation, args.report_out)

    metrics = evaluation["metrics"]
    print(
        "Wrote "
        f"{len(traces)} traces to {args.traces_out} and report to {args.report_out}. "
        f"judge_agreement={metrics['judge_agreement_rate']:.2f}, "
        f"human_review={metrics['human_review_rate']:.2f}"
    )


if __name__ == "__main__":
    main()
