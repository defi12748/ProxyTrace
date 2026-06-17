from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


JsonObject = dict[str, Any]


class StartRunRequest(BaseModel):
    agent_id: str = "jira-triage-demo"
    jira_issue_key: str | None = None
    workspace_id: str = "local-demo"
    metadata: JsonObject = Field(default_factory=dict)


class CompleteRunRequest(BaseModel):
    status: Literal["completed", "failed"] = "completed"
    metadata: JsonObject = Field(default_factory=dict)


class ToolCallRequest(BaseModel):
    run_id: str
    tool_name: str
    params: JsonObject = Field(default_factory=dict)
    step_index: int | None = None
    snapshot: JsonObject = Field(default_factory=dict)


class LLMCaptureRequest(BaseModel):
    run_id: str
    model: str
    system_prompt: str = ""
    messages: list[JsonObject] = Field(default_factory=list)
    response: Any
    token_usage: JsonObject = Field(default_factory=dict)
    step_index: int | None = None
    snapshot: JsonObject = Field(default_factory=dict)


class StrictReplayRequest(BaseModel):
    run_id: str

