from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def write_evaluation_report(
    evaluation: dict[str, Any],
    output_path: Path,
) -> None:
    output_path.write_text(render_evaluation_report(evaluation), encoding="utf-8")


def render_evaluation_report(evaluation: dict[str, Any]) -> str:
    metrics = evaluation["metrics"]
    results = evaluation["results"]
    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    lines = [
        "# ProxyTrace Evaluation Report",
        "",
        f"Generated: {generated_at}",
        "",
        "## Summary",
        "",
        f"- Traces evaluated: {evaluation['total_traces']}",
        f"- Replay determinism rate: {_pct(metrics['replay_determinism_rate'])}",
        f"- Side-effect blocking rate: {_pct(metrics['side_effect_blocking_rate'])}",
        f"- Divergence localization accuracy: {_pct(metrics['divergence_localization_accuracy'])}",
        f"- Judge agreement rate: {_pct(metrics['judge_agreement_rate'])}",
        f"- Semantic outcome accuracy: {_pct(metrics['semantic_outcome_accuracy'])}",
        f"- Human-review rate: {_pct(metrics['human_review_rate'])}",
        f"- Regression pass rate: {_pct(metrics['regression_pass_rate'])}",
        f"- Gemini fallback rate: {_pct(metrics['fallback_rate'])}",
        "",
        "## Notes",
        "",
        "- Synthetic traces are generated from `proxytrace/data/labels.json`.",
        "- Gemini scorer and semantic judge are called when `GEMINI_API_KEY` is configured.",
        "- Fallback results are retained in the report so missing credentials do not hide evaluation gaps.",
        "",
        "## Trace Results",
        "",
        "| Trace | Failure Type | Human Verdict | Localized | Semantic Correct | Human Review | Confidence | Source |",
        "|---|---|---:|---:|---:|---:|---:|---|",
    ]
    for result in results:
        lines.append(
            "| {trace_id} | {failure_type} | {human_verdict} | {localized} | "
            "{semantic} | {review} | {confidence:.2f} | {source} |".format(
                trace_id=result["trace_id"],
                failure_type=result["failure_type"],
                human_verdict=result["human_verdict"],
                localized=_yes_no(result["divergence_localized"]),
                semantic=_yes_no(result["semantic_outcome_correct"]),
                review=_yes_no(result["human_review_required"]),
                confidence=float(result["judge_confidence"] or 0.0),
                source=result["scorer_source"],
            )
        )
    lines.append("")
    return "\n".join(lines)


def _pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def _yes_no(value: bool) -> str:
    return "yes" if value else "no"
