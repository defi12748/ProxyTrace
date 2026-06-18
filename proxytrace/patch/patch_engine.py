from __future__ import annotations

from copy import deepcopy
from typing import Any


class PatchError(ValueError):
    pass


class PatchEngine:
    def apply(
        self,
        steps: list[Any],
        *,
        patch_step: int,
        patch_payload: dict[str, Any],
    ) -> dict[str, Any]:
        if patch_step < 1:
            raise PatchError("patch_step must be >= 1")

        patch_type = patch_payload.get("patch_type")
        value = patch_payload.get("value") or {}
        if patch_type not in {"prompt_patch", "tool_result_patch"}:
            raise PatchError(f"unsupported patch_type: {patch_type}")

        patched_steps = [self._step_to_trajectory_item(step) for step in steps]
        target = next(
            (step for step in patched_steps if step["step_index"] == patch_step),
            None,
        )
        if target is None:
            raise PatchError(f"patch_step not found in trace: {patch_step}")

        if patch_type == "prompt_patch":
            self._apply_prompt_patch(target, value)
        elif patch_type == "tool_result_patch":
            self._apply_tool_result_patch(target, value)

        target["patch_applied"] = True
        target["patch"] = deepcopy(patch_payload)

        propagation = self._propagate_tool_result_patch(
            patched_steps,
            patch_step=patch_step,
            patch_type=patch_type,
            target=target,
        )

        return {
            "patch_step": patch_step,
            "patch_type": patch_type,
            "patch_payload": deepcopy(patch_payload),
            "patched_steps": patched_steps,
            "propagation": propagation,
        }

    def _step_to_trajectory_item(self, step: Any) -> dict[str, Any]:
        payload = deepcopy(step.payload or {})
        return {
            "step_id": step.step_id,
            "run_id": step.run_id,
            "step_index": step.step_index,
            "step_type": step.step_type,
            "tool_name": payload.get("tool_name") if step.step_type == "tool" else None,
            "payload": payload,
            "snapshot": deepcopy(step.snapshot or {}),
            "source": "recorded_snapshot",
            "live_call": False,
            "patch_applied": False,
            "unverified": False,
        }

    def _apply_prompt_patch(self, target: dict[str, Any], value: dict[str, Any]) -> None:
        if target["step_type"] != "llm":
            raise PatchError("prompt_patch can only be applied to an llm step")

        payload = target["payload"]
        original = {
            "system_prompt": payload.get("system_prompt", ""),
            "messages": deepcopy(payload.get("messages", [])),
            "response": deepcopy(payload.get("response")),
        }
        payload["original_prompt_patch_target"] = original
        if "system_prompt" in value:
            payload["system_prompt"] = value["system_prompt"]
        if "messages" in value:
            payload["messages"] = value["messages"]
        if "response" in value:
            payload["response"] = value["response"]
        payload["patch_type"] = "prompt_patch"
        target["source"] = "patched_context"

    def _apply_tool_result_patch(
        self, target: dict[str, Any], value: dict[str, Any]
    ) -> None:
        if target["step_type"] != "tool":
            raise PatchError("tool_result_patch can only be applied to a tool step")

        payload = target["payload"]
        original_response = deepcopy(payload.get("response"))
        response_patch = value.get("response", value)
        payload["original_response"] = original_response
        payload["response"] = deepcopy(response_patch)
        payload["patch_type"] = "tool_result_patch"
        target["source"] = "patched_tool_result"

    def _propagate_tool_result_patch(
        self,
        patched_steps: list[dict[str, Any]],
        *,
        patch_step: int,
        patch_type: str,
        target: dict[str, Any],
    ) -> dict[str, Any]:
        if patch_type != "tool_result_patch":
            return {"applied": False, "reason": "patch type does not propagate"}

        patched_response = target["payload"].get("response")
        if not isinstance(patched_response, dict):
            return {"applied": False, "reason": "patched response is not an object"}

        routed_board = (
            patched_response.get("project_key")
            or patched_response.get("board")
            or patched_response.get("project")
        )
        if not routed_board:
            return {"applied": False, "reason": "patched response has no board-like key"}

        affected_steps: list[int] = []
        for step in patched_steps:
            if step["step_index"] <= patch_step or step["step_type"] != "tool":
                continue
            if step.get("tool_name") != "update_ticket":
                continue

            payload = step["payload"]
            params = deepcopy(payload.get("params", {}))
            response = deepcopy(payload.get("response", {}))
            params["board"] = routed_board
            if isinstance(response, dict):
                response["board"] = routed_board
            payload["params"] = params
            payload["response"] = response
            payload["derived_from_patch_step"] = patch_step
            step["source"] = "derived_from_patch"
            step["unverified"] = True
            affected_steps.append(step["step_index"])

        return {
            "applied": bool(affected_steps),
            "strategy": "propagate_project_key_to_update_ticket",
            "board": routed_board,
            "affected_steps": affected_steps,
        }
