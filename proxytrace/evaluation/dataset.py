from __future__ import annotations

import json
from pathlib import Path
from typing import Any


LABELS_PATH = Path(__file__).resolve().parents[1] / "data" / "labels.json"


def load_labels(path: Path = LABELS_PATH) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def generate_synthetic_traces(labels: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_trace_from_label(label) for label in labels]


def write_synthetic_traces(
    traces: list[dict[str, Any]],
    output_path: Path,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(traces, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def _trace_from_label(label: dict[str, Any]) -> dict[str, Any]:
    trace_id = label["trace_id"]
    expected = _parse_state(label.get("expected_final_state"))
    actual = _parse_state(label.get("actual_final_state"))
    issue_key = f"EVAL-{trace_id[1:]}"
    summary = _summary_for_label(label)
    description = _description_for_label(label)
    expected_board = expected.get("board") or _board_from_state(expected) or "TRIAGE"
    actual_board = actual.get("board") or _board_from_state(actual) or expected_board
    steps = [
        _llm_step(
            1,
            trace_id,
            summary,
            description,
            label,
        ),
        _tool_step(
            2,
            "get_project_key",
            {
                "issue_key": issue_key,
                "summary": summary,
                "description": description,
            },
            _get_project_key_response(label, expected_board, actual_board),
        ),
        _llm_decision_step(3, trace_id, label, expected_board, actual_board),
        _tool_step(
            4,
            _final_tool_name(label),
            {
                "issue_key": issue_key,
                "board": actual_board,
                "priority": actual.get("priority", "HIGH"),
            },
            {
                "updated": label.get("human_verdict") == "pass",
                "issue_key": issue_key,
                "board": actual_board,
                "priority": actual.get("priority", "HIGH"),
                "status": "synthetic_eval",
            },
        ),
    ]
    return {
        "trace_id": trace_id,
        "run": {
            "run_id": f"synthetic-{trace_id.lower()}",
            "agent_id": "jira-triage-eval",
            "jira_issue_key": issue_key,
            "workspace_id": "synthetic-eval",
            "metadata": {
                "summary": summary,
                "description": description,
                "failure_type": label["failure_type"],
                "expected_final_state": label["expected_final_state"],
                "actual_final_state": label["actual_final_state"],
                "human_verdict": label["human_verdict"],
            },
        },
        "label": label,
        "steps": steps,
        "patch": _patch_for_label(label, expected_board),
    }


def _llm_step(
    step_index: int,
    trace_id: str,
    summary: str,
    description: str,
    label: dict[str, Any],
) -> dict[str, Any]:
    return {
        "step_index": step_index,
        "step_type": "llm",
        "payload": {
            "model": "synthetic-evaluator",
            "messages": [
                {
                    "role": "user",
                    "content": f"{summary}\n\n{description}",
                }
            ],
            "response": {
                "trace_id": trace_id,
                "intended_failure_type": label["failure_type"],
            },
        },
        "snapshot": {},
    }


def _llm_decision_step(
    step_index: int,
    trace_id: str,
    label: dict[str, Any],
    expected_board: str,
    actual_board: str,
) -> dict[str, Any]:
    return {
        "step_index": step_index,
        "step_type": "llm",
        "payload": {
            "model": "synthetic-evaluator",
            "response": {
                "trace_id": trace_id,
                "expected_board": expected_board,
                "selected_board": actual_board,
                "divergence_type": label["divergence_type"],
            },
        },
        "snapshot": {},
    }


def _tool_step(
    step_index: int,
    tool_name: str,
    params: dict[str, Any],
    response: dict[str, Any],
) -> dict[str, Any]:
    return {
        "step_index": step_index,
        "step_type": "tool",
        "tool_name": tool_name,
        "payload": {
            "tool_name": tool_name,
            "params": params,
            "response": response,
            "status": "ok",
        },
        "snapshot": {"params": params},
    }


def _get_project_key_response(
    label: dict[str, Any],
    expected_board: str,
    actual_board: str,
) -> dict[str, Any]:
    if label["failure_type"] == "schema_drift":
        if "projectKey" in label.get("actual_final_state", ""):
            return {"projectKey": actual_board, "confidence": 0.86}
        return {"project_key": {"value": actual_board}, "confidence": 0.86}
    return {
        "project_key": actual_board,
        "expected_project_key": expected_board,
        "confidence": 0.92 if label["human_verdict"] == "pass" else 0.62,
    }


def _final_tool_name(label: dict[str, Any]) -> str:
    actual_state = label.get("actual_final_state", "")
    for candidate in ("search_tickets", "create_ticket", "send_email"):
        if candidate in actual_state:
            return candidate
    return "update_ticket"


def _patch_for_label(label: dict[str, Any], expected_board: str) -> dict[str, Any]:
    if label["human_verdict"] == "pass":
        patch_step = 2
    else:
        patch_step = label.get("root_cause_step") or (label.get("affected_steps") or [2])[0]
    patch_type = "tool_result_patch"
    if label["failure_type"] == "untrusted_context_injection":
        patch_type = "prompt_patch"
    return {
        "patch_step": patch_step,
        "patch_payload": {
            "patch_type": patch_type,
            "value": {
                "response": {"project_key": expected_board},
                "expected_final_state": label.get("expected_final_state"),
            },
            "note": f"Synthetic correction for {label['failure_type']}",
        },
    }


def _summary_for_label(label: dict[str, Any]) -> str:
    failure_type = label["failure_type"].replace("_", " ")
    return f"{label['trace_id']} Jira routing case: {failure_type}"


def _description_for_label(label: dict[str, Any]) -> str:
    return (
        f"Expected final state is {label['expected_final_state']}; "
        f"observed final state is {label['actual_final_state']}."
    )


def _parse_state(value: str | None) -> dict[str, Any]:
    if not value or "=" not in value:
        return {}
    key, raw_value = value.split("=", 1)
    if raw_value.lower() == "true":
        parsed_value: Any = True
    elif raw_value.lower() == "false":
        parsed_value = False
    else:
        parsed_value = raw_value
    return {key: parsed_value}


def _board_from_state(state: dict[str, Any]) -> str | None:
    for value in state.values():
        if isinstance(value, str) and value.isupper():
            return value
    return None
