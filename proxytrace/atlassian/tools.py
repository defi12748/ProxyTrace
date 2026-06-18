from __future__ import annotations

from typing import Any

from proxytrace.atlassian.jira_client import JiraClient


async def get_project_key(params: dict[str, Any]) -> dict[str, Any]:
    issue_key = str(params.get("issue_key") or "").strip().upper()
    if not issue_key:
        raise ValueError("issue_key is required for real Jira project lookup")

    issue = await JiraClient().get_issue(issue_key)
    return {
        "project_key": issue.project_key,
        "project_name": issue.project_name,
        "issue_key": issue.key,
        "issue_type": issue.issue_type,
        "status": issue.status,
        "confidence": 1.0,
        "evidence": [issue.url],
        "source": "jira_cloud",
    }


async def update_ticket(params: dict[str, Any]) -> dict[str, Any]:
    issue_key = str(params.get("issue_key") or "").strip().upper()
    if not issue_key:
        raise ValueError("issue_key is required for real Jira update")

    board = str(params.get("board") or "").strip()
    reason = str(params.get("reason") or "ProxyTrace traced this agent run.").strip()
    comment = (
        "ProxyTrace recorded this AI-agent action.\n"
        f"Validated Jira project: {board or 'unknown'}.\n"
        f"Reason: {reason}"
    )
    response = await JiraClient().add_comment(issue_key, comment)
    return {
        "updated": True,
        "issue_key": issue_key,
        "board": board,
        "reason": reason,
        "status": "jira_comment_added",
        "comment_id": str(response.get("id") or ""),
        "source": "jira_cloud",
    }


JIRA_TOOL_HANDLERS = {
    "get_project_key": get_project_key,
    "update_ticket": update_ticket,
}
