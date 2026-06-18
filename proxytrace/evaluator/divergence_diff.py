from __future__ import annotations

from copy import deepcopy
from typing import Any


class DivergenceDiff:
    def compare(
        self,
        original_steps: list[Any],
        patched_steps: list[dict[str, Any]],
    ) -> dict[str, Any]:
        original_items = [self._recorded_step_to_item(step) for step in original_steps]
        changes: list[dict[str, Any]] = []
        patched_by_index = {step["step_index"]: step for step in patched_steps}

        for original in original_items:
            patched = patched_by_index.get(original["step_index"])
            if patched is None:
                changes.append(
                    {
                        "step_index": original["step_index"],
                        "change_type": "missing_patched_step",
                        "original": original,
                        "patched": None,
                    }
                )
                continue

            fields = self._changed_fields(original, patched)
            if fields:
                changes.append(
                    {
                        "step_index": original["step_index"],
                        "step_type": original["step_type"],
                        "tool_name": original.get("tool_name"),
                        "change_type": "modified",
                        "changed_fields": fields,
                        "patch_applied": patched.get("patch_applied", False),
                        "unverified": patched.get("unverified", False),
                    }
                )

        original_final_state = self._final_ticket_state(original_items)
        patched_final_state = self._final_ticket_state(patched_steps)

        return {
            "trajectory_diff": {
                "original_step_count": len(original_items),
                "patched_step_count": len(patched_steps),
                "changed_step_count": len(changes),
                "changes": changes,
                "original_tool_sequence": self._tool_sequence(original_items),
                "patched_tool_sequence": self._tool_sequence(patched_steps),
            },
            "semantic_outcome_diff": {
                "original_final_state": original_final_state,
                "patched_final_state": patched_final_state,
                "changed": original_final_state != patched_final_state,
            },
        }

    def _recorded_step_to_item(self, step: Any) -> dict[str, Any]:
        payload = deepcopy(step.payload or {})
        return {
            "step_id": step.step_id,
            "run_id": step.run_id,
            "step_index": step.step_index,
            "step_type": step.step_type,
            "tool_name": payload.get("tool_name") if step.step_type == "tool" else None,
            "payload": payload,
            "snapshot": deepcopy(step.snapshot or {}),
        }

    def _changed_fields(
        self,
        original: dict[str, Any],
        patched: dict[str, Any],
    ) -> list[str]:
        fields: list[str] = []
        original_payload = original.get("payload", {})
        patched_payload = patched.get("payload", {})
        for field in ("system_prompt", "messages", "response", "params"):
            if original_payload.get(field) != patched_payload.get(field):
                fields.append(field)
        if original.get("tool_name") != patched.get("tool_name"):
            fields.append("tool_name")
        return fields

    def _tool_sequence(self, steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {"step_index": step["step_index"], "tool_name": step.get("tool_name")}
            for step in steps
            if step.get("step_type") == "tool"
        ]

    def _final_ticket_state(self, steps: list[dict[str, Any]]) -> dict[str, Any]:
        updates = [
            step for step in steps
            if step.get("step_type") == "tool" and step.get("tool_name") == "update_ticket"
        ]
        if not updates:
            return {}

        payload = updates[-1].get("payload", {})
        params = payload.get("params", {}) if isinstance(payload.get("params"), dict) else {}
        response = (
            payload.get("response", {})
            if isinstance(payload.get("response"), dict)
            else {}
        )
        return {
            "issue_key": response.get("issue_key") or params.get("issue_key"),
            "board": response.get("board") or params.get("board"),
            "updated": response.get("updated"),
            "status": response.get("status"),
        }
