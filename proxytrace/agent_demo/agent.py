from __future__ import annotations

import asyncio
from typing import Any

from google import genai

from proxytrace.agent_demo.tools import ProxyTraceClient
from proxytrace.llm_adapter import gemini_patch
from proxytrace.llm_adapter.adapter import decide_project_board
from proxytrace.settings import get_settings


SYSTEM_PROMPT = (
    "You are a Jira triage agent. Inspect the ticket, choose the best project board, "
    "validate the project key with get_project_key, then update the ticket exactly once."
)


class JiraTriagingAgent:
    def __init__(self, client: ProxyTraceClient | None = None) -> None:
        self.client = client or ProxyTraceClient()
        self.settings = get_settings()
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

        messages = [
            {
                "role": "user",
                "content": (
                    f"Issue {issue_key}: {summary}\n\n"
                    f"Description: {description}"
                ),
            }
        ]
        decision = decide_project_board(summary, description)
        await self._capture_gemini_turn(
            run_id=run_id,
            contents=(
                "Decide the safest next action for this Jira triage task. "
                "The expected next action is to validate the project key before "
                f"making a write.\n\nTicket: {messages[0]['content']}"
            ),
            snapshot={"ticket": {"issue_key": issue_key, "summary": summary}},
        )

        project_lookup = await self.client.call_tool(
            run_id=run_id,
            tool_name="get_project_key",
            params={
                "issue_key": issue_key,
                "summary": summary,
                "description": description,
            },
            snapshot={"candidate_board": decision["board"]},
        )
        project_key = project_lookup["response"]["project_key"]

        await self._capture_gemini_turn(
            run_id=run_id,
            contents=(
                "The project key lookup returned this recorded tool response: "
                f"{project_lookup['response']}. Decide the next action."
            ),
            snapshot={"validated_project_key": project_key},
        )

        update = await self.client.call_tool(
            run_id=run_id,
            tool_name="update_ticket",
            params={
                "issue_key": issue_key,
                "board": project_key,
                "reason": (
                    "Routing selected from ticket semantics and validated through "
                    "get_project_key."
                ),
            },
            snapshot={"validated_project_key": project_key},
        )

        completed = await self.client.complete_run(
            run_id=run_id,
            metadata={
                "final_board": project_key,
                "update_status": update["response"].get("status"),
            },
        )
        return {
            "run": completed,
            "project_lookup": project_lookup,
            "update": update,
        }

    async def _capture_gemini_turn(
        self,
        *,
        run_id: str,
        contents: str,
        snapshot: dict[str, Any],
    ) -> None:
        if not self.settings.gemini_api_key:
            return
        await asyncio.to_thread(
            self._capture_gemini_turn_sync,
            run_id,
            contents,
            snapshot,
        )

    def _capture_gemini_turn_sync(
        self,
        run_id: str,
        contents: str,
        snapshot: dict[str, Any],
    ) -> None:
        gemini_patch.set_trace_context(
            run_id=run_id,
            system_prompt=SYSTEM_PROMPT,
            snapshot=snapshot,
        )
        try:
            client = genai.Client(api_key=self.settings.gemini_api_key)
            client.models.generate_content(
                model=self.settings.gemini_model,
                contents=contents,
                config={"system_instruction": SYSTEM_PROMPT},
            )
        finally:
            gemini_patch.clear_trace_context()
