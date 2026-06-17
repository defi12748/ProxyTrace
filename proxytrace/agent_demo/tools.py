from __future__ import annotations

from typing import Any

import httpx

from proxytrace.settings import get_settings


class ProxyTraceClient:
    def __init__(self, base_url: str | None = None) -> None:
        settings = get_settings()
        self.base_url = (base_url or settings.proxytrace_api_url).rstrip("/")

    async def start_run(
        self,
        *,
        jira_issue_key: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{self.base_url}/runs",
                json={
                    "agent_id": "jira-triage-demo",
                    "jira_issue_key": jira_issue_key,
                    "workspace_id": "local-demo",
                    "metadata": metadata or {},
                },
            )
            response.raise_for_status()
            return response.json()["run"]

    async def capture_llm(
        self,
        *,
        run_id: str,
        model: str,
        system_prompt: str,
        messages: list[dict[str, Any]],
        response_payload: dict[str, Any],
        snapshot: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{self.base_url}/llm/capture",
                json={
                    "run_id": run_id,
                    "model": model,
                    "system_prompt": system_prompt,
                    "messages": messages,
                    "response": response_payload,
                    "token_usage": {
                        "prompt_tokens": len(str(messages).split()),
                        "completion_tokens": len(str(response_payload).split()),
                    },
                    "snapshot": snapshot or {"messages": messages},
                },
            )
            response.raise_for_status()
            return response.json()["step"]

    async def call_tool(
        self,
        *,
        run_id: str,
        tool_name: str,
        params: dict[str, Any],
        snapshot: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{self.base_url}/mcp",
                json={
                    "run_id": run_id,
                    "tool_name": tool_name,
                    "params": params,
                    "snapshot": snapshot or {"params": params},
                },
            )
            response.raise_for_status()
            return response.json()

    async def complete_run(
        self,
        *,
        run_id: str,
        status: str = "completed",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{self.base_url}/runs/{run_id}/complete",
                json={"status": status, "metadata": metadata or {}},
            )
            response.raise_for_status()
            return response.json()["run"]

