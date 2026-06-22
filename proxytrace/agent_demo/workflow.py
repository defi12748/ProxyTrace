from __future__ import annotations

import json
from typing import Any, Literal, Protocol, TypeVar

from pydantic import BaseModel, ConfigDict, Field, ValidationError


SYSTEM_PROMPT = (
    "You are a Jira triage agent. Inspect the ticket, choose the best project board, "
    "validate the project key with get_project_key, then update the ticket at most once. "
    "Every decision must be returned as strict JSON."
)


class AgentDecisionError(ValueError):
    """Raised when a model response cannot safely drive the workflow."""


class InitialTriageDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    next_tool: Literal["get_project_key"]
    candidate_board: str = Field(min_length=1)
    reason: str = Field(min_length=1)


class FinalTriageDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    next_tool: Literal["update_ticket", "stop"]
    board: str | None = None
    reason: str = Field(min_length=1)


DecisionModel = TypeVar("DecisionModel", bound=BaseModel)


class TriageRuntime(Protocol):
    async def decide(
        self,
        *,
        stage: str,
        prompt: str,
        snapshot: dict[str, Any],
        response_schema: type[BaseModel],
    ) -> Any: ...

    async def call_tool(
        self,
        *,
        tool_name: str,
        params: dict[str, Any],
        snapshot: dict[str, Any],
    ) -> dict[str, Any]: ...


class JiraTriageWorkflow:
    """The agent control flow shared by live execution and every replay mode."""

    async def execute(
        self,
        runtime: TriageRuntime,
        *,
        issue_key: str,
        summary: str,
        description: str,
    ) -> dict[str, Any]:
        ticket = {
            "issue_key": issue_key,
            "summary": summary,
            "description": description,
        }
        initial_raw = await runtime.decide(
            stage="initial_triage",
            prompt=self._initial_prompt(ticket),
            snapshot={"ticket": ticket},
            response_schema=InitialTriageDecision,
        )
        initial = parse_decision(initial_raw, InitialTriageDecision)

        project_lookup = await runtime.call_tool(
            tool_name=initial.next_tool,
            params=ticket,
            snapshot={
                "candidate_board": initial.candidate_board,
                "decision_reason": initial.reason,
            },
        )
        tool_response = project_lookup.get("response") or {}
        if not isinstance(tool_response, dict):
            raise AgentDecisionError("get_project_key returned a non-object response")

        final_raw = await runtime.decide(
            stage="post_validation",
            prompt=self._final_prompt(ticket, initial, tool_response),
            snapshot={
                "candidate_board": initial.candidate_board,
                "project_lookup": tool_response,
            },
            response_schema=FinalTriageDecision,
        )
        final = parse_decision(final_raw, FinalTriageDecision)

        if final.next_tool == "stop":
            return {
                "initial_decision": initial.model_dump(mode="json"),
                "final_decision": final.model_dump(mode="json"),
                "project_lookup": project_lookup,
                "update": None,
                "final_board": None,
            }

        if not final.board:
            raise AgentDecisionError("update_ticket decision requires a non-empty board")

        update = await runtime.call_tool(
            tool_name=final.next_tool,
            params={
                "issue_key": issue_key,
                "board": final.board,
                "reason": final.reason,
            },
            snapshot={
                "candidate_board": initial.candidate_board,
                "validated_project_key": tool_response.get("project_key"),
                "model_selected_board": final.board,
            },
        )
        return {
            "initial_decision": initial.model_dump(mode="json"),
            "final_decision": final.model_dump(mode="json"),
            "project_lookup": project_lookup,
            "update": update,
            "final_board": final.board,
        }

    def _initial_prompt(self, ticket: dict[str, Any]) -> str:
        return json.dumps(
            {
                "task": "Choose a candidate Jira project, then request validation.",
                "ticket": ticket,
                "output_schema": InitialTriageDecision.model_json_schema(),
            },
            sort_keys=True,
        )

    def _final_prompt(
        self,
        ticket: dict[str, Any],
        initial: InitialTriageDecision,
        tool_response: dict[str, Any],
    ) -> str:
        return json.dumps(
            {
                "task": (
                    "Use the ticket semantics and validated lookup to decide whether "
                    "to update the ticket. The board you return will be used verbatim."
                ),
                "ticket": ticket,
                "initial_decision": initial.model_dump(mode="json"),
                "project_lookup": tool_response,
                "output_schema": FinalTriageDecision.model_json_schema(),
            },
            sort_keys=True,
            default=str,
        )


def parse_decision(value: Any, model: type[DecisionModel]) -> DecisionModel:
    candidate = extract_response_value(value)
    try:
        if isinstance(candidate, str):
            return model.model_validate_json(_strip_json_fence(candidate))
        return model.model_validate(candidate)
    except (ValidationError, json.JSONDecodeError) as exc:
        raise AgentDecisionError(
            f"{model.__name__} validation failed; the agent will not guess: {exc}"
        ) from exc


def extract_response_value(value: Any) -> Any:
    """Normalize Gemini SDK snapshots and replay-friendly response envelopes."""
    if isinstance(value, dict):
        if "response_text" in value:
            return value["response_text"]
        if isinstance(value.get("text"), str):
            return value["text"]
        candidates = value.get("candidates")
        if isinstance(candidates, list) and candidates:
            content = candidates[0].get("content", {}) if isinstance(candidates[0], dict) else {}
            parts = content.get("parts", []) if isinstance(content, dict) else []
            if parts and isinstance(parts[0], dict) and isinstance(parts[0].get("text"), str):
                return parts[0]["text"]
    text = getattr(value, "text", None)
    return text if isinstance(text, str) else value


def _strip_json_fence(value: str) -> str:
    stripped = value.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()
    return stripped
