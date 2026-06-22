from __future__ import annotations

from typing import Any

import httpx

from proxytrace.settings import get_settings


class ProxyTraceClient:
    def __init__(
        self,
        base_url: str | None = None,
        *,
        api_key: str | None = None,
        workspace_id: str | None = None,
    ) -> None:
        settings = get_settings()
        self.base_url = (base_url or settings.proxytrace_api_url).rstrip("/")
        self.api_key = api_key if api_key is not None else settings.proxytrace_api_key
        self.workspace_id = workspace_id or settings.proxytrace_workspace_id

    @property
    def headers(self) -> dict[str, str]:
        headers = {"X-ProxyTrace-Workspace-ID": self.workspace_id}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def start_run(
        self,
        *,
        jira_issue_key: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{self.base_url}/runs",
                headers=self.headers,
                json={
                    "agent_id": "jira-triage-demo",
                    "jira_issue_key": jira_issue_key,
                    "workspace_id": self.workspace_id,
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
                headers=self.headers,
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
                f"{self.base_url}/tool-proxy/call",
                headers=self.headers,
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
                headers=self.headers,
                json={"status": status, "metadata": metadata or {}},
            )
            response.raise_for_status()
            return response.json()["run"]
