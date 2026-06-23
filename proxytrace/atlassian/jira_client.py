from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx

from proxytrace.settings import Settings, get_settings


class JiraConfigError(RuntimeError):
    """Raised when the Atlassian credentials needed for real Jira calls are absent."""


class JiraSandboxViolation(RuntimeError):
    """Raised when a mutating call targets anything except the configured sandbox."""


@dataclass(frozen=True)
class JiraIssue:
    key: str
    summary: str
    description: str
    project_key: str
    project_name: str
    status: str
    issue_type: str
    url: str


def normalize_atlassian_site_url(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    parts = urlsplit(value)
    if not parts.scheme:
        parts = urlsplit(f"https://{value}")
    return urlunsplit((parts.scheme, parts.netloc, "", "", "")).rstrip("/")


def adf_to_text(value: Any) -> str:
    """Extract readable text from Atlassian Document Format."""
    chunks: list[str] = []

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            text = node.get("text")
            if isinstance(text, str):
                chunks.append(text)
            for child in node.get("content", []):
                visit(child)
        elif isinstance(node, list):
            for child in node:
                visit(child)
        elif isinstance(node, str):
            chunks.append(node)

    visit(value)
    return " ".join(part.strip() for part in chunks if part.strip())


class JiraClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.site_url = normalize_atlassian_site_url(
            self.settings.atlassian_site_url
        )
        if (
            not self.site_url
            or not self.settings.atlassian_email
            or not self.settings.atlassian_api_token
        ):
            raise JiraConfigError(
                "ATLASSIAN_SITE_URL, ATLASSIAN_EMAIL, and ATLASSIAN_API_TOKEN "
                "are required for real Jira calls."
            )

    async def get_issue(self, issue_key: str) -> JiraIssue:
        data = await self._request(
            "GET",
            f"/rest/api/3/issue/{issue_key}",
            params={
                "fields": "summary,description,project,status,issuetype",
            },
        )
        fields = data.get("fields", {})
        project = fields.get("project") or {}
        status = fields.get("status") or {}
        issue_type = fields.get("issuetype") or {}
        key = str(data.get("key") or issue_key).upper()
        return JiraIssue(
            key=key,
            summary=str(fields.get("summary") or ""),
            description=adf_to_text(fields.get("description")),
            project_key=str(project.get("key") or ""),
            project_name=str(project.get("name") or ""),
            status=str(status.get("name") or ""),
            issue_type=str(issue_type.get("name") or ""),
            url=f"{self.site_url}/browse/{key}",
        )

    async def add_comment(self, issue_key: str, text: str) -> dict[str, Any]:
        return await self._request(
            "POST",
            f"/rest/api/3/issue/{issue_key}/comment",
            json={
                "body": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": text}],
                        }
                    ],
                }
            },
        )

    async def set_priority(self, issue_key: str, priority: str) -> dict[str, Any]:
        issue_key = issue_key.strip().upper()
        priority = priority.strip()
        sandbox_project = self.settings.atlassian_sandbox_project_key.strip().upper()
        if not sandbox_project:
            raise JiraSandboxViolation(
                "ATLASSIAN_SANDBOX_PROJECT_KEY is required before Jira field mutations."
            )
        if not issue_key or not priority:
            raise ValueError("issue_key and priority are required for a Jira priority change")

        before = await self.get_issue(issue_key)
        if before.project_key.upper() != sandbox_project:
            raise JiraSandboxViolation(
                f"Refusing to mutate {issue_key}: project {before.project_key!r} is not "
                f"the configured sandbox project {sandbox_project!r}."
            )

        await self._request(
            "PUT",
            f"/rest/api/3/issue/{issue_key}",
            json={"fields": {"priority": {"name": priority}}},
        )
        return {
            "updated": True,
            "issue_key": issue_key,
            "project_key": before.project_key,
            "priority": priority,
            "status": "jira_priority_updated",
            "source": "jira_cloud",
        }

    async def _request(
        self,
        method: str,
        path: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(
            base_url=self.site_url,
            auth=(self.settings.atlassian_email, self.settings.atlassian_api_token),
            timeout=self.settings.tool_timeout_seconds,
            headers={"Accept": "application/json"},
        ) as client:
            response = await client.request(method, path, **kwargs)
            response.raise_for_status()
            if not response.content:
                return {}
            data = response.json()
            return data if isinstance(data, dict) else {"data": data}
