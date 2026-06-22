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

        return {
            "patch_step": patch_step,
            "patch_type": patch_type,
            "patch_payload": deepcopy(patch_payload),
            "patched_steps": patched_steps,
            "propagation": {
                "applied": False,
                "strategy": "agent_reexecution_required",
                "reason": (
                    "PatchEngine only changes the selected boundary. Downstream "
                    "effects must be discovered by executing the agent workflow."
                ),
                "affected_steps": [],
            },
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
