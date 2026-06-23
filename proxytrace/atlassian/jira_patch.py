from __future__ import annotations

import contextvars
import os
from typing import Any, Awaitable, Callable

import httpx

from proxytrace.atlassian.jira_client import JiraClient, JiraIssue
from proxytrace.settings import Settings


class JiraInterceptError(RuntimeError):
    """Raised when the transparent tool gateway rejects an intercepted Jira call."""


_run_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "proxytrace_jira_run_id", default=None
)
_snapshot: contextvars.ContextVar[dict[str, Any] | None] = contextvars.ContextVar(
    "proxytrace_jira_snapshot", default=None
)
_installed = False
_configured_api_base_url: str | None = None
_configured_run_id: str | None = None
_original_methods: dict[str, Callable[..., Awaitable[Any]]] = {}


def set_trace_context(
    *, run_id: str, snapshot: dict[str, Any] | None = None
) -> None:
    _run_id.set(run_id)
    _snapshot.set(snapshot)


def clear_trace_context() -> None:
    _run_id.set(None)
    _snapshot.set(None)


def is_installed() -> bool:
    return _installed


def install(*, api_base_url: str | None = None, run_id: str | None = None) -> bool:
    """Transparently route JiraClient calls through ProxyTrace's typed tool gateway.

    Existing application code can keep calling ``JiraClient`` directly. Install once at
    startup and provide a run id here, through ``set_trace_context``, or with
    ``PROXYTRACE_RUN_ID``; reads and writes are then recorded without using
    ``ProxyTraceClient.call_tool`` in the calling code.
    """
    global _configured_api_base_url, _configured_run_id, _installed
    if _installed:
        return False

    _configured_api_base_url = api_base_url
    _configured_run_id = run_id
    _original_methods.update(
        {
            "get_issue": JiraClient.get_issue,
            "add_comment": JiraClient.add_comment,
            "set_priority": JiraClient.set_priority,
        }
    )

    async def intercepted_get_issue(client: JiraClient, issue_key: str) -> JiraIssue:
        resolved_run_id = _resolve_run_id()
        if not resolved_run_id:
            return await _original_methods["get_issue"](client, issue_key)
        payload = await _intercept(
            client.settings,
            run_id=resolved_run_id,
            tool_name="jira_get_issue",
            params={"issue_key": issue_key},
        )
        return JiraIssue(**payload)

    async def intercepted_add_comment(
        client: JiraClient, issue_key: str, text: str
    ) -> dict[str, Any]:
        resolved_run_id = _resolve_run_id()
        if not resolved_run_id:
            return await _original_methods["add_comment"](client, issue_key, text)
        return await _intercept(
            client.settings,
            run_id=resolved_run_id,
            tool_name="jira_add_comment",
            params={"issue_key": issue_key, "text": text},
        )

    async def intercepted_set_priority(
        client: JiraClient, issue_key: str, priority: str
    ) -> dict[str, Any]:
        resolved_run_id = _resolve_run_id()
        if not resolved_run_id:
            return await _original_methods["set_priority"](client, issue_key, priority)
        return await _intercept(
            client.settings,
            run_id=resolved_run_id,
            tool_name="jira_set_priority",
            params={"issue_key": issue_key, "priority": priority},
        )

    JiraClient.get_issue = intercepted_get_issue
    JiraClient.add_comment = intercepted_add_comment
    JiraClient.set_priority = intercepted_set_priority
    _installed = True
    return True


def uninstall_for_tests() -> None:
    global _configured_api_base_url, _configured_run_id, _installed
    if not _installed:
        return
    for name, method in _original_methods.items():
        setattr(JiraClient, name, method)
    _original_methods.clear()
    _configured_api_base_url = None
    _configured_run_id = None
    _installed = False
    clear_trace_context()


def _resolve_run_id() -> str | None:
    return _configured_run_id or _run_id.get() or os.getenv("PROXYTRACE_RUN_ID")


async def _intercept(
    settings: Settings,
    *,
    run_id: str,
    tool_name: str,
    params: dict[str, Any],
) -> dict[str, Any]:
    base_url = (_configured_api_base_url or settings.proxytrace_api_url).rstrip("/")
    headers = {"X-ProxyTrace-Workspace-ID": settings.proxytrace_workspace_id}
    if settings.proxytrace_api_key:
        headers["Authorization"] = f"Bearer {settings.proxytrace_api_key}"
    response = await _call_gateway(
        f"{base_url}/tool-proxy/call",
        headers=headers,
        json={
            "run_id": run_id,
            "tool_name": tool_name,
            "params": params,
            "snapshot": _snapshot.get() or {"transparent_intercept": True},
        },
        timeout=settings.tool_timeout_seconds,
    )
    if response.get("status") != "ok":
        error = response.get("response") or {}
        raise JiraInterceptError(
            str(error.get("message") or f"Intercepted {tool_name} call failed")
        )
    payload = response.get("response")
    if not isinstance(payload, dict):
        raise JiraInterceptError(f"Intercepted {tool_name} returned a non-object response")
    return payload


async def _call_gateway(
    url: str,
    *,
    headers: dict[str, str],
    json: dict[str, Any],
    timeout: float,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, headers=headers, json=json)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise JiraInterceptError("ProxyTrace gateway returned a non-object response")
        return payload
