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


async def escalate_ticket(params: dict[str, Any]) -> dict[str, Any]:
    issue_key = str(params.get("issue_key") or "").strip().upper()
    priority = str(params.get("priority") or "High").strip()
    reason = str(params.get("reason") or "High-impact issue requires escalation.").strip()
    if not issue_key:
        raise ValueError("issue_key is required for Jira escalation")

    response = await JiraClient().set_priority(issue_key, priority)
    return {**response, "reason": reason}


async def jira_get_issue(params: dict[str, Any]) -> dict[str, Any]:
    issue_key = str(params.get("issue_key") or "").strip().upper()
    if not issue_key:
        raise ValueError("issue_key is required for Jira issue lookup")
    issue = await JiraClient().get_issue(issue_key)
    return issue.__dict__


async def jira_add_comment(params: dict[str, Any]) -> dict[str, Any]:
    issue_key = str(params.get("issue_key") or "").strip().upper()
    text = str(params.get("text") or "").strip()
    if not issue_key or not text:
        raise ValueError("issue_key and text are required for Jira comments")
    return await JiraClient().add_comment(issue_key, text)


async def jira_set_priority(params: dict[str, Any]) -> dict[str, Any]:
    return await escalate_ticket(params)


JIRA_TOOL_HANDLERS = {
    "get_project_key": get_project_key,
    "update_ticket": update_ticket,
    "escalate_ticket": escalate_ticket,
    "jira_get_issue": jira_get_issue,
    "jira_add_comment": jira_add_comment,
    "jira_set_priority": jira_set_priority,
}
