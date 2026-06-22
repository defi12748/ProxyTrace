from __future__ import annotations

import asyncio
from copy import deepcopy
from typing import Any, Awaitable, Callable, Protocol

from google import genai
from pydantic import BaseModel

from proxytrace.agent_demo.workflow import JiraTriageWorkflow, SYSTEM_PROMPT
from proxytrace.contracts.registry import get_contract_or_default
from proxytrace.replay.firewall import SideEffectFirewall
from proxytrace.settings import get_settings


class ReplayExecutionError(RuntimeError):
    pass


class ReplayAIUnavailable(ReplayExecutionError):
    pass


class DecisionGenerator(Protocol):
    async def generate(
        self,
        *,
        stage: str,
        prompt: str,
        response_schema: type[BaseModel],
    ) -> Any: ...


class GeminiDecisionGenerator:
    def __init__(self, *, api_key: str | None = None, model: str | None = None) -> None:
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.gemini_api_key
        self.model = model or settings.gemini_model

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def generate(
        self,
        *,
        stage: str,
        prompt: str,
        response_schema: type[BaseModel],
    ) -> Any:
        if not self.api_key:
            raise ReplayAIUnavailable(
                "Exploratory replay needs Gemini to execute model decisions after "
                "the branch point; no deterministic decision fallback is available."
            )
        return await asyncio.to_thread(
            self._generate_sync,
            stage,
            prompt,
            response_schema,
        )

    def _generate_sync(
        self,
        stage: str,
        prompt: str,
        response_schema: type[BaseModel],
    ) -> Any:
        client = genai.Client(api_key=self.api_key)
        return client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={
                "system_instruction": SYSTEM_PROMPT,
                "response_mime_type": "application/json",
                "temperature": 0,
            },
        )


ContractResolver = Callable[[str], Awaitable[Any]]


class InterceptedReplayRuntime:
    """Serves recorded calls while the current agent workflow really executes."""

    def __init__(
        self,
        *,
        recorded_steps: list[Any],
        contract_resolver: ContractResolver,
        firewall: SideEffectFirewall,
        mode: str,
        patch_step: int | None = None,
        patch_payload: dict[str, Any] | None = None,
        decision_generator: DecisionGenerator | None = None,
    ) -> None:
        self.recorded_steps = recorded_steps
        self.contract_resolver = contract_resolver
        self.firewall = firewall
        self.mode = mode
        self.patch_step = patch_step
        self.patch_payload = patch_payload or {}
        self.decision_generator = decision_generator
        self.cursor = 0
        self.events: list[dict[str, Any]] = []
        self.live_model_call_count = 0
        self.live_tool_call_count = 0
        self.side_effect_block_count = 0

    async def decide(
        self,
        *,
        stage: str,
        prompt: str,
        snapshot: dict[str, Any],
        response_schema: type[BaseModel],
    ) -> Any:
        expected = self._consume_expected("llm")
        step_index = self._event_step_index(expected)
        generated = self._must_generate(step_index, "llm")
        patch_applied = self._is_patch_target(step_index, "prompt_patch")

        if patch_applied:
            value = self.patch_payload.get("value") or {}
            if "response" in value:
                response = deepcopy(value["response"])
                source = "patched_llm_response"
                generated = False
            else:
                prompt = self._patched_prompt(prompt, value)
                response = await self._generate(stage, prompt, response_schema)
                source = "regenerated_model_decision"
                generated = True
        elif generated:
            response = await self._generate(stage, prompt, response_schema)
            source = "regenerated_model_decision"
        else:
            payload = self._payload(expected)
            response = deepcopy(payload.get("response_text") or payload.get("response"))
            source = "recorded_interceptor"

        payload = {
            "model": self._payload(expected).get("model"),
            "system_prompt": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": prompt}],
            "response": _serialize(response),
            "response_text": _response_text(response),
            "decision_stage": stage,
        }
        event = self._base_event(
            expected=expected,
            step_index=step_index,
            step_type="llm",
            payload=payload,
            snapshot=snapshot,
            source=source,
            live_call=generated,
            patch_applied=patch_applied,
        )
        event["request_matched"] = self._llm_request_matches(expected, prompt)
        self.events.append(event)
        return response

    async def call_tool(
        self,
        *,
        tool_name: str,
        params: dict[str, Any],
        snapshot: dict[str, Any],
    ) -> dict[str, Any]:
        expected = self._consume_expected("tool", tool_name=tool_name)
        step_index = self._event_step_index(expected)
        patch_applied = self._is_patch_target(step_index, "tool_result_patch")
        expected_payload = self._payload(expected)
        contract = await self.contract_resolver(tool_name)
        decision = self.firewall.inspect_replay_call(
            tool_name=tool_name,
            params=params,
            contract=contract,
        )
        if not decision.allowed:
            self.side_effect_block_count += 1

        if patch_applied:
            value = self.patch_payload.get("value") or {}
            response = deepcopy(value.get("response", value))
            source = "patched_tool_interceptor"
        elif self._is_after_patch(step_index):
            response = self._simulate_from_recording(expected_payload.get("response"), params)
            source = "simulated_tool_interceptor"
        else:
            response = deepcopy(expected_payload.get("response"))
            source = "recorded_interceptor"

        payload = {
            "tool_name": tool_name,
            "params": deepcopy(params),
            "response": response,
            "status": expected_payload.get("status", "ok"),
            "contract": expected_payload.get("contract", {}),
        }
        event = self._base_event(
            expected=expected,
            step_index=step_index,
            step_type="tool",
            payload=payload,
            snapshot=snapshot,
            source=source,
            live_call=False,
            patch_applied=patch_applied,
            tool_name=tool_name,
        )
        event["request_matched"] = bool(
            expected is not None
            and expected_payload.get("tool_name") == tool_name
            and expected_payload.get("params", {}) == params
        )
        event["firewall"] = {
            "allowed": decision.allowed,
            "action": decision.action,
            "reason": decision.reason,
            "details": decision.details,
        }
        self.events.append(event)
        return {
            "tool_name": tool_name,
            "status": payload["status"],
            "response": response,
            "side_effect": bool(getattr(contract, "side_effect", False)),
            "replay_policy": getattr(contract, "replay_policy", "mock_from_recording"),
            "firewall": event["firewall"],
        }

    def remaining_recorded_steps(self) -> list[Any]:
        return self.recorded_steps[self.cursor :]

    def _consume_expected(self, step_type: str, *, tool_name: str | None = None) -> Any:
        expected = (
            self.recorded_steps[self.cursor]
            if self.cursor < len(self.recorded_steps)
            else None
        )
        self.cursor += 1
        if expected is None:
            return None
        return expected

    def _event_step_index(self, expected: Any) -> int:
        if expected is not None:
            return int(expected.step_index)
        return self.cursor

    def _payload(self, step: Any) -> dict[str, Any]:
        return dict(step.payload or {}) if step is not None else {}

    def _is_patch_target(self, step_index: int, patch_type: str) -> bool:
        return bool(
            self.mode == "exploratory"
            and self.patch_step == step_index
            and self.patch_payload.get("patch_type") == patch_type
        )

    def _is_after_patch(self, step_index: int) -> bool:
        return bool(
            self.mode == "exploratory"
            and self.patch_step is not None
            and step_index > self.patch_step
        )

    def _must_generate(self, step_index: int, step_type: str) -> bool:
        if self.mode != "exploratory" or step_type != "llm" or self.patch_step is None:
            return False
        return step_index > self.patch_step

    async def _generate(
        self,
        stage: str,
        prompt: str,
        response_schema: type[BaseModel],
    ) -> Any:
        if self.decision_generator is None:
            raise ReplayAIUnavailable(
                "No decision generator is configured for the exploratory branch."
            )
        self.live_model_call_count += 1
        return await self.decision_generator.generate(
            stage=stage,
            prompt=prompt,
            response_schema=response_schema,
        )

    def _patched_prompt(self, prompt: str, value: dict[str, Any]) -> str:
        if "prompt" in value:
            return str(value["prompt"])
        if "messages" in value:
            return str(value["messages"])
        if "system_prompt" in value:
            return f"{value['system_prompt']}\n\n{prompt}"
        return prompt

    def _simulate_from_recording(self, recorded: Any, params: dict[str, Any]) -> Any:
        if not isinstance(recorded, dict):
            return deepcopy(recorded)
        response = deepcopy(recorded)
        for key in ("issue_key", "board", "reason", "priority"):
            if key in params and key in response:
                response[key] = params[key]
        if "status" in response:
            response["status"] = "simulated_replay"
        return response

    def _llm_request_matches(self, expected: Any, prompt: str) -> bool:
        messages = self._payload(expected).get("messages") or []
        if not messages:
            return False
        last = messages[-1]
        return isinstance(last, dict) and last.get("content") == prompt

    def _base_event(
        self,
        *,
        expected: Any,
        step_index: int,
        step_type: str,
        payload: dict[str, Any],
        snapshot: dict[str, Any],
        source: str,
        live_call: bool,
        patch_applied: bool,
        tool_name: str | None = None,
    ) -> dict[str, Any]:
        return {
            "step_id": getattr(expected, "step_id", None),
            "run_id": getattr(expected, "run_id", None),
            "step_index": step_index,
            "step_type": step_type,
            "tool_name": tool_name,
            "payload": payload,
            "snapshot": deepcopy(snapshot),
            "source": source,
            "live_call": live_call,
            "patch_applied": patch_applied,
            "unverified": source in {
                "regenerated_model_decision",
                "simulated_tool_interceptor",
            },
            "expected_signature": _recorded_signature(expected),
            "actual_signature": (step_type, tool_name if step_type == "tool" else None),
        }


async def execute_recorded_agent(
    *,
    run: Any,
    steps: list[Any],
    session: Any,
    firewall: SideEffectFirewall,
    mode: str,
    patch_step: int | None = None,
    patch_payload: dict[str, Any] | None = None,
    decision_generator: DecisionGenerator | None = None,
) -> tuple[dict[str, Any], InterceptedReplayRuntime]:
    metadata = run.metadata_json or {}

    async def resolve_contract(tool_name: str) -> Any:
        return await get_contract_or_default(session, tool_name)

    runtime = InterceptedReplayRuntime(
        recorded_steps=steps,
        contract_resolver=resolve_contract,
        firewall=firewall,
        mode=mode,
        patch_step=patch_step,
        patch_payload=patch_payload,
        decision_generator=decision_generator,
    )
    try:
        result = await JiraTriageWorkflow().execute(
            runtime,
            issue_key=run.jira_issue_key or str(metadata.get("issue_key") or ""),
            summary=str(metadata.get("summary") or ""),
            description=str(metadata.get("description") or ""),
        )
    except Exception as exc:
        setattr(exc, "replay_runtime", runtime)
        raise
    return result, runtime


def _recorded_signature(step: Any) -> tuple[str, str | None] | None:
    if step is None:
        return None
    payload = step.payload or {}
    return (
        step.step_type,
        payload.get("tool_name") if step.step_type == "tool" else None,
    )


def _response_text(response: Any) -> str | None:
    text = getattr(response, "text", None)
    if isinstance(text, str):
        return text
    if isinstance(response, str):
        return response
    if isinstance(response, dict) and isinstance(response.get("text"), str):
        return response["text"]
    return None


def _serialize(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _serialize(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serialize(item) for item in value]
    if hasattr(value, "to_json_dict"):
        return _serialize(value.to_json_dict())
    if hasattr(value, "model_dump"):
        return _serialize(value.model_dump(mode="json"))
    text = getattr(value, "text", None)
    return {"text": text} if isinstance(text, str) else str(value)
