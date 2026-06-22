from __future__ import annotations

import asyncio
from typing import Any

from google import genai
from pydantic import BaseModel

from proxytrace.agent_demo.tools import ProxyTraceClient
from proxytrace.agent_demo.workflow import JiraTriageWorkflow, SYSTEM_PROMPT
from proxytrace.llm_adapter import gemini_patch
from proxytrace.settings import get_settings


class AgentAIUnavailable(RuntimeError):
    pass


class LiveTriageRuntime:
    def __init__(self, *, run_id: str, client: ProxyTraceClient) -> None:
        self.run_id = run_id
        self.client = client
        self.settings = get_settings()

    async def decide(
        self,
        *,
        stage: str,
        prompt: str,
        snapshot: dict[str, Any],
        response_schema: type[BaseModel],
    ) -> Any:
        if not self.settings.gemini_api_key:
            raise AgentAIUnavailable(
                "GEMINI_API_KEY is required for Jira triage; no deterministic "
                "keyword fallback is allowed to make agent decisions."
            )
        return await asyncio.to_thread(
            self._decide_sync,
            stage,
            prompt,
            snapshot,
            response_schema,
        )

    def _decide_sync(
        self,
        stage: str,
        prompt: str,
        snapshot: dict[str, Any],
        response_schema: type[BaseModel],
    ) -> Any:
        gemini_patch.set_trace_context(
            run_id=self.run_id,
            system_prompt=SYSTEM_PROMPT,
            snapshot={**snapshot, "decision_stage": stage},
        )
        try:
            client = genai.Client(api_key=self.settings.gemini_api_key)
            return client.models.generate_content(
                model=self.settings.gemini_model,
                contents=prompt,
                config={
                    "system_instruction": SYSTEM_PROMPT,
                    "response_mime_type": "application/json",
                    "temperature": 0,
                },
            )
        finally:
            gemini_patch.clear_trace_context()

    async def call_tool(
        self,
        *,
        tool_name: str,
        params: dict[str, Any],
        snapshot: dict[str, Any],
    ) -> dict[str, Any]:
        return await self.client.call_tool(
            run_id=self.run_id,
            tool_name=tool_name,
            params=params,
            snapshot=snapshot,
        )


class JiraTriagingAgent:
    def __init__(
        self,
        client: ProxyTraceClient | None = None,
        workflow: JiraTriageWorkflow | None = None,
    ) -> None:
        self.client = client or ProxyTraceClient()
        self.workflow = workflow or JiraTriageWorkflow()
        gemini_patch.install()

    async def run(
        self,
        *,
        issue_key: str,
        summary: str,
        description: str,
    ) -> dict[str, Any]:
        run = await self.client.start_run(
            jira_issue_key=issue_key,
            metadata={"summary": summary, "description": description},
        )
        run_id = run["run_id"]
        runtime = LiveTriageRuntime(run_id=run_id, client=self.client)

        try:
            execution = await self.workflow.execute(
                runtime,
                issue_key=issue_key,
                summary=summary,
                description=description,
            )
        except Exception as exc:
            await self.client.complete_run(
                run_id=run_id,
                status="failed",
                metadata={
                    "failure_type": type(exc).__name__,
                    "failure_message": str(exc),
                },
            )
            raise

        update = execution["update"]
        completed = await self.client.complete_run(
            run_id=run_id,
            metadata={
                "final_board": execution["final_board"],
                "update_status": (
                    update["response"].get("status") if update is not None else "stopped"
                ),
                "model_decision": execution["final_decision"],
            },
        )
        return {
            "run": completed,
            "project_lookup": execution["project_lookup"],
            "update": update,
            "decisions": {
                "initial": execution["initial_decision"],
                "final": execution["final_decision"],
            },
        }
