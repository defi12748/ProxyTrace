from __future__ import annotations

from typing import Any

from proxytrace.agent_demo.tools import ProxyTraceClient
from proxytrace.llm_adapter.adapter import decide_project_board


SYSTEM_PROMPT = (
    "You are a Jira triage agent. Inspect the ticket, choose the best project board, "
    "validate the project key with get_project_key, then update the ticket exactly once."
)


class JiraTriagingAgent:
    def __init__(self, client: ProxyTraceClient | None = None) -> None:
        self.client = client or ProxyTraceClient()

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
        await self.client.capture_llm(
            run_id=run_id,
            model="proxytrace-demo-deterministic",
            system_prompt=SYSTEM_PROMPT,
            messages=messages,
            response_payload={
                "thought": "Validate the routing board before making a write.",
                "next_tool": "get_project_key",
                "candidate_board": decision["board"],
                "confidence": decision["confidence"],
            },
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

        await self.client.capture_llm(
            run_id=run_id,
            model="proxytrace-demo-deterministic",
            system_prompt=SYSTEM_PROMPT,
            messages=messages
            + [
                {
                    "role": "tool",
                    "name": "get_project_key",
                    "content": str(project_lookup["response"]),
                }
            ],
            response_payload={
                "thought": "The project key has been validated; update the Jira ticket.",
                "next_tool": "update_ticket",
                "board": project_key,
            },
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

