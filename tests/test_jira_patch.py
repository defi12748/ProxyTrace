from __future__ import annotations

from typing import Any

import pytest

from proxytrace.atlassian import jira_patch
from proxytrace.atlassian.jira_client import (
    JiraClient,
    JiraIssue,
    JiraSandboxViolation,
)
from proxytrace.settings import Settings


def _settings(*, sandbox: str = "SAFE") -> Settings:
    return Settings(
        atlassian_site_url="https://example.atlassian.net",
        atlassian_email="agent@example.com",
        atlassian_api_token="test-token",
        atlassian_sandbox_project_key=sandbox,
        proxytrace_api_url="http://proxytrace.test",
        proxytrace_workspace_id="workspace-1",
    )


class StubJiraClient(JiraClient):
    def __init__(self, *, project_key: str = "SAFE") -> None:
        super().__init__(_settings())
        self.project_key = project_key
        self.requests: list[tuple[str, str, dict[str, Any]]] = []

    async def get_issue(self, issue_key: str) -> JiraIssue:
        return JiraIssue(
            key=issue_key,
            summary="Authentication outage",
            description="Users cannot sign in.",
            project_key=self.project_key,
            project_name="Sandbox",
            status="To Do",
            issue_type="Incident",
            url=f"https://example.atlassian.net/browse/{issue_key}",
        )

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        self.requests.append((method, path, kwargs))
        return {}


async def test_priority_mutation_is_scoped_to_configured_sandbox() -> None:
    client = StubJiraClient()

    result = await client.set_priority("SAFE-1", "High")

    assert result["status"] == "jira_priority_updated"
    assert client.requests == [
        (
            "PUT",
            "/rest/api/3/issue/SAFE-1",
            {"json": {"fields": {"priority": {"name": "High"}}}},
        )
    ]


async def test_priority_mutation_rejects_non_sandbox_issue() -> None:
    client = StubJiraClient(project_key="PROD")

    with pytest.raises(JiraSandboxViolation, match="Refusing to mutate"):
        await client.set_priority("PROD-1", "Highest")

    assert client.requests == []


async def test_transparent_patch_records_unmodified_jira_client_calls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []

    async def fake_gateway(
        url: str,
        *,
        headers: dict[str, str],
        json: dict[str, Any],
        timeout: float,
    ) -> dict[str, Any]:
        calls.append({"url": url, "headers": headers, "json": json, "timeout": timeout})
        responses = {
            "jira_get_issue": {
                "key": "SAFE-1",
                "summary": "Authentication outage",
                "description": "Users cannot sign in.",
                "project_key": "SAFE",
                "project_name": "Sandbox",
                "status": "To Do",
                "issue_type": "Incident",
                "url": "https://example.atlassian.net/browse/SAFE-1",
            },
            "jira_add_comment": {"id": "10000"},
            "jira_set_priority": {
                "updated": True,
                "issue_key": "SAFE-1",
                "priority": "High",
            },
        }
        return {"status": "ok", "response": responses[json["tool_name"]]}

    jira_patch.uninstall_for_tests()
    monkeypatch.setattr(jira_patch, "_call_gateway", fake_gateway)
    jira_patch.install(run_id="run-1")
    try:
        client = JiraClient(_settings())
        issue = await client.get_issue("SAFE-1")
        comment = await client.add_comment("SAFE-1", "Triage complete.")
        priority = await client.set_priority("SAFE-1", "High")
    finally:
        jira_patch.uninstall_for_tests()

    assert issue.project_key == "SAFE"
    assert comment == {"id": "10000"}
    assert priority["priority"] == "High"
    assert [call["json"]["tool_name"] for call in calls] == [
        "jira_get_issue",
        "jira_add_comment",
        "jira_set_priority",
    ]
    assert all(call["json"]["run_id"] == "run-1" for call in calls)
    assert all(
        call["json"]["snapshot"] == {"transparent_intercept": True}
        for call in calls
    )


async def test_transparent_patch_falls_back_when_no_run_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    jira_patch.uninstall_for_tests()
    original = JiraClient.get_issue
    seen: list[str] = []

    async def fake_original(self: JiraClient, issue_key: str) -> JiraIssue:
        seen.append(issue_key)
        return JiraIssue(issue_key, "", "", "SAFE", "Sandbox", "To Do", "Task", "")

    monkeypatch.setattr(JiraClient, "get_issue", fake_original)
    jira_patch.install()
    try:
        issue = await JiraClient(_settings()).get_issue("SAFE-2")
    finally:
        jira_patch.uninstall_for_tests()
        monkeypatch.setattr(JiraClient, "get_issue", original)

    assert issue.key == "SAFE-2"
    assert seen == ["SAFE-2"]
